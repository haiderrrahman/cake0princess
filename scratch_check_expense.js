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

async function check() {
  const docRef = doc(db, "home_finance", "expenses");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data().data || [];
    console.log("Found", data.length, "expenses.");
    const recent = data.slice(0, 10);
    // console.log("Recent expenses:", JSON.stringify(recent, null, 2));
    
    // Check if 750000 exists this month
    const thisMonth = new Date().toISOString().substring(0, 7); // e.g. 2026-08
    const paid750 = data.find(e => e.amount === 750000 && e.date && e.date.startsWith(thisMonth));
    if (paid750) {
      console.log("750k expense already exists:", paid750);
    } else {
      console.log("750k expense NOT found this month.");
      // Add it
      const expense = {
        id: Date.now().toString(),
        name: "قسط سلفة (مضاف يدوياً)",
        category: "أقساط وسلف",
        amount: 750000,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      };
      const updated = [expense, ...data];
      await updateDoc(docRef, { data: updated });
      console.log("Successfully added 750k expense.");
    }
  } else {
    console.log("No expenses doc found.");
  }
}
check();
