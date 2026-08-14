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
  const snap = await getDocs(collection(db, "cake_inventory"));
  const items = snap.docs.map(d => ({id: d.id, ...d.data()}));
  
  let valMath1 = 0;
  let valMath2 = 0;
  
  items.forEach(i => {
     const price = Number(i.price || 0);
     const qty = Number(i.quantity || 0);
     valMath1 += price * qty;
     valMath2 += price;
  });
  
  console.log("Total Items:", items.length);
  console.log("valMath1 (price * qty):", valMath1);
  console.log("valMath2 (sum of price):", valMath2);
  
  // Show a few items:
  console.log("Sample items:");
  items.slice(0, 5).forEach(i => console.log(`${i.name}: price=${i.price}, qty=${i.quantity}`));
}
run();
