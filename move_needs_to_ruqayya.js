const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore();

async function moveNeeds() {
  const invDoc = await db.collection("home_finance").doc("inventory").get();
  if (!invDoc.exists) {
    console.log("No inventory doc");
    return;
  }
  
  const inventoryData = invDoc.data().data || [];
  
  const famDoc = await db.collection("home_finance").doc("familyNeeds").get();
  let familyNeedsData = famDoc.exists ? famDoc.data().data || [] : [];
  
  let changed = false;
  let movedCount = 0;
  
  const updatedInventory = inventoryData.map(item => {
    if (item.neededQuantity > 0) {
      familyNeedsData.push({
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        title: item.name,
        category: item.category || "عائلة",
        status: "pending",
        member: "رقية",
        createdAt: new Date().toISOString(),
        quantity: item.neededQuantity
      });
      movedCount++;
      changed = true;
      return { ...item, neededQuantity: 0 };
    }
    return item;
  });
  
  if (changed) {
    await db.collection("home_finance").doc("familyNeeds").set({ data: familyNeedsData });
    await db.collection("home_finance").doc("inventory").set({ data: updatedInventory });
    console.log(`Moved ${movedCount} items from Needs to Ruqayya's family needs.`);
  } else {
    console.log("No items with neededQuantity > 0 found in inventory.");
  }
}

moveNeeds().then(() => process.exit(0)).catch(console.error);
