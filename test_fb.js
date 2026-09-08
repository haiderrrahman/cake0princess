const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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

async function check() {
  const inv = await getDoc(doc(db, "home_finance", "inventory"));
  const car = await getDoc(doc(db, "home_finance", "carInventory"));
  const travel = await getDoc(doc(db, "home_finance", "travelInventory"));
  console.log("inventory count:", inv.exists() ? (inv.data().data?.length || 0) : 0);
  console.log("car count:", car.exists() ? (car.data().data?.length || 0) : 0);
  console.log("travel count:", travel.exists() ? (travel.data().data?.length || 0) : 0);
  process.exit(0);
}
check();
