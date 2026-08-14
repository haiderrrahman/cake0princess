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

const DEMO_COURSES = [
  { id: "course-1", title: "ماستر كلاس صناعة الكيك الشاملة", price: 75000, thumbnail: "https://images.unsplash.com/photo-1556910103-1c02745a8720?w=400&q=80", rating: "4.9", students: "2.3k", duration: "8 ساعات", level: "احترافي", description: "دورة شاملة تأخذك من الصفر إلى الاحتراف في عالم صناعة الكيك", locked: false },
  { id: "course-2", title: "فن تزيين الكيك بالكريمة والفوندان", price: 55000, thumbnail: "https://images.unsplash.com/photo-1486427944781-dbf45f4823a0?w=400&q=80", rating: "4.8", students: "1.8k", duration: "6 ساعات", level: "متوسط", description: "تعلم أساليب وتقنيات التزيين الحديثة", locked: false },
  { id: "course-3", title: "كيكات الفوندان والعجائن الفنية", price: 65000, thumbnail: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&q=80", rating: "5.0", students: "980", duration: "5 ساعات", level: "متقدم", description: "أسرار الفوندان والزخارف الفنية المتقدمة", locked: false },
  { id: "course-4", title: "كيك الأعراس والمناسبات الخاصة", price: 85000, thumbnail: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&q=80", rating: "4.9", students: "650", duration: "10 ساعات", level: "احترافي", description: "تعلم صناعة كيكات الأعراس الفاخرة", locked: true },
  { id: "course-5", title: "الكيك الصحي وبدائل السكر", price: 45000, thumbnail: "https://images.unsplash.com/photo-1562440499-64c9a111f713?w=400&q=80", rating: "4.7", students: "1.2k", duration: "4 ساعات", level: "مبتدئ", description: "وصفات كيك صحية بمكونات طبيعية", locked: false },
  { id: "course-6", title: "دورة كيك الشاي والطاوة", price: 25000, thumbnail: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80", rating: "4.8", students: "2.1k", duration: "2 ساعات", level: "مبتدئ", description: "تعلم طرق عمل كيك الشاي الهش بأنواعه وكيك الطاوة السريع واللذيذ.", locked: false },
];

async function seedCourses() {
  try {
    const coursesCol = collection(db, 'courses');
    for (const c of DEMO_COURSES) {
      const { id, ...data } = c;
      const docRef = doc(coursesCol, id);
      await setDoc(docRef, data);
      console.log(`Added course: ${c.title}`);
    }
    console.log("Seeding courses complete.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding courses:", error);
    process.exit(1);
  }
}

seedCourses();
