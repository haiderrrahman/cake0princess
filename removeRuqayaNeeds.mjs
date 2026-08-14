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

async function clean() {
  const docRef = doc(db, "home_finance", "familyNeeds");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data().data || [];
    const newData = data.filter(n => n.member !== 'رقية');
    await setDoc(docRef, { data: newData });
    console.log(`Cleaned up ${data.length - newData.length} items from Ruqaya.`);
  } else {
    console.log("Document does not exist");
  }
  process.exit(0);
}
clean();
