require('dotenv').config({ path: '.env' });
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  const needsRef = doc(db, "home_finance", "needs");
  const familyNeedsRef = doc(db, "home_finance", "familyNeeds");
  
  const needsSnap = await getDoc(needsRef);
  const familySnap = await getDoc(familyNeedsRef);
  
  let needs = needsSnap.exists() ? needsSnap.data().data || [] : [];
  let familyNeeds = familySnap.exists() ? familySnap.data().data || [] : [];
  
  // Find needs that are not bought
  let unboughtNeeds = needs.filter(n => !n.isBought);
  
  if (unboughtNeeds.length > 0) {
    console.log(`Moving ${unboughtNeeds.length} items to Ruqayya's family needs...`);
    for (let need of unboughtNeeds) {
      familyNeeds.push({
        id: need.id,
        member: "رقية",
        title: need.name,
        category: need.category || "عائلة",
        quantity: need.quantity || 1,
        status: "pending",
        createdAt: need.createdAt || new Date().toISOString()
      });
    }
    
    // Set needs to only bought ones
    await setDoc(needsRef, { data: needs.filter(n => n.isBought) });
    await setDoc(familyNeedsRef, { data: familyNeeds });
    console.log("Migration complete!");
  } else {
    console.log("No unbought needs to migrate.");
  }
  process.exit(0);
}
migrate().catch(console.error);
