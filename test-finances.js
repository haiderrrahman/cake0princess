import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cake-publisher-app.firebaseapp.com",
  projectId: "cake-publisher-app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "expenses"));
  const expenses = snap.docs.map(d => ({id: d.id, ...d.data()}));
  
  let totalCakeMaterials = 0;
  expenses.forEach(e => {
      const cat = e.category || "";
      const desc = e.description || e.title || "";
      const amt = Number(e.amount || 0);
      if (cat === "مشتريات مخزنية" || cat === "مواد الكيك" || cat === "مواد كيك" || cat === "المواد الأولية (كيك وكريمة)" || 
          desc.includes("المخزن") || desc.includes("مادة") || desc.includes("مواد")) {
          totalCakeMaterials += amt;
      }
  });
  console.log("Total Cake Materials Expense:", totalCakeMaterials);
  process.exit(0);
}
run();
