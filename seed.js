const { initializeApp } = require("firebase/app");
const { getFirestore, setDoc, doc, getDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  projectId: "cake-publisher-app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ruqayyaItems = [
    { title: "غسول وجه", category: "العناية" },
    { title: "مقشر وجه", category: "العناية" },
    { title: "ماسك الانف", category: "العناية" },
    { title: "واقي تحت العين", category: "العناية" },
    { title: "ماسك الفم", category: "العناية" },
    { title: "مرطب شفة", category: "العناية" },
    { title: "مرطب اقدام", category: "العناية" },
    { title: "واقي شمس", category: "العناية" },
    { title: "ماسكات", category: "العناية" },
    { title: "الصيدلية", category: "العناية" },
    { title: "علاج للتشققات", category: "العناية" },
    { title: "تحاليل عامة", category: "العناية" },
    { title: "سونار", category: "العناية" },
    { title: "فحص الجسم", category: "العناية" },
    { title: "تقويم اسنان", category: "العناية" },
    { title: "فيتامينات", category: "العناية" },
    { title: "دكتورة جلدية", category: "العناية" },
    { title: "تراكسود رياضي أسود + نيلي", category: "الملابس" },
    { title: "ملابس بيت", category: "الملابس" },
    { title: "هاينك اسود", category: "الملابس" },
    { title: "هاينك ابيض", category: "الملابس" },
    { title: "بنطلونات اسود + رصاصي + نيلي + ابيض", category: "الملابس" },
    { title: "قمصان (3) بالوان مختلفة وحلوة", category: "الملابس" },
    { title: "ملابس داخلية بالوان مختلفة", category: "الملابس" },
    { title: "كب لون اسود نوعية زينة + ابيض", category: "المحجبات" },
    { title: "شال مطاطي الينزله على الراس لون ابيض + الأسود سادة", category: "المحجبات" },
    { title: "شال جريرت اسود + ابيض + الوان مختلفة", category: "المحجبات" },
    { title: "كاسكيتة سودة وسادة", category: "المحجبات" },
    { title: "دبابيس ابو راسين", category: "المحجبات" },
    { title: "دبابيس ناعمة ام الراس", category: "المحجبات" },
    { title: "خاتم فضة ونازك", category: "الاكسسوارات" },
    { title: "سوار فضة (شذر ابيض ونازك + لوليات صغار)", category: "الاكسسوارات" },
    { title: "تراجي لون فضي", category: "الاكسسوارات" },
    { title: "سوار ابل جات", category: "الاكسسوارات" },
    { title: "عطر ريحة طيبة وباردة", category: "الاكسسوارات" },
    { title: "جنط (3) لون اسود، ماروني (خشب)، جوزي (فاتح)", category: "الاكسسوارات" },
    { title: "ميكاب اساسي (ايلاينر + ماسكارا + مرطب + برايمر)", category: "الاكسسوارات" },
    { title: "مكينة براون الاصلية", category: "الاكسسوارات" },
    { title: "حذاء رياضي ابيض", category: "الاكسسوارات" },
    { title: "حذاء اسود سبورت", category: "الاكسسوارات" },
    { title: "نعال طلعة مريح", category: "الاكسسوارات" },
    { title: "حذاء فلات ابيض + اسود + جوزي + ماروني", category: "الاكسسوارات" }
  ].map(i => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    title: i.title,
    person: "رقية",
    category: i.category,
    status: "pending",
    addedAt: new Date().toISOString()
  }));

async function seed() {
  const docRef = doc(db, "home_finance", "familyNeeds");
  const d = await getDoc(docRef);
  let existing = [];
  if (d.exists()) {
     existing = d.data().data || [];
  }
  const merged = [...existing, ...ruqayyaItems];
  await setDoc(docRef, { data: merged });
  console.log("Done!");
}
seed().catch(console.error);
