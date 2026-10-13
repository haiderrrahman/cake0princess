/**
 * قائمة أقسام وفئات المنتجات والمواد التسويقية مرتبة حسب الأهمية والأولويات
 * مع محرك التنبؤ الذكي التلقائي بالفئة حسب اسم المنتج
 */

export interface ProductCategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgLight: string;
  bgDark: string;
  keywords: string[];
}

export const PRODUCT_CATEGORIES: ProductCategoryDef[] = [
  {
    id: "fruits_veg",
    name: "الفواكه والخضار",
    icon: "🍌",
    color: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-200",
    bgDark: "dark:bg-emerald-950/40 dark:border-emerald-800/60",
    keywords: [
      "طماطة", "طماطم", "خيار", "بصل", "بطاطا", "بتيتة", "موز", "تفاح", "برتقال", "عنب",
      "رقي", "بطيخ", "خضار", "مخضر", "فواكه", "ليمون", "جزر", "باذنجان", "فلفل", "ثوم",
      "خس", "بقدونس", "كرفس", "نعناع", "رمان", "فراولة", "كيوي", "خوخ", "مشمش", "تين",
      "كرز", "اجاص", "عرموط", "سلق", "لهانة", "قرنابيط", "بامية", "لوبيا", "فاصوليا خضراء",
      "شجر", "كوسا", "سبانغ", "فجل", "شمندر", "كرات", "افوكادو", "مانجو", "أناناس", "يوسفي", "سنطرة"
    ]
  },
  {
    id: "bakery",
    name: "المخبوزات والمعجنات",
    icon: "🥐",
    color: "text-amber-700 dark:text-amber-300",
    bgLight: "bg-amber-50 border-amber-200",
    bgDark: "dark:bg-amber-950/40 dark:border-amber-800/60",
    keywords: [
      "صمون", "خبز", "كرواسون", "توست", "كعك", "معجنات", "فطائر", "بسكويت شاي",
      "خبز لبناني", "خبز تنور", "تورتيلا", "باتيه", "مناقيش", "شابورة", "بقسماط", "خبز شعير", "عجين", "سميط"
    ]
  },
  {
    id: "meat_poultry",
    name: "لحوم ودواجن",
    icon: "🥩",
    color: "text-rose-700 dark:text-rose-300",
    bgLight: "bg-rose-50 border-rose-200",
    bgDark: "dark:bg-rose-950/40 dark:border-rose-800/60",
    keywords: [
      "لحم", "دجاج", "كباب", "كفتة", "ستيك", "شاورما", "كص", "مفروم", "همبرغر", "اجنحة",
      "افخاذ", "صدر دجاج", "سودة", "معلاك", "فشة", "سمك", "روبيان", "ريش", "موزات", "كراعين",
      "قوزي", "دجاج فريش", "دجاج كامل", "سفاين", "لحم غنم", "لحم عجل", "مجزرة", "شيش طاووق"
    ]
  },
  {
    id: "frozen",
    name: "مجمدات",
    icon: "🍟",
    color: "text-sky-700 dark:text-sky-300",
    bgLight: "bg-sky-50 border-sky-200",
    bgDark: "dark:bg-sky-950/40 dark:border-sky-800/60",
    keywords: [
      "مجمدات", "بطاطا مجمدة", "اصابع بطاطا", "برغر مجمد", "ناجتس", "فش فيليه", "كبة مجمدة",
      "بازلاء مجمدة", "ذرة مجمدة", "فول مجمد", "بامية مجمدة", "سمبوسة مجمدة", "بورك مجمد", "ايس كريم", "مثلجات", "موطا"
    ]
  },
  {
    id: "dairy_cheese",
    name: "الألبان والأجبان",
    icon: "🧀",
    color: "text-yellow-700 dark:text-yellow-300",
    bgLight: "bg-yellow-50 border-yellow-200",
    bgDark: "dark:bg-yellow-950/40 dark:border-yellow-800/60",
    keywords: [
      "حليب", "لبن", "روبة", "جبن", "كيمر", "قيمر", "قشطة", "زبدة", "شنينة", "زبادي",
      "شيدر", "موزاريلا", "كيري", "لافاش كيري", "جبنة مثلثات", "لبنة", "جبن عرب", "حلومي",
      "جبن ابيض", "جبن سلايس", "جبن سائل", "جبن كاسات", "خاثر", "دوغ", "حليب مكثف"
    ]
  },
  {
    id: "beverages",
    name: "المشروبات",
    icon: "🥤",
    color: "text-blue-700 dark:text-blue-300",
    bgLight: "bg-blue-50 border-blue-200",
    bgDark: "dark:bg-blue-950/40 dark:border-blue-800/60",
    keywords: [
      "بيبسي", "كولا", "سفن", "سفن اب", "ميرندا", "عصير", "شاني", "سبرايت", "فانتا",
      "مشروب غازي", "راني", "سن توب", "مشروب طاقة", "تايجر", "ريد بول", "بلو", "نكتار",
      "ايس تي", "موهيتو", "شعير", "مشن", "كينزا", "مشروبات"
    ]
  },
  {
    id: "snacks",
    name: "سناكات",
    icon: "🥔",
    color: "text-orange-700 dark:text-orange-300",
    bgLight: "bg-orange-50 border-orange-200",
    bgDark: "dark:bg-orange-950/40 dark:border-orange-800/60",
    keywords: [
      "شيبس", "جبس", "ليز", "شيتوس", "دوريتوس", "بفك", "كرانشي", "مكسرات", "حب شمس",
      "فستق", "كازو", "لوز", "بندق", "جوز", "كرزات", "فشار", "شامية", "بريتزل", "مقرمشات", "سناك"
    ]
  },
  {
    id: "tea_coffee_sugar",
    name: "الشاي، القهوة والسكر",
    icon: "☕",
    color: "text-amber-800 dark:text-amber-200",
    bgLight: "bg-amber-100/60 border-amber-300",
    bgDark: "dark:bg-amber-950/50 dark:border-amber-700/60",
    keywords: [
      "شاي", "شاي سيلاني", "شاي الكبوس", "قهوة", "نسكافيه", "اسبريسو", "سكر", "شكر",
      "هيل", "بن", "كابتشينو", "مبيض قهوة", "كوفي ميت", "كرك", "شاي اخضر", "اعشاب شاي"
    ]
  },
  {
    id: "breakfast",
    name: "الإفطار",
    icon: "🥚",
    color: "text-orange-600 dark:text-orange-300",
    bgLight: "bg-orange-50 border-orange-200",
    bgDark: "dark:bg-orange-950/40 dark:border-orange-800/60",
    keywords: [
      "بيض", "بيض مائدة", "مربى", "عسل", "كورن فليكس", "نوتيلا", "حلاوة طحينية", "راشي",
      "دبس", "سيريال", "شوفان فطور", "بان كيك", "وافل", "زبدة فول سوداني"
    ]
  },
  {
    id: "ready_to_eat",
    name: "جاهز للأكل",
    icon: "🥪",
    color: "text-teal-700 dark:text-teal-300",
    bgLight: "bg-teal-50 border-teal-200",
    bgDark: "dark:bg-teal-950/40 dark:border-teal-800/60",
    keywords: [
      "ساندويش", "صاج", "وجبة سريعة", "بيتزا جاهزة", "سلطة جاهزة", "اندومي", "نودلز",
      "معكرونة جاهزة", "وجبة خفيفة", "شوربة جاهزة", "برغر جاهز", "فلافل", "سوشي"
    ]
  },
  {
    id: "cooking_basics",
    name: "أساسيات الطبخ",
    icon: "🍳",
    color: "text-lime-700 dark:text-lime-300",
    bgLight: "bg-lime-50 border-lime-200",
    bgDark: "dark:bg-lime-950/40 dark:border-lime-800/60",
    keywords: [
      "زيت", "زيت نباتي", "زيت زيتون", "طحين", "معجون", "معجون طماطة", "رز", "تمن",
      "برغل", "عدس", "حمص", "فاصوليا", "ماش", "معكرونة", "شعرية", "ملح طعام", "خل",
      "ماجي", "مرقة دجاج", "سمنة", "دهن حر", "نشا", "بيكنج باودر", "خميرة", "فانيلا"
    ]
  },
  {
    id: "water",
    name: "المياه",
    icon: "💧",
    color: "text-cyan-700 dark:text-cyan-300",
    bgLight: "bg-cyan-50 border-cyan-200",
    bgDark: "dark:bg-cyan-950/40 dark:border-cyan-800/60",
    keywords: [
      "ماء", "مياه", "بطل مي", "كرتونة ماء", "شربت ماء", "غالون ماء", "جلكان ماء", "ماء معدني", "ماء صحي"
    ]
  },
  {
    id: "canned_food",
    name: "المعلبات",
    icon: "🥫",
    color: "text-red-700 dark:text-red-300",
    bgLight: "bg-red-50 border-red-200",
    bgDark: "dark:bg-red-950/40 dark:border-red-800/60",
    keywords: [
      "معلبات", "تونة", "سردين", "ذرة معلبة", "حمص بطحينة", "فطر معلب", "مشروم",
      "فول مدمس", "اناناس معلب", "لحم معلب", "لانشون", "بلوبيف", "قشطة معلبة", "فول", "فاصوليا حمراء"
    ]
  },
  {
    id: "sauces",
    name: "الصلصات",
    icon: "🍅",
    color: "text-rose-800 dark:text-rose-200",
    bgLight: "bg-rose-100/60 border-rose-300",
    bgDark: "dark:bg-rose-950/50 dark:border-rose-700/60",
    keywords: [
      "صلصة", "صوص", "كاتشب", "مايونيز", "خردل", "ماسترد", "دبس رمان", "صويا صوص",
      "شطة", "طحينية", "صلصة باربيكيو", "رانش", "سيراتشا", "صلصة صويا", "صوص ثوم", "دريسينج"
    ]
  },
  {
    id: "stationery",
    name: "القرطاسية واللوازم المدرسية",
    icon: "✏️",
    color: "text-indigo-700 dark:text-indigo-300",
    bgLight: "bg-indigo-50 border-indigo-200",
    bgDark: "dark:bg-indigo-950/40 dark:border-indigo-800/60",
    keywords: [
      "دفتر", "قلم", "مساحة", "مبراة", "مسطرة", "قرطاسية", "تجليد", "الوان", "ملف",
      "فايل", "لاصق", "غراء", "حقيبة مدرسية", "اقلام جاف", "قلم رصاص", "طباشير", "لوحة", "مقص مدرسي"
    ]
  },
  {
    id: "personal_care",
    name: "العناية الشخصية",
    icon: "🧴",
    color: "text-purple-700 dark:text-purple-300",
    bgLight: "bg-purple-50 border-purple-200",
    bgDark: "dark:bg-purple-950/40 dark:border-purple-800/60",
    keywords: [
      "شامبو", "بلسم", "شاور جل", "صابون يد", "معجون اسنان", "فرشاة اسنان", "مزيل عرق",
      "ديودرنت", "غسول وجه", "كريم ترطيب", "شفرات حلاقة", "فوط صحية", "قطن", "عطر",
      "لوشن", "مكياج", "واقي شمس", "صابون استحمام", "سيروم"
    ]
  },
  {
    id: "healthy_products",
    name: "منتجات صحية",
    icon: "🌾",
    color: "text-emerald-800 dark:text-emerald-200",
    bgLight: "bg-emerald-100/60 border-emerald-300",
    bgDark: "dark:bg-emerald-950/50 dark:border-emerald-700/60",
    keywords: [
      "دايت", "بديل سكر", "ستيفيا", "بروتين", "بذور الشيا", "بذور الكتان", "كينوا",
      "خالي من الغلوتين", "عضوي", "شاي اخضر", "منتجات صحية", "مكمل غذائي", "شوفان حبة كاملة"
    ]
  },
  {
    id: "sweets",
    name: "حلويات",
    icon: "🍫",
    color: "text-pink-700 dark:text-pink-300",
    bgLight: "bg-pink-50 border-pink-200",
    bgDark: "dark:bg-pink-950/40 dark:border-pink-800/60",
    keywords: [
      "نستلة", "شوكولا", "شوكولاته", "كتكات", "سنيكرز", "مارس", "كندر", "توتو", "حلوى",
      "مصاصة", "جلي", "كيك", "دونات", "كراميل", "مارشميلو", "علكة", "بسكويت شوكولا",
      "شرين عسل", "توفي", "سويت", "حلويات", "توتو شوكو باي"
    ]
  },
  {
    id: "smartphones",
    name: "هواتف ذكية",
    icon: "📱",
    color: "text-violet-700 dark:text-violet-300",
    bgLight: "bg-violet-50 border-violet-200",
    bgDark: "dark:bg-violet-950/40 dark:border-violet-800/60",
    keywords: [
      "كفر", "شاحن", "كيبل", "سماعة", "ايفون", "سامسونج", "لاصق حماية", "ستاند هاتف",
      "باور بانك", "هواتف ذكية", "اكسسوارات موبايل", "شاشة حماية", "وصلة"
    ]
  },
  {
    id: "home_supplies",
    name: "اللوازم المنزلية",
    icon: "🍳",
    color: "text-stone-700 dark:text-stone-300",
    bgLight: "bg-stone-50 border-stone-200",
    bgDark: "dark:bg-stone-900/60 dark:border-stone-700/60",
    keywords: [
      "جدر", "طاوه", "صحن", "كلاص", "خواشيك", "ملاعق", "شوك", "سكين", "طاسة", "ابريق",
      "دلة", "ترمس", "سلة", "منشر", "مكبسة", "تبسي", "صينية", "منزلية", "طقم صحون",
      "ترامس", "حافظات طعام", "قدر ضغط", "مفرش", "وسادة", "ملاعق خشب"
    ]
  },
  {
    id: "spices_herbs",
    name: "التوابل والاعشاب",
    icon: "🧂",
    color: "text-yellow-800 dark:text-yellow-200",
    bgLight: "bg-yellow-100/60 border-yellow-300",
    bgDark: "dark:bg-yellow-950/50 dark:border-yellow-700/60",
    keywords: [
      "بهارات", "كمون", "كركم", "كاري", "فلفل اسود", "فلفل حار", "بابريكا", "كزبرة",
      "دارسين", "قرفة", "زنجبيل", "سماق", "نومي بصرة", "زعتر", "توابل", "زعفران",
      "قرنفل", "مسمار", "جوزة الطيب", "ورق غار", "كراوية", "حبة حلوة", "ينسون"
    ]
  },
  {
    id: "baby_care",
    name: "العناية بالطفل",
    icon: "👶",
    color: "text-sky-600 dark:text-sky-300",
    bgLight: "bg-sky-50 border-sky-200",
    bgDark: "dark:bg-sky-950/40 dark:border-sky-800/60",
    keywords: [
      "حفاضات", "بامبرز", "حليب اطفال", "سيريلاك", "ببيونه", "لهاية", "مناديل مبللة اطفال",
      "بودرة اطفال", "شامبو اطفال", "زيت اطفال", "لهاية اطفال", "عضاضة", "العناية بالطفل"
    ]
  },
  {
    id: "detergents",
    name: "منظفات",
    icon: "🧼",
    color: "text-cyan-800 dark:text-cyan-200",
    bgLight: "bg-cyan-50 border-cyan-200",
    bgDark: "dark:bg-cyan-950/40 dark:border-cyan-800/60",
    keywords: [
      "زاهي", "مسحوق غسيل", "تايد", "اريال", "برسيل", "كلور", "قاصر", "فلاش", "معطر ارضيات",
      "ملمع زجاج", "داوني", "منظف دهون", "دافى", "دافنى", "اسفنج مواعين", "سيم مواعين",
      "اكياس زبالة", "منظف حمامات", "صابون جلي", "مبيد حشرات", "معقم"
    ]
  },
  {
    id: "cigarettes",
    name: "السكائر",
    icon: "🚬",
    color: "text-zinc-700 dark:text-zinc-300",
    bgLight: "bg-zinc-100 border-zinc-300",
    bgDark: "dark:bg-zinc-800 dark:border-zinc-700",
    keywords: [
      "سكائر", "سجائر", "باكيت سكائر", "تبغ", "معسل", "ارگيلة", "ولاعة", "فحم اركيلة"
    ]
  },
  {
    id: "home_appliances",
    name: "أجهزة منزلية",
    icon: "🔌",
    color: "text-rose-600 dark:text-rose-300",
    bgLight: "bg-rose-50 border-rose-200",
    bgDark: "dark:bg-rose-950/40 dark:border-rose-800/60",
    keywords: [
      "خلاط", "مكواة", "استشوار", "سخان", "فرن كهربائي", "غلاية", "مفرمة", "مروحة",
      "صوبة", "قلاية هوائية", "عصارة", "توستر", "مكنسة كهربائية", "ميزان منزلي"
    ]
  },
  {
    id: "pharmacy",
    name: "صيدلية",
    icon: "💊",
    color: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-200",
    bgDark: "dark:bg-emerald-950/40 dark:border-emerald-800/60",
    keywords: [
      "بندول", "باراسيتول", "براسيتول", "مسكن", "فيتامين", "دواء", "علاج", "شاش",
      "بلاستر", "شراب سعلة", "قطرة", "مرهم", "صيدلية", "مضاد حيوي", "اوميغا 3", "زنك"
    ]
  },
  {
    id: "disposables_paper",
    name: "سفريات وورقيات",
    icon: "🧻",
    color: "text-blue-600 dark:text-blue-300",
    bgLight: "bg-blue-50 border-blue-200",
    bgDark: "dark:bg-blue-950/40 dark:border-blue-800/60",
    keywords: [
      "كلينكس", "مناديل", "فاين", "محارم", "سفري", "مواعين سفري", "سفرة نايلون",
      "كاسات سفري", "المنيوم", "قصدير", "نايلون تغليف", "ورق زبدة", "اكواب ورقية", "اطباق ورقية"
    ]
  },
  {
    id: "cards",
    name: "كارتات",
    icon: "💳",
    color: "text-purple-600 dark:text-purple-300",
    bgLight: "bg-purple-50 border-purple-200",
    bgDark: "dark:bg-purple-950/40 dark:border-purple-800/60",
    keywords: [
      "كارت رصيد", "اسياسيل", "زين", "كورك", "كارت شحن", "بطاقة العاب", "كارت انترنت", "كارتات", "ايتونز", "بلايستيشن"
    ]
  }
];

