import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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
  const docRef = doc(db, "home_finance", "familyNeeds");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data().data || [];
    console.log(`Found ${data.length} total items in familyNeeds.`);
    const pending = data.filter(n => n.status === "pending");
    console.log(`Found ${pending.length} pending items.`);
    pending.forEach(n => console.log(`- ID: ${n.id}, Title: ${n.title}, Member: ${n.member}`));
  } else {
    console.log("Document does not exist");
  }
  process.exit(0);
}
check();
