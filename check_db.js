const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*)'/);
let serviceAccountStr = "";
if (match) {
  serviceAccountStr = match[1];
} else {
  console.log("Could not find key in .env");
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(serviceAccountStr))
});
const db = getFirestore();

async function run() {
  const invDoc = await db.collection("home_finance").doc("inventory").get();
  const inv = invDoc.data()?.data || [];
  
  const needsDoc = await db.collection("home_finance").doc("needs").get();
  const needs = needsDoc.data()?.data || [];
  
  const famDoc = await db.collection("home_finance").doc("familyNeeds").get();
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
          quantity: item.neededQuantity
        });
        item.neededQuantity = 0;
      }
    }
    await db.collection("home_finance").doc("familyNeeds").set({ data: newFamNeeds });
    await db.collection("home_finance").doc("inventory").set({ data: updatedInv });
    console.log("Moved successfully.");
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
