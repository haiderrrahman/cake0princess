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
  let total = 0;
  let breakdown = {};
  snap.docs.forEach(d => {
    const o = d.data();
    if (["delivered", "completed"].includes(o.status)) {
      const amt = Number(o.price) || 0;
      total += amt;
      if (!breakdown[o.price]) breakdown[o.price] = 0;
      breakdown[o.price] += 1;
    }
  });
  console.log("Total Social Orders Revenue:", total);
  console.log("Breakdown of prices:", breakdown);
  process.exit(0);
}
run();
