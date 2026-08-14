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
  
  items.forEach(i => console.log(`${i.name}: price=${i.price}, qty=${i.quantity}, value=${Number(i.price)*Number(i.quantity)}`));
  process.exit(0);
}
run();
