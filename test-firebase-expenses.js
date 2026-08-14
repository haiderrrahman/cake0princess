import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

async function run() {
  const expensesSnap = await getDoc(doc(db, "home_finance", "expenses"));
  const expenses = expensesSnap.data()?.data || [];
  const start = new Date(2026, 6, 14); // July 14, 2026 (local time)
  const end = new Date(2026, 7, 13); // Aug 13, 2026

  const isInCycle = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    return d >= start && d <= end;
  };
  
  const inCycle = expenses.filter(e => isInCycle(e.date));
  console.log("In-cycle expenses:");
  for (const e of inCycle) {
    console.log(`- ${e.description} | ${e.amount} | ${e.category} | Paid By: ${e.paidBy}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