export const PRODUCT_CATEGORY_MAP: Record<string, ProductCategoryDef> = PRODUCT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.name] = cat;
  acc[cat.id] = cat;
  return acc;
}, {} as Record<string, ProductCategoryDef>);

/**
 * ترتيب أولوية الأقسام حسب الأهمية (المخضر والفواكه أولاً، ثم المخبوزات واللحوم والألبان...)
 */
export const CATEGORY_PRIORITY_INDEX_MAP: Record<string, number> = PRODUCT_CATEGORIES.reduce((acc, cat, idx) => {
  acc[cat.name] = idx;
  acc[cat.id] = idx;
  return acc;
}, {} as Record<string, number>);

export function getCategoryPriorityIndex(categoryName?: string): number {
  if (!categoryName) return 999;
  const idx = CATEGORY_PRIORITY_INDEX_MAP[categoryName];
  if (idx !== undefined) return idx;
  // Match partial or aliases
  if (categoryName.includes("خضار") || categoryName.includes("فواكه") || categoryName.includes("مخضر")) return 0;
  if (categoryName.includes("خبز") || categoryName.includes("مخبوزات")) return 1;
  if (categoryName.includes("لحم") || categoryName.includes("دواجن") || categoryName.includes("سمك")) return 2;
  if (categoryName.includes("مجمد")) return 3;
  if (categoryName.includes("لبن") || categoryName.includes("جبن") || categoryName.includes("ألبان")) return 4;
  return 999;
}

