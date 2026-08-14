import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

async function run() {
  const incomesSnap = await getDoc(doc(db, "home_finance", "incomes"));
  const incomes = incomesSnap.data()?.data || [];
  
  for (const inc of incomes) {
    console.log(`Income: ${inc.amount} on date: ${inc.date}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
