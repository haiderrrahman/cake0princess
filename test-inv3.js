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
  
  items.forEach(i => {
    if (Number(i.quantity) <= Number(i.minAlert)) {
      console.log(`SHORTAGE: ${i.name}: price=${i.price}, qty=${i.quantity}, minAlert=${i.minAlert}, needed=${i.neededQuantity}`);
    }
  });
  process.exit(0);
}
run();