/**
 * ترتيب أي مصفوفة من المواد حسب أولوية الأقسام (الفواكه والخضار أولاً وهكذا)
 */
export function sortItemsByCategoryPriority<T extends { category?: string; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const catA = a.category || detectProductCategory(a.name);
    const catB = b.category || detectProductCategory(b.name);
    const prioA = getCategoryPriorityIndex(catA);
    const prioB = getCategoryPriorityIndex(catB);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    return (a.name || "").localeCompare(b.name || "", "ar");
  });
}

/**
 * ذاكرة التعلم الذكي لربط المنتج بالفئة حسب تعديل المستخدم
 */
const MEMORY_KEY = "aq_home_learned_categories";
let inMemoryCategoryMap: Record<string, string> = {};

export function getLearnedCategory(name: string): string | null {
  if (!name || typeof window === "undefined") {
    return inMemoryCategoryMap[name?.trim().toLowerCase()] || null;
  }
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      const val = map[name.trim().toLowerCase()];
      if (val) return val;
    }
  } catch (e) {
    // Ignore storage errors
  }
  return inMemoryCategoryMap[name?.trim().toLowerCase()] || null;
}

export function saveLearnedCategory(name: string, category: string): void {
  if (!name || !category) return;
  const cleanName = name.trim().toLowerCase();
  inMemoryCategoryMap[cleanName] = category;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[cleanName] = category;
      localStorage.setItem(MEMORY_KEY, JSON.stringify(map));
    } catch (e) {
      // Ignore storage errors
    }
  }
}

