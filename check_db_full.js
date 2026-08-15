const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, collection, getDocs } = require("firebase/firestore");
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
  console.log("Checking home_finance...");
  const hfDocs = ["settings", "expenses", "incomes", "bills", "installments", "familyNeeds", "debts"];
  for (const k of hfDocs) {
    const d = await getDoc(doc(db, "home_finance", k));
    if (d.exists()) {
      console.log(`- home_finance/${k}: ${d.data().data ? d.data().data.length : 'no array'} items`);
    } else {
      console.log(`- home_finance/${k}: NOT FOUND`);
    }
  }

  console.log("\nChecking independent collections...");
  const cols = ["finances", "home_finance", "expenses", "incomes", "familyNeeds"];
  for (const c of cols) {
    const snap = await getDocs(collection(db, c));
    console.log(`- collection ${c}: ${snap.size} documents`);
  }
  process.exit(0);
}
check();
