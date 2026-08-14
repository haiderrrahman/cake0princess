import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cakeprincess-2a54a.firebaseapp.com",
  projectId: "cakeprincess-2a54a"
});
const db = getFirestore(app);

getDoc(doc(db, "courses", "3LMaCPxz2VQPlAlN9k2F")).then(snap => {
  const data = snap.data();
  console.log(JSON.stringify(data.curriculum, null, 2));
  process.exit(0);
}).catch(console.error);
