import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

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

async function pay() {
  const instRef = doc(db, "home_finance", "installments");
  const expRef = doc(db, "home_finance", "expenses");
  
  const instSnap = await getDoc(instRef);
  const expSnap = await getDoc(expRef);
  
  if (instSnap.exists() && expSnap.exists()) {
    let installments = instSnap.data().data || [];
    let expenses = expSnap.data().data || [];
    
    // Find apartment
    const aptIndex = installments.findIndex(i => i.name.includes("شقة"));
    if (aptIndex !== -1) {
      const apt = installments[aptIndex];
      const paymentAmount = apt.monthlyInstallment; // 433650
      const now = new Date();
      
      const paymentObj = {
        id: Date.now().toString(),
        amount: paymentAmount,
        date: "2026-09-01",
        note: "دفعة مقدمة لشهر التاسع"
      };
      
      apt.payments = [...(apt.payments || []), paymentObj];
      apt.remainingAmount = Math.max(0, apt.remainingAmount - paymentAmount);
      
      installments[aptIndex] = apt;
      
      await updateDoc(instRef, { data: installments });
      console.log("Updated apartment installment successfully.");
      
      // Add expense
      const expenseObj = {
        id: Date.now().toString(),
        name: `${apt.name} (دفعة مقدمة لشهر 9)`,
        amount: paymentAmount,
        category: "أقساط وسلف",
        date: "2026-09-01",
        createdAt: now.toISOString()
      };
      
      expenses = [expenseObj, ...expenses];
      await updateDoc(expRef, { data: expenses });
      console.log("Added expense successfully.");
    } else {
      console.log("Apartment installment not found.");
    }
  }
}
pay();
