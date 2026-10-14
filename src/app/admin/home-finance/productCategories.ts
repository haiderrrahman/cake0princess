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
    id: "supermarket",
    name: "سوبر ماركت",
    icon: "🛒",
    color: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-200",
    bgDark: "dark:bg-emerald-950/40 dark:border-emerald-800/60",
    keywords: [
      "سوبر ماركت", "سوبرماركت", "ماركت", "هايبر ماركت", "اسواق", "مسواك", "مشتريات", "جمعية", "ماركت البركات", "تعاون ماركت"
    ]
  },
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
    name: "لحوم ودواجن وأسماك",
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
    id: "cooking_basics",
    name: "أساسيات ومؤونة الطبخ",
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
    id: "canned_food",
    name: "المعلبات والبقوليات",
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
    id: "breakfast",
    name: "الإفطار والمربيات",
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
    id: "frozen",
    name: "مجمدات ومثلجات",
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
    id: "sauces",
    name: "الصلصات والمقبلات",
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
    id: "spices_herbs",
    name: "التوابل والأعشاب",
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
    id: "beverages",
    name: "المشروبات والعصائر",
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
    id: "water",
    name: "المياه والشرب",
    icon: "💧",
    color: "text-cyan-700 dark:text-cyan-300",
    bgLight: "bg-cyan-50 border-cyan-200",
    bgDark: "dark:bg-cyan-950/40 dark:border-cyan-800/60",
    keywords: [
      "ماء", "مياه", "بطل مي", "كرتونة ماء", "شربت ماء", "غالون ماء", "جلكان ماء", "ماء معدني", "ماء صحي"
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
    id: "sweets",
    name: "حلويات وشوكولاته",
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
    id: "snacks",
    name: "سناكات ومكسرات",
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
    id: "ready_to_eat",
    name: "جاهز للأكل وسندويشات",
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
    id: "restaurants_cafes",
    name: "مطاعم وكافيهات",
    icon: "🍽️",
    color: "text-amber-800 dark:text-amber-300",
    bgLight: "bg-amber-50 border-amber-300",
    bgDark: "dark:bg-amber-950/50 dark:border-amber-700/60",
    keywords: [
      "مطعم", "كافيه", "مقهى", "كوفي", "كوفي شوب", "شاورما", "كباب", "كص", "برغر", "برجر",
      "همبرجر", "همبرغر", "بيتزا", "فلافل", "قوزي", "مندي", "مشويات", "فاست فود", "عشاء", "غداء",
      "ريوق", "ريووق", "وجبة", "سناك", "اسبريسو", "قهوة كافيه", "عصير فريش", "بوفيه",
      "توصيل طلبات", "طلبات", "دلفري", "دليفري", "بروستد", "كنتاكي", "سوشي", "منسف", "برياني سفري", "وجبة مطعم"
    ]
  },
  {
    id: "car_transport",
    name: "السيارة والنقل",
    icon: "🚗",
    color: "text-blue-800 dark:text-blue-300",
    bgLight: "bg-blue-50 border-blue-300",
    bgDark: "dark:bg-blue-950/50 dark:border-blue-700/60",
    keywords: [
      "كراج", "كراجات", "باركنك", "باركنج", "موقف سيارات", "موقف", "بنزين", "بانزين", "محطة وقود",
      "غسل سيارة", "غسيل سيارة", "دهن محرك", "تبديل دهن", "تبديل زيت", "بنشر", "بنجر", "تاير", "تايرات",
      "عجلات", "اطارات", "بطارية سيارة", "فيتر", "ميكانيك", "فيترجي", "كهربائي سيارات", "حدادية",
      "سفايف", "بريك", "دسك", "فلتر هواء", "فلتر دهن", "كروة", "كروة باص", "تكسي", "تاكسي",
      "اجرة", "اوبر", "كريم", "باص", "كيا", "قطار", "طيران", "تذكرة سفر", "وقود", "صبغ سيارة",
      "مرور", "سنوية", "هزة", "فحص دوري", "غرامة مرور", "رسم مرور", "طريق سريع", "سيارة", "سيارات"
    ]
  },
  {
    id: "bills_services",
    name: "فواتير وخدمات منزلية",
    icon: "⚡",
    color: "text-yellow-700 dark:text-yellow-300",
    bgLight: "bg-yellow-50 border-yellow-300",
    bgDark: "dark:bg-yellow-950/40 dark:border-yellow-700/60",
    keywords: [
      "مولدة", "امبيرات", "امبير", "سحب مولد", "كهرباء وطنية", "فاتورة كهرباء", "فاتورة ماء",
      "ماء اسالة", "فاتورة انترنت", "اشتراك انترنت", "واي فاي", "قنينة غاز", "تبديل غاز",
      "عمال تنظيف", "بلدية", "ضريبة", "تنظيف خزانات", "حراسة", "خدمات"
    ]
  },
  {
    id: "home_maintenance",
    name: "صيانة وترميم المنزل",
    icon: "🔧",
    color: "text-cyan-800 dark:text-cyan-300",
    bgLight: "bg-cyan-50 border-cyan-300",
    bgDark: "dark:bg-cyan-950/50 dark:border-cyan-700/60",
    keywords: [
      "صيانة", "تصليح", "صيانة منزلية", "كهربائي", "سباك", "تأسيسات صحية", "بوري", "بواريك",
      "حنفية", "خلاط ماء", "ماطور ماء", "دينمو", "سبالت", "سبليت", "مكيف", "تكييف", "تنظيف سبالت",
      "غاز تبريد", "غسالة", "ثلاجة", "طباخ", "صباغ", "صبغ جدران", "دهان", "سيراميك", "كاشي",
      "دريل", "برغي", "براغي", "واير", "اسلاك", "فيش", "بلك", "قاطع دورة", "قفل", "مفتاح", "يدة باب", "زجاج", "شباك", "نجار", "حداد"
    ]
  },
  {
    id: "clothing_shoes",
    name: "ملابس وأحذية",
    icon: "👔",
    color: "text-indigo-700 dark:text-indigo-300",
    bgLight: "bg-indigo-50 border-indigo-200",
    bgDark: "dark:bg-indigo-950/40 dark:border-indigo-800/60",
    keywords: [
      "ملابس", "قميص", "بنطلون", "تيشرت", "تي شيرت", "دشداشة", "بدلة", "فستان", "تنورة",
      "حذاء", "قندرة", "بوت", "صندل", "نعال", "شحاطة", "جواريب", "جرابات", "شال", "حجاب",
      "عباءة", "سترة", "قمصلة", "جاكيت", "كوت", "بجامة", "ملابس نوم", "ملابس داخلية", "حزام", "دريس", "ملابس اطفال", "بلوز", "شورت"
    ]
  },
  {
    id: "pharmacy",
    name: "صيدلية وعلاج",
    icon: "💊",
    color: "text-emerald-700 dark:text-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-200",
    bgDark: "dark:bg-emerald-950/40 dark:border-emerald-800/60",
    keywords: [
      "بندول", "باراسيتول", "براسيتول", "مسكن", "فيتامين", "دواء", "علاج", "شاش",
      "بلاستر", "شراب سعلة", "قطرة", "مرهم", "صيدلية", "مضاد حيوي", "اوميغا 3", "زنك",
      "اسبرين", "مسكن الام", "ابرة", "كانونة", "ميزان حرارة", "فحص سكر", "جهاز ضغط"
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
      "بودرة اطفال", "شامبو اطفال", "زيت اطفال", "عضاضة", "العناية بالطفل", "كرسي اطفال", "عربة اطفال"
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
      "ديودرنت", "غسول وجه", "كريم ترطيب", "شفرات حلاقة", "فوط صحية", "قطن",
      "لوشن", "مكياج", "واقي شمس", "صابون استحمام", "سيروم", "حلاقة", "صالون"
    ]
  },
  {
    id: "detergents",
    name: "منظفات ومعقمات",
    icon: "🧼",
    color: "text-cyan-800 dark:text-cyan-200",
    bgLight: "bg-cyan-50 border-cyan-200",
    bgDark: "dark:bg-cyan-950/40 dark:border-cyan-800/60",
    keywords: [
      "زاهي", "مسحوق غسيل", "تايد", "اريال", "برسيل", "كلور", "قاصر", "فلاش", "معطر ارضيات",
      "ملمع زجاج", "داوني", "منظف دهون", "دافى", "دافنى", "اسفنج مواعين", "سيم مواعين",
      "اكياس زبالة", "منظف حمامات", "صابون جلي", "مبيد حشرات", "معقم", "ديتول"
    ]
  },
  {
    id: "home_supplies",
    name: "اللوازم المنزلية والأواني",
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
    id: "furniture_furnishings",
    name: "أثاث ومفروشات",
    icon: "🛋️",
    color: "text-amber-900 dark:text-amber-200",
    bgLight: "bg-amber-50 border-amber-300",
    bgDark: "dark:bg-amber-950/50 dark:border-amber-800/60",
    keywords: [
      "اثاث", "أثاث", "قنفة", "تخم قنفات", "ميز", "طاولة", "كرسي", "كراسي", "دولاب", "خزانة",
      "كاونتر", "سرير", "جرباية", "دوشك", "مرتبة", "ستائر", "بردة", "سجاد", "زولية", "موكيت", "مرآة", "لوحة جدارية", "رفوف"
    ]
  },
  {
    id: "home_appliances",
    name: "أجهزة كهربائية ومنزلية",
    icon: "🔌",
    color: "text-rose-600 dark:text-rose-300",
    bgLight: "bg-rose-50 border-rose-200",
    bgDark: "dark:bg-rose-950/40 dark:border-rose-800/60",
    keywords: [
      "خلاط", "مكواة", "استشوار", "سخان", "فرن كهربائي", "غلاية", "مفرمة", "مروحة",
      "صوبة", "قلاية هوائية", "عصارة", "توستر", "مكنسة كهربائية", "ميزان منزلي", "مبرد", "مكرويف", "مايكرويف"
    ]
  },
  {
    id: "electronics_pc",
    name: "إلكترونيات وكمبيوتر",
    icon: "💻",
    color: "text-slate-800 dark:text-slate-200",
    bgLight: "bg-slate-100 border-slate-300",
    bgDark: "dark:bg-slate-900 dark:border-slate-700",
    keywords: [
      "لابتوب", "كمبيوتر", "حاسبة", "طابعة", "شاشة", "تلفزيون", "رسيفر", "ستلايت", "كاميرا",
      "كيبورد", "ماوس", "هارد", "فلاش ميموري", "فلاشة", "راوتر", "يوبي اس", "ups", "عاكسة", "شاحنة لابتوب", "مايك", "سبيكر", "مكبر صوت"
    ]
  },
  {
    id: "smartphones",
    name: "هواتف واكسسوارات",
    icon: "📱",
    color: "text-violet-700 dark:text-violet-300",
    bgLight: "bg-violet-50 border-violet-200",
    bgDark: "dark:bg-violet-950/40 dark:border-violet-800/60",
    keywords: [
      "كفر", "شاحن", "كيبل", "سماعة", "ايفون", "سامسونج", "لاصق حماية", "ستاند هاتف",
      "باور بانك", "هواتف ذكية", "اكسسوارات موبايل", "شاشة حماية", "وصلة", "ايربودز", "سماعات بلوتوث"
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
    id: "education_books",
    name: "تعليم ودورات وكتب",
    icon: "📚",
    color: "text-emerald-800 dark:text-emerald-300",
    bgLight: "bg-emerald-50 border-emerald-300",
    bgDark: "dark:bg-emerald-950/50 dark:border-emerald-800/60",
    keywords: [
      "كتاب", "كتب", "رواية", "ملزمة", "ملازم", "دورة", "كورس", "تسجيل مدرسة", "قسط مدرسة",
      "روضة", "حضانة", "تدريس خصوصي", "معهد", "جامعة", "امتحانات", "شهادة"
    ]
  },
  {
    id: "gifts_events",
    name: "هدايا ومناسبات",
    icon: "🎁",
    color: "text-pink-800 dark:text-pink-300",
    bgLight: "bg-pink-50 border-pink-300",
    bgDark: "dark:bg-pink-950/50 dark:border-pink-800/60",
    keywords: [
      "هدية", "هدايا", "ورد", "باقة ورد", "زهور", "تغليف هدايا", "كيكة مناسبة", "كيكة ميلاد",
      "عيد ميلاد", "زينة", "بالونات", "بطاقة تهنئة", "حفل", "توزيعات", "ضيافة مناسبات"
    ]
  },
  {
    id: "perfumes_accessories",
    name: "عطور وإكسسوارات وساعات",
    icon: "💍",
    color: "text-purple-800 dark:text-purple-300",
    bgLight: "bg-purple-50 border-purple-300",
    bgDark: "dark:bg-purple-950/50 dark:border-purple-800/60",
    keywords: [
      "عطر", "برفيوم", "بخور", "دهن عود", "عود", "ساعة", "ساعات", "محبس", "خاتم", "قلادة",
      "سوار", "اسوارة", "محبس فضة", "ذهب", "نظارة", "نظارة شمسية", "شنطة يد", "حقيبة نسائية", "اكسسوارات", "بروش"
    ]
  },
  {
    id: "healthy_products",
    name: "منتجات صحية ورياضية",
    icon: "🌾",
    color: "text-emerald-800 dark:text-emerald-200",
    bgLight: "bg-emerald-100/60 border-emerald-300",
    bgDark: "dark:bg-emerald-950/50 dark:border-emerald-700/60",
    keywords: [
      "دايت", "بديل سكر", "ستيفيا", "بروتين", "واي بروتين", "بذور الشيا", "بذور الكتان", "كينوا",
      "خالي من الغلوتين", "عضوي", "مكمل غذائي", "شوفان حبة كاملة", "اشتراك جيم", "نادي رياضي"
    ]
  },
  {
    id: "cards",
    name: "كارتات وشحن",
    icon: "💳",
    color: "text-purple-600 dark:text-purple-300",
    bgLight: "bg-purple-50 border-purple-200",
    bgDark: "dark:bg-purple-950/40 dark:border-purple-800/60",
    keywords: [
      "كارت رصيد", "اسياسيل", "زين", "كورك", "كارت شحن", "بطاقة العاب", "كارت انترنت", "كارتات", "ايتونز", "بلايستيشن", "رصيد هاتف"
    ]
  },
  {
    id: "cigarettes",
    name: "السكائر والمعسل",
    icon: "🚬",
    color: "text-zinc-700 dark:text-zinc-300",
    bgLight: "bg-zinc-100 border-zinc-300",
    bgDark: "dark:bg-zinc-800 dark:border-zinc-700",
    keywords: [
      "سكائر", "سجائر", "باكيت سكائر", "تبغ", "معسل", "ارگيلة", "اركيلة", "ولاعة", "فحم اركيلة", "فحم"
    ]
  },
  {
    id: "pets_veterinary",
    name: "حيوانات أليفة وبيطرة",
    icon: "🐾",
    color: "text-amber-700 dark:text-amber-400",
    bgLight: "bg-amber-50 border-amber-300",
    bgDark: "dark:bg-amber-950/40 dark:border-amber-800/60",
    keywords: [
      "اكل بزازين", "طعام قطط", "دراي فود", "اكل جلاب", "طعام كلاب", "عصفور", "طيور", "بلبل", "قفص", "بيطري", "علاج بيطري", "رمل قطط"
    ]
  },
  {
    id: "donations_charity",
    name: "تبرعات وصدقات",
    icon: "🤲",
    color: "text-teal-700 dark:text-teal-300",
    bgLight: "bg-teal-50 border-teal-300",
    bgDark: "dark:bg-teal-950/40 dark:border-teal-800/60",
    keywords: [
      "صدقة", "تبرع", "زكاة", "خيرات", "ثواب", "مساعدة", "كفالة يتيم", "اطعام مسكين", "نذر", "جامع", "مسجد"
    ]
  },
  {
    id: "other_misc",
    name: "أخرى ومتفرقات",
    icon: "📦",
    color: "text-gray-700 dark:text-gray-300",
    bgLight: "bg-gray-100 border-gray-300",
    bgDark: "dark:bg-zinc-800 dark:border-zinc-700",
    keywords: [
      "اخرى", "أخرى", "متفرقات", "مصاريف عامة", "عام", "طوارئ", "متنوع", "حاجة عامة"
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
  if (categoryName.includes("لبن") || categoryName.includes("جبن") || categoryName.includes("ألبان")) return 3;
  if (categoryName.includes("مجمد")) return 7;
  if (categoryName.includes("مطعم") || categoryName.includes("كافيه")) return 16;
  if (categoryName.includes("سيار") || categoryName.includes("نقل") || categoryName.includes("بنزين")) return 17;
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

function matchesKeyword(text: string, kw: string): boolean {
  const t = text.toLowerCase().trim();
  const k = kw.toLowerCase().trim();
  if (!t || !k) return false;
  if (t === k) return true;
  if (k.includes(" ")) {
    return t.includes(k);
  }
  const words = t.split(/[\s,،_.\/\\-]+/).filter(Boolean);
  for (const w of words) {
    if (w === k) return true;
    if (w === "ال" + k || w === "و" + k || w === "وال" + k || w === "ف" + k || w === "كال" + k || w === "بال" + k) return true;
    if (k.length >= 4 && (w.startsWith(k) || w.endsWith(k))) return true;
  }
  return false;
}

/**
 * دالة التنبؤ الذكي التلقائي بالفئة حسب اسم المادة (مع دعم التعلم المسبق)
 */
export function detectProductCategory(name: string): string {
  if (!name || typeof name !== "string") return "";
  const cleaned = name.trim().toLowerCase();
  if (!cleaned) return "";

  // 1. Check user learned memory first
  const learned = getLearnedCategory(cleaned);
  if (learned) return learned;

  // 2. Exact or word-boundary keyword match across all categories
  for (const cat of PRODUCT_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (matchesKeyword(cleaned, kw)) {
        return cat.name;
      }
    }
  }

  // 4. Heuristic fallbacks for key Iraqi terms:
  if (cleaned.includes("كراج") || cleaned.includes("بانزين") || cleaned.includes("بنزين") || cleaned.includes("سيار") || cleaned.includes("دهن محرك") || cleaned.includes("فيتر") || cleaned.includes("تاير") || cleaned.includes("غسل سيارة") || cleaned.includes("بنشر") || cleaned.includes("تبديل دهن") || cleaned.includes("وقود") || cleaned.includes("باركنك") || cleaned.includes("تكسي") || cleaned.includes("كروة")) {
    return "السيارة والنقل";
  }
  if (cleaned.includes("كارت") || cleaned.includes("رصيد") || cleaned.includes("اسيا") || cleaned.includes("اسياسيل") || cleaned.includes("زين") || cleaned.includes("كورك") || cleaned.includes("سيم كارت") || cleaned.includes("سيمكارت")) {
    return "كارتات وشحن";
  }
  if (cleaned.includes("مطعم") || cleaned.includes("كافيه") || cleaned.includes("كوفي") || cleaned.includes("شاورما") || cleaned.includes("برغر") || cleaned.includes("برجر") || cleaned.includes("بيتزا") || cleaned.includes("مشويات") || cleaned.includes("ريوق") || cleaned.includes("عشاء") || cleaned.includes("غداء") || cleaned.includes("صاج") || cleaned.includes("فلافل") || cleaned.includes("وجبة سفري")) {
    return "مطاعم وكافيهات";
  }
  if (cleaned.includes("صيانة") || cleaned.includes("تصليح") || cleaned.includes("سبلت") || cleaned.includes("سبالت") || cleaned.includes("كهربائي") || cleaned.includes("سباك") || cleaned.includes("صباغ") || cleaned.includes("تأسيسات") || cleaned.includes("ماطور") || cleaned.includes("دينمو")) {
    return "صيانة وترميم المنزل";
  }
  if (cleaned.includes("ملابس") || cleaned.includes("بنطلون") || cleaned.includes("قميص") || cleaned.includes("تيشرت") || cleaned.includes("حذاء") || cleaned.includes("قندرة") || cleaned.includes("دشداشة") || cleaned.includes("فستان") || cleaned.includes("جاكيت")) {
    return "ملابس وأحذية";
  }
  if (cleaned.includes("صيدلية") || cleaned.includes("دواء") || cleaned.includes("علاج") || cleaned.includes("بندول") || cleaned.includes("فيتامين") || cleaned.includes("مسكن") || cleaned.includes("طبيب") || cleaned.includes("تحليل")) {
    return "صيدلية وعلاج";
  }
  if (cleaned.includes("حفاض") || cleaned.includes("بامبرز") || cleaned.includes("حليب اطفال") || cleaned.includes("سيريلاك") || cleaned.includes("لهاية")) {
    return "العناية بالطفل";
  }
  if (cleaned.includes("موبايل") || cleaned.includes("ايفون") || cleaned.includes("سامسونج") || cleaned.includes("كفر") || cleaned.includes("شاحن") || cleaned.includes("سماعة") || cleaned.includes("باور بانك") || cleaned.includes("لزقة شاشة")) {
    return "هواتف واكسسوارات";
  }
  if (cleaned.includes("لابتوب") || cleaned.includes("كمبيوتر") || cleaned.includes("حاسبة") || cleaned.includes("راوتر") || cleaned.includes("شاشة") || cleaned.includes("طابعة")) {
    return "إلكترونيات وكمبيوتر";
  }
  if (cleaned.includes("غسالة") || cleaned.includes("ثلاجة") || cleaned.includes("مكنسة") || cleaned.includes("طباخ") || cleaned.includes("مروحة") || cleaned.includes("سخان") || cleaned.includes("قلاية")) {
    return "أجهزة كهربائية ومنزلية";
  }
  if (cleaned.includes("زاهي") || cleaned.includes("تايد") || cleaned.includes("كلور") || cleaned.includes("قاصر") || cleaned.includes("فلاش") || cleaned.includes("منظف") || cleaned.includes("معطر") || cleaned.includes("صابون")) {
    return "منظفات ومعقمات";
  }
  if (cleaned.includes("مولدة") || cleaned.includes("امبير") || cleaned.includes("انترنت") || cleaned.includes("كهرباء") || cleaned.includes("فاتورة") || cleaned.includes("اشتراك")) {
    return "فواتير وخدمات منزلية";
  }
  if (cleaned.includes("ماركت") || cleaned.includes("سوبر")) {
    return "سوبر ماركت";
  }

  // 5. No match found - do not arbitrarily return fruits & veg!
  return "";
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
  "كراج وميكانيك سيارات",
  "صيانة وخدمات منزلية",
  "ملابس وأزياء",
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

export interface ItemNatureClassification {
  type: "discretionary" | "essential" | "neutral";
  reason: string;
  badge: string;
  colorClass: string;
  lightBg: string;
}

export function classifyItemNature(name: string, category?: string): ItemNatureClassification {
  const n = (name || "").toLowerCase().trim();
  const cat = (category || "").toLowerCase().trim();

  // 1. Definite Discretionary / Snacks / Sweets / Fast Foods / Waste Leaks
  const snackKeywords = [
    "شيبس", "جبس", "ليز", "شيتوس", "دوريتوس", "برينجلز", "كرات الجبن", "فشار", "بفك",
    "شوكولاته", "نوتيلا", "كت كات", "سنيكرز", "تويكس", "مارس", "كندر", "جالكسي", "مورو", "باونتي",
    "بسكويت محشى", "ويفر", "كيك جاهز", "دونات", "كرواسون شوكولا", "حلاوة", "حلقوم", "مصاص", "علك", "سكاكر", "مارشميلو",
    "بيبسي", "كوكاكولا", "سفن اب", "ميراندا", "فانتا", "ماونتن ديو", "ريد بول", "تايجر", "مشروب طاقة", "باور هورس",
    "عصير مصنع", "عصير معلب", "ايس كريم", "موطه", "دوندورما", "سلاش", "مثلجات",
    "اندومي", "نودلز",
    "برغر", "بيتزا", "شاورما", "كنتاكي", "وجبة سريعة", "صاج", "فاهيتا", "سندويش جاهز", "فنكر", "بطاطس مقلية",
    "كابتشينو جاهز", "لاتيه", "قهوة باردة", "ايس كوفي", "ميلك شيك", "كوكتيل", "مشروبات غازية",
    "سكائر", "سجائر", "فيب", "معسل", "اركيلة", "سحبة", "تبغ",
    "العاب", "لعبة", "سلايم", "بالونات", "اكسسوارات"
  ];

  if (
    cat.includes("حلويات") ||
    cat.includes("سناكات") ||
    cat.includes("مطاعم") ||
    cat.includes("سكائر") ||
    snackKeywords.some(k => n.includes(k))
  ) {
    return {
      type: "discretionary",
      reason: "تسالي، حلويات أو جاهز (يمكن ترشيده)",
      badge: "تبذير / كماليات 🍭",
      colorClass: "text-rose-600 dark:text-rose-400",
      lightBg: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40"
    };
  }

  // 2. Definite Essentials / Cooking & Household Staples
  const essentialKeywords = [
    "طماطة", "طماطم", "خيار", "بصل", "بطاطا", "بتيتة", "خضار", "مخضر", "فاكهة", "فواكه",
    "لحم", "دجاج", "سمك", "مفروم", "صدر دجاج", "كبة", "فيليه",
    "حليب", "لبن", "جبن", "جبنة", "بيض", "زبادي", "قشطة", "زبدة",
    "رز", "تمن", "زيت", "شكر", "سكر", "طحين", "معجون", "ملح", "عدس", "فاصوليا", "حمص",
    "خبز", "صمون", "توست",
    "دواء", "علاج", "بانادول", "فيتامين", "شاش", "قطن", "صيدلية", "مرهم", "قطرة",
    "حفاضات", "بامبرز", "مناديل مبللة", "حليب اطفال",
    "تايد", "زاهي", "صابون", "شامبو", "كلور", "معقم", "منظف", "اكياس زبالة", "ورق تواليت"
  ];

  if (
    cat.includes("خضار") ||
    cat.includes("لحوم") ||
    cat.includes("ألبان") ||
    cat.includes("مؤونة") ||
    cat.includes("بقوليات") ||
    cat.includes("مياه") ||
    cat.includes("صيدلية") ||
    cat.includes("طفل") ||
    cat.includes("منظفات") ||
    essentialKeywords.some(k => n.includes(k))
  ) {
    return {
      type: "essential",
      reason: "مؤونة أساسية وتغذية منزلية ضرورية",
      badge: "أساسي وتموين 🥦",
      colorClass: "text-emerald-600 dark:text-emerald-400",
      lightBg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40"
    };
  }

  return {
    type: "neutral",
    reason: "مشتريات عامة أو مستلزمات متنوعة",
    badge: "مشتريات عامة 🛒",
    colorClass: "text-indigo-600 dark:text-indigo-400",
    lightBg: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/40"
  };
}
