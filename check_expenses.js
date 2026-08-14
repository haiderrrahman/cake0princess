const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "cakeprincess-206e8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'expenses'));
  const snap = await getDocs(q);
  console.log("Total expenses records:", snap.docs.length);
  let total = 0;
  let invExp = 0;
  let nonInvExp = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    const amt = Number(data.amount) || 0;
    total += amt;
    if (data.isInventoryExpense) {
      invExp += amt;
    } else {
      nonInvExp += amt;
    }
    console.log(d.id, data.title, amt, "Inv:", !!data.isInventoryExpense);
  });
  console.log("Total:", total, "InvExp:", invExp, "NonInvExp:", nonInvExp);
}
run();
