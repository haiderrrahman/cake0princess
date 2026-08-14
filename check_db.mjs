import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: "cake-publisher-app",
  };
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function checkCollections() {
  const collections = ['products', 'courses', 'banners', 'supplies', 'categories'];
  for (const col of collections) {
    const snapshot = await db.collection(col).get();
    console.log(`Collection ${col} has ${snapshot.size} documents.`);
  }
}

checkCollections().catch(console.error);
