import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

const products = [
  {
    name: "كيكة الزفاف الملكية",
    description: "كيكة فاخرة تتكون من 3 طبقات محشوة حسب اختيارك، مزينة بالورد الطبيعي وعجينة السكر اللامعة. مثالية لحفلات الزفاف والخطوبة.",
    price: 150000,
    rating: 5.0,
    category: "كيك الزفاف والخطوبة",
    image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة الشوكولاتة الغنية",
    description: "عشاق الشوكولاتة، هذه الكيكة لكم! كيك إسفنجي غني بالشوكولاتة البلجيكية، مغطاة بجاناش الشوكولاتة اللذيذ.",
    price: 35000,
    rating: 4.8,
    category: "الكيك اليومي والكلاسيكي",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة الفراولة والشانتيه",
    description: "كيكة خفيفة ومنعشة بطعم الفانيلا، محشوة بقطع الفراولة الطازجة وكريمة الشانتيه اللذيذة.",
    price: 30000,
    rating: 4.9,
    category: "كيك أعياد الميلاد",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة التخرج الذهبية",
    description: "تصميم أنيق باللونين الأسود والذهبي مع قبعة التخرج، للاحتفال بنجاحكم وتفوقكم.",
    price: 45000,
    rating: 4.7,
    category: "كيك التخرج والنجاح",
    image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة فكتوريا سبونج",
    description: "كيكة فكتوريا سبونج كلاسيكية مع مربى الفراولة والكريمة المخفوقة.",
    price: 32000,
    rating: 4.7,
    category: "الكيك اليومي والكلاسيكي",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة اليونيكورن للأطفال",
    description: "كيكة ساحرة بألوان قوس قزح وتصميم اليونيكورن المحبب للأطفال، لإضافة بهجة لعيد ميلاد طفلك.",
    price: 40000,
    rating: 5.0,
    category: "كيك الأطفال",
    image: "https://images.unsplash.com/photo-1616690710400-a16d146927c5?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة الشاي الكلاسيكية",
    description: "كيكة الشاي الهشة والخفيفة بطعم الفانيلا والبرتقال، مثالية مع كوب من الشاي الساخن.",
    price: 15000,
    rating: 4.8,
    category: "كيك الشاي والطاوة",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة الطاوة السريعة",
    description: "كيكة الطاوة اللذيذة والساخنة، تقدم مع صوص الشوكولاتة والكراميل.",
    price: 12000,
    rating: 4.9,
    category: "كيك الشاي والطاوة",
    image: "https://images.unsplash.com/photo-1540337706094-da10342c93d8?q=80&w=800&auto=format&fit=crop"
  },
  {
    name: "كيكة الريد فيلفيت المخملية",
    description: "كيكة الريد فيلفيت الشهيرة مع كريمة الجبن الناعمة.",
    price: 35000,
    rating: 4.9,
    category: "الكيك اليومي والكلاسيكي",
    image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?q=80&w=800&auto=format&fit=crop"
  }
];