/**
 * دالة التنبؤ الذكي التلقائي بالفئة حسب اسم المادة (مع دعم التعلم المسبق)
 */
export function detectProductCategory(name: string): string {
  if (!name || typeof name !== "string") return "الفواكه والخضار";
  const cleaned = name.trim().toLowerCase();

  // 1. Check user learned memory first
  const learned = getLearnedCategory(cleaned);
  if (learned) return learned;

  // 2. Exact or partial keyword matching in prioritized order
  for (const cat of PRODUCT_CATEGORIES) {
    for (const kw of cat.keywords) {
      const kwLower = kw.toLowerCase();
      // Match exact word or substring
      if (cleaned === kwLower || cleaned.includes(kwLower) || kwLower.includes(cleaned)) {
        return cat.name;
      }
    }
  }

  // 3. Fallback defaults (fruits/veg if grocery context, or general)
  return "الفواكه والخضار";
}

/**
 * خيارات الأماكن الافتراضية داخل الطلعات والجولات
 */
export const OUTING_PLACES_SUGGESTIONS = [
  "هايبر ماركت",
  "سوق الخضار",
  "سوق اللحوم والأسماك",
  "تجهيزات منزلية",
  "مطعم وكافيه",
  "حلويات ومعجنات",
  "أجهزة كهربائية وإلكترونيات",
  "محطة بنزين",
  "صيدلية وعلاج",
  "ألعاب وترفيه",
  "أخرى"
];

