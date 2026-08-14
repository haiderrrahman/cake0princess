const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  const snap = await getDocs(collection(db, "cake_inventory"));
  const inventory = snap.docs.map(d => d.data());
  
  const INVENTORY_CATEGORIES = ["طحين وسكر", "كريمات", "حشوات", "شوكولاتة وكاكاو", "ألوان وإضافات", "منكهات وعطور", "عجينة سكر", "فواكه ومكسرات", "تغليف وزينة", "مستهلكات", "قوالب وصواني", "أدوات", "أخرى"];

  const filteredInventory = inventory;
  const topTotal = filteredInventory.filter(i => Number(i.quantity) > 0).length;

  let listsTotal = 0;
  INVENTORY_CATEGORIES.map(cat => {
    const catItems = filteredInventory.filter(item => {
      const itemCat = item.category || "أخرى";
      const matchesCat = itemCat === cat || (cat === "أخرى" && !INVENTORY_CATEGORIES.includes(itemCat));
      return matchesCat && Number(item.quantity) > 0;
    });
    listsTotal += catItems.length;
    if (catItems.length > 0) {
      console.log(`Cat ${cat}:`, catItems.map(i => ({ name: i.name, qty: i.quantity, cat: i.category })));
    }
  });

  console.log({ topTotal, listsTotal });
  process.exit(0);
}
run();
