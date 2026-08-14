import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

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

async function clearAds() {
  console.log("Clearing ads...");
  const snapshot = await getDocs(collection(db, "ads"));
  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "ads", document.id));
    count++;
  }
  console.log(`Deleted ${count} ads.`);
  process.exit(0);
}

clearAds();
