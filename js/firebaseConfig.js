const firebaseConfig = {
  apiKey: "AIzaSyBwG7JfdcapCtReWhjdQYESMSwcvj49Eas",
  authDomain: "newworld-ae666.firebaseapp.com",
  projectId: "newworld-ae666",
  storageBucket: "newworld-ae666.firebasestorage.app",
  messagingSenderId: "737392014141",
  appId: "1:737392014141:web:fdaee4c497acba37308b54"
};

window.firebaseConfig = firebaseConfig;
window.FIREBASE_CONFIG = firebaseConfig;

if (typeof firebase === "undefined") {
  console.error("Firebase SDK ยังไม่ถูกโหลด: เช็กลำดับ script ใน index.html");
} else {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.auth = firebase.auth();
  window.firebaseReady = true;
}
