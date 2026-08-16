const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
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
  const snap = await getDocs(collection(db, "expenses"));
  let total = 0;
  let augustTotal = 0;
  
  const now = new Date(); // August 2026
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  snap.forEach(doc => {
    const data = doc.data();
    const d = new Date(data.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      augustTotal += (Number(data.amount) || 0);
    }
    total += (Number(data.amount) || 0);
  });
  console.log(`Total expenses: ${total}`);
  console.log(`August expenses: ${augustTotal}`);
}
check();
