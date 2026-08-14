const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, getDoc, setDoc } = require("firebase/firestore");

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
  const invDoc = await getDoc(doc(db, "home_finance", "inventory"));
  const inv = invDoc.data()?.data || [];
  
  const famDoc = await getDoc(doc(db, "home_finance", "familyNeeds"));
  const fam = famDoc.data()?.data || [];
  
  const neededItems = inv.filter(i => i.neededQuantity > 0);
  console.log("Inventory items with neededQuantity > 0:", neededItems.map(i => i.name));
  
  if (neededItems.length > 0) {
    console.log("Moving them to Ruqayya...");
    const newFamNeeds = [...fam];
    const updatedInv = [...inv];
    for (let item of updatedInv) {
      if (item.neededQuantity > 0) {
        newFamNeeds.push({
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          title: item.name,
          category: item.category || "عائلة",
          status: "pending",
          member: "رقية",
          createdAt: new Date().toISOString(),
          quantity: item.neededQuantity,
          details: item.details || ""
        });
        item.neededQuantity = 0;
      }
    }
    await setDoc(doc(db, "home_finance", "familyNeeds"), { data: newFamNeeds });
    await setDoc(doc(db, "home_finance", "inventory"), { data: updatedInv });
    console.log("Moved successfully.");
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
