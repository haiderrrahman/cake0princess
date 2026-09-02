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
  const snap = await getDocs(collection(db, "external_orders"));
  let totalPrice = 0;
  let totalPaid = 0;
  let totalProfit = 0;
  snap.docs.forEach(d => {
    const o = d.data();
    if (["delivered", "completed"].includes(o.status)) {
      const price = Number(o.price) || 0;
      const paid = o.paidAmount !== undefined ? Number(o.paidAmount) : price;
      
      totalPrice += price;
      totalPaid += paid;
      totalProfit += Number(o.profit) || 0;
    }
  });
  console.log("Total Price (Expected):", totalPrice);
  console.log("Total Paid (Received):", totalPaid);
  console.log("Total Profit:", totalProfit);
  process.exit(0);
}
run();
