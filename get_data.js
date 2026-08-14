const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const needsRef = await db.collection('home_finance').doc('needs').get();
  console.log("Needs:", JSON.stringify(needsRef.data(), null, 2));
  
  const familyNeedsRef = await db.collection('home_finance').doc('familyNeeds').get();
  console.log("FamilyNeeds:", JSON.stringify(familyNeedsRef.data(), null, 2));

  process.exit(0);
}
run();
