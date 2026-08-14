import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cakeprincess-2a54a.firebaseapp.com",
  projectId: "cakeprincess-2a54a"
});
const db = getFirestore(app);

getDocs(collection(db, "categories")).then(snap => {
  const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}).catch(console.error);
