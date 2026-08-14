import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

getDoc(doc(db, "courses", "3LMaCPxz2VQPlAlN9k2F")).then(snap => {
  const data = snap.data();
  console.log(JSON.stringify(data.curriculum, null, 2));
  process.exit(0);
});
