
// functions/cashshop.js — ร้านค้าแคช (Stripe: บัตร + พร้อมเพย์) ขายตั๋วลงขายตลาดกลาง
// ใน functions/index.js ต้องมี:  Object.assign(exports, require('./cashshop'));
// ใน functions/package.json > dependencies ต้องมี:  "stripe": "^17.0.0"
// ความลับ 2 ตัว (ห้ามใส่ในโค้ด):  STRIPE_SECRET_KEY  และ  STRIPE_WEBHOOK_SECRET
//
// หลักการ: ตั๋วถูกเพิ่มโดย webhook ของ Stripe เท่านั้น (เครื่องผู้เล่นให้ตั๋วตัวเองไม่ได้)
//   - ราคา/จำนวนตั๋วอยู่ในตาราง PRODUCTS ฝั่งเซิร์ฟเวอร์ ไม่เชื่อค่าจากเกม
//   - ตรวจยอดเงินและสกุลเงินที่ Stripe รายงานว่าตรงกับสินค้าก่อนให้ตั๋ว
//   - กันให้ซ้ำ: ใช้รหัส session ของ Stripe เป็นรหัสรายการ (market_payments) ส่ง webhook ซ้ำก็ไม่ให้ซ้ำ
//   - เพดานซื้อตั๋วต่อ 24 ชม. กันใช้เงินจริงปั๊มทองผ่านตลาด
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const STRIPE_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WH = defineSecret('STRIPE_WEBHOOK_SECRET');

// ---------- ค่าที่ปรับได้ ----------
const REGION = 'asia-southeast1';                         // ให้ตรงกับ functions/market.js
const SITE_URL = 'https://YOUR-NAME.github.io/YOUR-REPO/'; // <-- แก้เป็นที่อยู่เกมของคุณ (หน้าที่กลับมาหลังจ่ายเงิน)
const DAY = 24 * 3600000;
const MAX_TICKETS_PER_DAY = 30;                           // ซื้อตั๋วได้สูงสุดกี่ใบต่อ 24 ชม. ต่อบัญชี

// ราคาเป็น "บาท" (แก้ได้ตามใจ) | tk = ระดับตั๋ว 1/2/3 ตรงกับ TICKET_MAX ใน market.js | n = จำนวนใบ
// *** ตัวเลขราคาด้านล่างเป็นตัวอย่าง ตั้งเองได้ และตรวจยอดขั้นต่ำของ Stripe ในแดชบอร์ดด้วย ***
const PRODUCTS = {
  t1_x1:  { tk: 1, n: 1,  baht: 29,   name: 'ตั๋วลงขาย ระดับ 1 (ไม่เกิน 2 ล้าน) x1' },
  t1_x10: { tk: 1, n: 10, baht: 249,  name: 'ตั๋วลงขาย ระดับ 1 (ไม่เกิน 2 ล้าน) x10' },
  t2_x1:  { tk: 2, n: 1,  baht: 59,   name: 'ตั๋วลงขาย ระดับ 2 (ไม่เกิน 5 ล้าน) x1' },
  t2_x10: { tk: 2, n: 10, baht: 499,  name: 'ตั๋วลงขาย ระดับ 2 (ไม่เกิน 5 ล้าน) x10' },
  t3_x1:  { tk: 3, n: 1,  baht: 99,   name: 'ตั๋วลงขาย ระดับ 3 (ไม่เกิน 9,999,999) x1' },
  t3_x10: { tk: 3, n: 10, baht: 849,  name: 'ตั๋วลงขาย ระดับ 3 (ไม่เกิน 9,999,999) x10' }
};

function needGoogle(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'ต้องล็อกอินด้วย Google ก่อน');
  const prov = req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider;
  if (prov !== 'google.com') throw new HttpsError('permission-denied', 'ต้องล็อกอินด้วย Google ก่อนซื้อ');
  return req.auth.uid;
}
async function usedToday(uid) {
  const s = await db.collection('cash_limits').doc(uid).get();
  const buys = ((s.exists && s.data().buys) || []).filter(function (x) { return x.t > Date.now() - DAY; });
  return buys.reduce(function (a, b) { return a + b.n; }, 0);
}

// ---------- รายการสินค้า (ให้หน้าร้านในเกมดึงไปแสดง) ----------
exports.getCashProducts = onCall({ region: REGION, maxInstances: 5 }, async (req) => {
  const uid = needGoogle(req);
  const used = await usedToday(uid);
  return {
    products: Object.keys(PRODUCTS).map(function (id) {
      const p = PRODUCTS[id];
      return { id: id, tk: p.tk, n: p.n, baht: p.baht, name: p.name };
    }),
    dailyLeft: Math.max(0, MAX_TICKETS_PER_DAY - used)
  };
});