const courses = [
  {
    title: "الماستر كلاس الشامل: من مبتدئ إلى شيف محترف",
    price: 45000,
    originalPrice: 80000,
    rating: "4.9",
    duration: "5.5 ساعات",
    students: "1.2k",
    level: "احترافي",
    image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "في هذه الدورة ستتعلم أسرار خبز الكيك الهش، طرق الحشوات المختلفة، وتغليف الكيك بعجينة السكر وكريمة الزبدة السويسرية باحترافية تحت إشراف الأميرة.",
    learningPoints: [
      "أساسيات خبز الكيك الإسفنجي الهش",
      "صنع كريمة الزبدة السويسرية الناعمة",
      "تكنيك الحواف الحادة (Sharp Edges)",
      "أساسيات التلوين ودمج الألوان",
      "نصائح لتخزين الكيك وتوصيله بأمان"
    ],
    curriculum: [
      { title: "مقدمة الدورة والأدوات المطلوبة", time: "15:20", type: "video", free: true },
      { title: "وصفة الكيك الإسفنجي المعتمدة", time: "45:00", type: "video", free: false },
      { title: "ملف الوصفات والمقادير (PDF)", time: "12 صفحة", type: "doc", free: false },
      { title: "طريقة عمل الحشوات المتنوعة", time: "55:30", type: "video", free: false },
      { title: "تكنيك الحواف الحادة والتغليف", time: "01:10:00", type: "video", free: false }
    ],
    videoPreviewUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "أسرار تزيين كيك الزفاف بالورد الجوري",
    price: 30000,
    originalPrice: 50000,
    rating: "5.0",
    duration: "3 ساعات",
    students: "850",
    level: "متوسط",
    image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "تعلم كيفية تزيين كيكات الزفاف الفاخرة باستخدام الورود، ترتيب الطبقات بأمان، ونقلها بدون أضرار.",
    learningPoints: [
      "ترتيب وتثبيت الكيك متعدد الطوابق",
      "تنسيق الورود الطبيعية والصناعية على الكيك",
      "نصائح لتجنب ذوبان الكريمة في الحفلات"
    ],
    curriculum: [
      { title: "مقدمة عن كيك الزفاف", time: "10:00", type: "video", free: true },
      { title: "تركيب الطوابق والتثبيت", time: "30:00", type: "video", free: false },
      { title: "تنسيق الورد النهائي", time: "40:00", type: "video", free: false }
    ],
    videoPreviewUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "دورة كيكة الفواكه الموسمية",
    price: 28000,
    originalPrice: 45000,
    rating: "4.9",
    duration: "2.5 ساعات",
    students: "1.5k",
    level: "مبتدئ",
    image: "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "تعلم كيفية إعداد كيك الفواكه المنعش وتزيينه بالفواكه الطازجة وطبقة الجيلي اللامعة.",
    learningPoints: [
      "اختيار أفضل أنواع الفواكه للزينة",
      "تحضير طبقة الجيلي الشفافة",
      "تنسيق الفواكه بشكل احترافي"
    ],
    curriculum: [
      { title: "أساسيات الفواكه والكيك", time: "15:00", type: "video", free: true },
      { title: "تحضير الكيك والطبقة الأساسية", time: "30:00", type: "video", free: false },
      { title: "التزيين النهائي", time: "45:00", type: "video", free: false }
    ],
    videoPreviewUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    title: "دورة كيك الشاي والطاوة",
    price: 25000,
    originalPrice: 40000,
    rating: "4.8",
    duration: "2 ساعات",
    students: "2.1k",
    level: "مبتدئ",
    image: "https://images.unsplash.com/photo-1519869325930-281384150729?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "في هذه الدورة سنتعلم طرق عمل كيك الشاي الهش بأنواعه (بالبرتقال، الفانيلا، والرخامي)، بالإضافة إلى كيك الطاوة السريع واللذيذ.",
    learningPoints: [
      "أسرار هشاشة كيك الشاي",
      "طريقة عمل كيك الطاوة بدون فرن",
      "صلصات التغطية السريعة"
    ],
    curriculum: [
      { title: "مقدمة ومقادير كيك الشاي", time: "10:00", type: "video", free: true },
      { title: "كيكة الشاي بالبرتقال", time: "25:00", type: "video", free: false },
      { title: "كيك الطاوة بصوص الشوكولاتة", time: "20:00", type: "video", free: false }
    ],
    videoPreviewUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

async function runSeeder() {
  console.log("Starting seeder...");

  // Delete existing products
  const productsSnapshot = await getDocs(collection(db, "products"));
  console.log(`Deleting ${productsSnapshot.docs.length} existing products...`);
  for (const docSnap of productsSnapshot.docs) {
    await deleteDoc(doc(db, "products", docSnap.id));
  }

  // Insert new products
  console.log(`Inserting ${products.length} new products...`);
  for (const product of products) {
    await addDoc(collection(db, "products"), product);
  }

  // Delete existing courses
  const coursesSnapshot = await getDocs(collection(db, "courses"));
  console.log(`Deleting ${coursesSnapshot.docs.length} existing courses...`);
  for (const docSnap of coursesSnapshot.docs) {
    await deleteDoc(doc(db, "courses", docSnap.id));
  }

  // Insert new courses
  console.log(`Inserting ${courses.length} new courses...`);
  for (const course of courses) {
    await addDoc(collection(db, "courses"), course);
  }

  console.log("Seeding completed successfully!");
}

runSeeder()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
