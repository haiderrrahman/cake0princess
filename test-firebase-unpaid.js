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
  const billsSnap = await getDoc(doc(db, "home_finance", "bills"));
  const instSnap = await getDoc(doc(db, "home_finance", "installments"));
  
  const bills = billsSnap.data()?.data || [];
  const installments = instSnap.data()?.data || [];

  const start = new Date(2026, 6, 14); // July 14, 2026 (local time)
  const end = new Date(2026, 7, 13); // Aug 13, 2026

  const isInCycle = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    return d >= start && d <= end;
  };
  
  const isBillPaidThisCycle = (b) => b.payments && b.payments.some(p => isInCycle(p.date));
  const unpaidBillsAmt = bills.filter(b => !isBillPaidThisCycle(b)).reduce((s, b) => s + b.amount, 0);

  const isInstallmentOwedThisCycle = (i) => {
    if (i.payments.some(p => isInCycle(p.date))) return false;
    if (!i.startDate) return true;
    const startD = new Date(i.startDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - startD.getFullYear()) * 12 + (now.getMonth() - startD.getMonth());
    const requiredPayments = monthsElapsed + 1;
    const paidMonths = (i.initialPaidMonths || 0) + i.payments.length;
    return paidMonths < requiredPayments;
  };
  
  const unpaidInstallmentsMonthly = installments.filter(i => isInstallmentOwedThisCycle(i)).reduce((s, i) => s + i.monthlyInstallment, 0);
  
  console.log("Unpaid Bills:", unpaidBillsAmt);
  console.log("Unpaid Installments:", unpaidInstallmentsMonthly);
  console.log("Total unpaid:", unpaidBillsAmt + unpaidInstallmentsMonthly);
}
run().then(() => process.exit(0)).catch(console.error);
