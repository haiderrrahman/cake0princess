import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const config = {};
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_FIREBASE_')) {
    const [key, value] = line.split('=');
    config[key.replace('NEXT_PUBLIC_FIREBASE_', '').replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace('Api', 'api').replace('Auth', 'auth').replace('Project', 'project').replace('Storage', 'storage').replace('Messaging', 'messaging').replace('App', 'app').replace('Measurement', 'measurement')] = value.replace(/"/g, '').replace(/'/g, '');
  }
});

// Fix config casing
const finalConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
  measurementId: config.measurementId
};

const app = initializeApp(finalConfig);
const db = getFirestore(app);

async function run() {
  const [extSnap, ordersSnap, storeSnap] = await Promise.all([
    getDocs(collection(db, "external_orders")),
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "store_sales"))
  ]);

  let sumExtPrice = 0;
  let sumExtPaid = 0;
  extSnap.docs.forEach(d => {
    const o = d.data();
    if (["delivered", "completed"].includes(o.status)) {
       sumExtPrice += Number(o.price || 0);
       const price = Number(o.price || 0);
       const paid = Number(o.paidAmount ?? price);
       const isDebt = o.paidAmount !== undefined && paid !== price && !o.isDebtSettled;
       let received = price;
       if (isDebt) {
         const diff = price - paid;
         if (diff > 0) received = paid; // Customer owes us
         else received = price; // We owe customer
       }
       sumExtPaid += received;
    }
  });

  console.log("Social (sum price):", sumExtPrice);
  console.log("Social (sum received):", sumExtPaid);
}
run();
