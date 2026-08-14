const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "cakeprincess-206e8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'cake_inventory'));
  const snap = await getDocs(q);
  console.log("Total items:", snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.name.includes("نستلة")) {
      console.log(d.id, data.name, data.quantity, data.neededQuantity);
    }
  });
}
run();
