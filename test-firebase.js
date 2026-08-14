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
  const incomesSnap = await getDoc(doc(db, "home_finance", "incomes"));
  const expensesSnap = await getDoc(doc(db, "home_finance", "expenses"));

  const incomes = incomesSnap.data()?.data || [];
  const expenses = expensesSnap.data()?.data || [];

  const start = new Date(2026, 6, 14); // July 14, 2026 (local time)
  const end = new Date(2026, 7, 13); // Aug 13, 2026

  const isInCycle = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    return d >= start && d <= end;
  };

  const totalIncome = incomes.filter(i => isInCycle(i.date)).reduce((s, i) => s + Number(i.amount), 0);
  const totalExpensesAmt = expenses.filter(e => isInCycle(e.date)).reduce((s, e) => s + Number(e.amount), 0);
  const balance = totalIncome - totalExpensesAmt;

  console.log("Total Income:", totalIncome);
  console.log("Total Expenses:", totalExpensesAmt);
  console.log("Balance:", balance);
  
  console.log("Total INCOMES (ALL):", incomes.reduce((s,i) => s + Number(i.amount), 0));
  console.log("Total EXPENSES (ALL):", expenses.reduce((s,i) => s + Number(i.amount), 0));
}
run().then(() => process.exit(0)).catch(console.error);
