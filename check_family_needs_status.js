const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc } = require("firebase/firestore");
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

async function check() {
  const d = await getDoc(doc(db, "home_finance", "familyNeeds"));
  if (d.exists()) {
    const data = d.data().data || [];
    let pending = 0;
    let available = 0;
    for (const item of data) {
      if (item.status === "pending") pending++;
      else if (item.status === "available") available++;
    }
    console.log(`familyNeeds: ${data.length} total, ${pending} pending, ${available} available`);
  }
}
check();
