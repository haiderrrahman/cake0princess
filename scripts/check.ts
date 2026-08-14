import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function check() {
  const snap = await getDocs(collection(db, "cake_inventory"));
  const items = snap.docs.map(d => d.data());
  let totalBySummingPrice = 0;
  let totalBySummingPriceTimesQuantity = 0;
  items.forEach(i => {
    const p = Number(i.price || 0);
    const q = Number(i.quantity || 0);
    totalBySummingPrice += p;
    totalBySummingPriceTimesQuantity += (p * q);
  });
  console.log('Total if price is TotalPrice:', totalBySummingPrice);
  console.log('Total if price is UnitPrice (price * qty):', totalBySummingPriceTimesQuantity);
}
check().catch(console.error);
