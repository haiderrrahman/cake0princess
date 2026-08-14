const { initializeApp } = require("firebase/app");
const { getFirestore, doc, onSnapshot } = require("firebase/firestore");
const firebaseConfig = {
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cake-publisher-app.firebaseapp.com",
  projectId: "cake-publisher-app",
  storageBucket: "cake-publisher-app.firebasestorage.app",
  messagingSenderId: "112876760850",
  appId: "1:112876760850:web:d5144e5abf764372408dcb"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const unsub = onSnapshot(doc(db, "home_finance", "bills"), (snap) => {
  console.log("EXISTS:", snap.exists());
  if (snap.exists()) {
    console.log("DATA LENGTH:", snap.data().data ? snap.data().data.length : 'no data array');
  }
  process.exit(0);
}, (err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
