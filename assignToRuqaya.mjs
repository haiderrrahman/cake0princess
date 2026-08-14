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

async function assign() {
  const docRef = doc(db, "home_finance", "familyNeeds");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data().data || [];
    let updatedCount = 0;
    const newData = data.map(n => {
      // The user explicitly stated: "ما عدا طلب حذاء لايفا" which means "except shoe for Eva"
      // Looking at the list, "حذاء" is assigned to "إيڤا" so its member is not undefined.
      // We will assign all with member === undefined (or null, or not set) to "رقية"
      if (!n.member || n.member === 'undefined') {
        updatedCount++;
        return { ...n, member: 'رقية' };
      }
      return n;
    });
    
    await setDoc(docRef, { data: newData });
    console.log(`Successfully assigned ${updatedCount} items to رقية.`);
  } else {
    console.log("Document does not exist");
  }
  process.exit(0);
}
assign();