// ---------- สร้างหน้าชำระเงิน ----------
exports.createCheckout = onCall({ region: REGION, secrets: [STRIPE_KEY], maxInstances: 5 }, async (req) => {
  const uid = needGoogle(req);
  const pid = String((req.data || {}).productId || '');
  const p = PRODUCTS[pid];
  if (!p) throw new HttpsError('invalid-argument', 'ไม่พบสินค้านี้');
  const used = await usedToday(uid);
  if (used + p.n > MAX_TICKETS_PER_DAY) {
    throw new HttpsError('resource-exhausted', 'ซื้อตั๋วได้ไม่เกิน ' + MAX_TICKETS_PER_DAY + ' ใบต่อ 24 ชม. (ซื้อไปแล้ว ' + used + ')');
  }
  const stripe = new Stripe(STRIPE_KEY.value());
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'promptpay'],
    line_items: [{
      quantity: 1,
      price_data: { currency: 'thb', unit_amount: p.baht * 100, product_data: { name: p.name } }
    }],
    client_reference_id: uid,
    metadata: { uid: uid, productId: pid },
    payment_intent_data: { metadata: { uid: uid, productId: pid } },
    success_url: SITE_URL + '?paid=1',
    cancel_url: SITE_URL + '?paid=0',
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60
  });
  return { url: session.url };
});

// ---------- ให้ตั๋ว (เรียกจาก webhook เท่านั้น) ----------
async function alertAdmin(type, data) {
  try { await db.collection('cash_alerts').add(Object.assign({ at: Date.now(), type: type }, data || {})); } catch (e) {}
}

async function fulfill(s) {
  const uid = (s.metadata && s.metadata.uid) || s.client_reference_id;
  const p = PRODUCTS[s.metadata && s.metadata.productId];
  if (!uid || !p) { await alertAdmin('bad_metadata', { session: s.id }); return; }
  if (s.currency !== 'thb' || s.amount_total !== p.baht * 100) {
    await alertAdmin('amount_mismatch', { session: s.id, uid: uid, amount: s.amount_total, currency: s.currency });
    return;
  }
  await db.runTransaction(async (tx) => {
    const pref = db.collection('market_payments').doc(s.id);
    const lref = db.collection('cash_limits').doc(uid);
    const r = await Promise.all([tx.get(pref), tx.get(lref)]);
    if (r[0].exists) return;                                   // เคยให้แล้ว (webhook ซ้ำ)
    const now = Date.now();
    const buys = ((r[1].exists && r[1].data().buys) || []).filter(function (x) { return x.t > now - DAY; });
    buys.push({ t: now, n: p.n });
    tx.set(pref, { uid: uid, tk: p.tk, n: p.n, at: now, src: 'stripe', amount: s.amount_total });
    tx.set(db.collection('market_wallets').doc(uid), { tickets: { [p.tk]: FV.increment(p.n) } }, { merge: true });
    tx.set(lref, { buys: buys }, { merge: true });
    tx.set(db.collection('market_audit').doc(), { at: now, type: 'ticket_credit', uid: uid, tk: p.tk, n: p.n, payId: s.id });
  });
}

// ---------- webhook จาก Stripe ----------
exports.stripeWebhook = onRequest({ region: REGION, secrets: [STRIPE_KEY, STRIPE_WH], maxInstances: 5 }, async (req, res) => {
  const stripe = new Stripe(STRIPE_KEY.value());
  let ev;
  try {
    ev = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WH.value());
  } catch (e) {
    res.status(400).send('bad signature');
    return;
  }
  try {
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      const s = ev.data.object;
      if (s.payment_status === 'paid') await fulfill(s);       // พร้อมเพย์/บัตรที่จ่ายสำเร็จแล้วเท่านั้น
    } else if (ev.type === 'charge.refunded' || ev.type === 'charge.dispute.created') {
      // คืนเงิน/ถูกโต้แย้ง: ไม่ตัดตั๋วอัตโนมัติ แต่จดไว้ให้เจ้าของเกมตรวจ (Firestore > cash_alerts)
      const o = ev.data.object;
      await alertAdmin(ev.type, { id: o.id, payment_intent: o.payment_intent || null });
    }
    res.json({ received: true });
  } catch (e) {
    console.error('stripeWebhook', e);
    res.status(500).send('error');                             // ให้ Stripe ลองส่งใหม่
  }
});