/**
 * فترات وخيارات بطاقات الضمان
 */
export const WARRANTY_PERIOD_PRESETS = [
  "3 أشهر",
  "6 أشهر",
  "سنة واحدة",
  "سنتين",
  "3 سنوات",
  "5 سنوات"
];

/**
 * حساب تاريخ انتهاء الضمان تلقائياً
 */
export function calculateWarrantyExpiryDate(startDateStr: string, period: string): string {
  try {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(start.getTime())) return "";

    const date = new Date(start);
    if (period.includes("3 أشهر") || period.includes("3 اشهر")) {
      date.setMonth(date.getMonth() + 3);
    } else if (period.includes("6 أشهر") || period.includes("6 اشهر")) {
      date.setMonth(date.getMonth() + 6);
    } else if (period.includes("سنة واحدة") || period.includes("سنة") || period.includes("1 سنة")) {
      date.setFullYear(date.getFullYear() + 1);
    } else if (period.includes("سنتين") || period.includes("2 سنة")) {
      date.setFullYear(date.getFullYear() + 2);
    } else if (period.includes("3 سنوات")) {
      date.setFullYear(date.getFullYear() + 3);
    } else if (period.includes("5 سنوات")) {
      date.setFullYear(date.getFullYear() + 5);
    } else {
      // Default 1 year
      date.setFullYear(date.getFullYear() + 1);
    }

    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/**
 * الحصول على حالة الضمان والأيام المتبقية
 */
export function getWarrantyStatus(expiryDateStr?: string): {
  isExpired: boolean;
  daysRemaining: number;
  label: string;
  badgeClass: string;
} {
  if (!expiryDateStr) {
    return {
      isExpired: false,
      daysRemaining: 0,
      label: "ضمان مسجل",
      badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200"
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      isExpired: true,
      daysRemaining,
      label: "منتهي الصلاحية",
      badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200"
    };
  }

  if (daysRemaining <= 30) {
    return {
      isExpired: false,
      daysRemaining,
      label: `سينتهي قريباً (${daysRemaining} يوم)`,
      badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200"
    };
  }

  const months = Math.floor(daysRemaining / 30);
  const remainingDaysInMonth = daysRemaining % 30;
  const periodText = months > 0 ? `${months} شهر${remainingDaysInMonth > 0 ? ` و${remainingDaysInMonth} يوم` : ""}` : `${daysRemaining} يوم`;

  return {
    isExpired: false,
    daysRemaining,
    label: `ساري (${periodText})`,
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200"
  };
}

