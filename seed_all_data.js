const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

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

const categories = [
  { id: "أعياد ميلاد", name: "أعياد ميلاد", image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?w=800&q=80" },
  { id: "زفاف", name: "زفاف", image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&q=80" },
  { id: "مناسبات", name: "مناسبات", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80" },
  { id: "يومي", name: "يومي", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&q=80" },
  { id: "كيك الشاي والطاوة", name: "كيك الشاي والطاوة", image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&q=80" }
];

const newProducts = [
  { name: "كيكة الفراولة الملكية", price: 45000, image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80", category: "أعياد ميلاد" },
  { name: "تشيز كيك التوت", price: 35000, image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=800&q=80", category: "يومي" },
  { name: "كيكة الشوكولا الداكنة", price: 55000, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80", category: "مناسبات" },
  { name: "ريد فيلفت فاخرة", price: 50000, image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=800&q=80", category: "زفاف" },
  { name: "كيكة الكراميل المملحة", price: 40000, image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=800&q=80", category: "يومي" },
  { name: "كيكة الشاي الكلاسيكية", price: 15000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&q=80", category: "كيك الشاي والطاوة" },
  { name: "كيكة الطاوة السريعة", price: 12000, image: "https://images.unsplash.com/photo-1540337706094-da10342c93d8?w=800&q=80", category: "كيك الشاي والطاوة" },
  { name: "كيكة الليمون المنعشة", price: 25000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&q=80", category: "يومي" },
  { name: "باقة كب كيك المشكلة", price: 20000, image: "https://images.unsplash.com/photo-1486427944781-dbf45f4823a0?w=800&q=80", category: "أعياد ميلاد" },
  { name: "كيكة الزفاف الملكية (طابقين)", price: 150000, image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800&q=80", category: "زفاف" },
];

async function seedData() {
  try {
    const catsCol = collection(db, 'categories');
    for (const c of categories) {
      const { id, ...data } = c;
      const docRef = doc(catsCol, id);
      await setDoc(docRef, data);
      console.log(`Added category: ${c.name}`);
    }

    const prodsCol = collection(db, 'products');
    let count = 1;
    for (const p of newProducts) {
      const docRef = doc(prodsCol, `auto-gen-${count}`);
      await setDoc(docRef, p);
      console.log(`Added product: ${p.name}`);
      count++;
    }

    console.log("Seeding complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
}

seedData();
