const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, getDocs } = require("firebase/firestore");
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

async function test() {
  const d = await getDoc(doc(db, "home_finance", "expenses"));
  console.log("getDoc exists:", d.exists());
  
  const snap = await getDocs(collection(db, "home_finance"));
  console.log("getDocs size:", snap.size);
  snap.forEach(doc => console.log("Doc id:", doc.id));
}
test();
