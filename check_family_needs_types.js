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
    let pendingNeeds = 0;
    let pendingDuties = 0;
    for (const item of data) {
      if (item.status === "pending") {
        if (item.type === "duty") pendingDuties++;
        else pendingNeeds++;
      }
    }
    console.log(`pending needs (not duty): ${pendingNeeds}`);
    console.log(`pending duties: ${pendingDuties}`);
  }
}
check();
