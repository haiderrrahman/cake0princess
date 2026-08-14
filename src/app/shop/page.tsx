"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ShoppingCart, Plus, Star, X, CakeSlice, Coffee, PartyPopper, Heart, Baby, GraduationCap, Leaf, Flame, Cake } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";

const DEMO_PRODUCTS = [
  { id: "demo-1", name: "كيكة الفراولة الملكية", price: 45000, image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80", rating: "4.9", category: "كيك أعياد الميلاد" },
  { id: "demo-2", name: "تشيز كيك التوت الأزرق", price: 35000, image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80", rating: "4.8", category: "الكيك اليومي والكلاسيكي" },
  { id: "demo-3", name: "كيكة الشوكولا الداكنة", price: 55000, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80", rating: "5.0", category: "كيك المناسبات الخاصة" },
  { id: "demo-4", name: "ريد فيلفت فاخرة", price: 50000, image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&q=80", rating: "4.7", category: "كيك الزفاف والخطوبة" },
  { id: "demo-5", name: "كيكة الكراميل المملحة", price: 40000, image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400&q=80", rating: "4.9", category: "الكيك اليومي والكلاسيكي" },
  { id: "demo-6", name: "كيكة يونيكورن للأطفال", price: 60000, image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&q=80", rating: "4.8", category: "كيك الأطفال" },
  { id: "demo-7", name: "كيكة التخرج الذهبية", price: 65000, image: "https://images.unsplash.com/photo-1562440499-64c9a111f713?w=400&q=80", rating: "5.0", category: "كيك التخرج والنجاح" },
  { id: "demo-8", name: "كيكة بروتين صحية", price: 38000, image: "https://images.unsplash.com/photo-1486427944781-dbf45f4823a0?w=400&q=80", rating: "4.6", category: "كيك صحي ودايت" },
  { id: "demo-9", name: "كيكة الشاي الكلاسيكية", price: 15000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80", rating: "4.8", category: "كيك الشاي والطاوة" },
  { id: "demo-10", name: "كيكة الطاوة السريعة", price: 12000, image: "https://images.unsplash.com/photo-1540337706094-da10342c93d8?w=400&q=80", rating: "4.9", category: "كيك الشاي والطاوة" },
];

const CAT_ICONS: Record<string, any> = {
  "الكل": SparklesIcon,
  "كيك أعياد الميلاد": Cake,
  "الكيك اليومي والكلاسيكي": Coffee,
  "كيك المناسبات الخاصة": PartyPopper,
  "كيك الزفاف والخطوبة": Heart,
  "كيك الأطفال": Baby,
  "كيك التخرج والنجاح": GraduationCap,
  "كيك صحي ودايت": Leaf,
  "كيك الشاي والطاوة": Flame,
};

function SparklesIcon(props: any) {
  return <Star {...props} />;
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"ready" | "custom">("ready");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "الكل");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"none" | "low" | "high">("none");
  const [categories, setCategories] = useState<string[]>(["الكل"]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "categories"))
        ]);
        const items = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(items);
        const cats = categoriesSnap.docs.map(doc => doc.data().name);
        setCategories(["الكل", ...cats]);
      } catch {
        setProducts([]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  let filteredProducts = products
    .filter(p => selectedCategory === "الكل" || p.category === selectedCategory)
    .filter(p => !searchQuery || p.name?.includes(searchQuery));

  if (sortOrder === "low") filteredProducts.sort((a, b) => Number(a.price) - Number(b.price));
  else if (sortOrder === "high") filteredProducts.sort((a, b) => Number(b.price) - Number(a.price));

  return (
    <div className="flex flex-col min-h-screen pb-32 animate-slide-up">

      {/* ── Header ── */}
      <header className="px-5 pt-14 pb-6 glass sticky top-0 z-40 border-b border-white/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="relative mb-1">
          <h1 className="text-2xl font-black gradient-text-brand flex items-center justify-center gap-2">
            متجر الكيك
          </h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium bg-white/50 dark:bg-white/5 px-4 py-1 rounded-full border border-white/40 dark:border-white/10">أجمل الكيكات لأحلى المناسبات</p>

        {/* Search + Filter */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث عن كيك..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none font-medium"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="bg-gradient-to-br from-[#FF3366]/10 to-[#E040FB]/10 text-[#FF3366] p-3 rounded-2xl active:scale-90 transition relative border border-[#FF3366]/20"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {sortOrder !== "none" && <span className="absolute top-2 right-2 w-2 h-2 bg-[#FF3366] rounded-full" />}
            </button>
            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute top-full left-0 mt-2 glass-card w-[220px] rounded-[20px] p-4 shadow-xl z-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-black text-gray-800 dark:text-white">ترتيب السعر</h3>
                    <button onClick={() => setIsFilterOpen(false)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  {[["none","الافتراضي"], ["low","الأقل سعراً"], ["high","الأعلى سعراً"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setSortOrder(val as any); setIsFilterOpen(false); }}
                      className={`w-full text-right p-2.5 rounded-xl mb-1.5 text-xs font-black transition-all ${sortOrder === val ? "bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white" : "bg-white/50 dark:bg-white/5 text-gray-600 dark:text-gray-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Categories Grid (مثل الرئيسية) ── */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-4 gap-2.5">
          {categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => setSelectedCategory(cat)}
              className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-[18px] transition-all duration-300 active:scale-90 text-center
                ${selectedCategory === cat
                  ? "bg-gradient-to-br from-[#FF3366] to-[#E040FB] shadow-lg shadow-[#FF3366]/25"
                  : "glass-card"
                }`}
            >
              <span className={`flex justify-center items-center h-8 w-8 mb-1 ${selectedCategory === cat ? "text-white" : "text-gray-600 dark:text-gray-400"}`}>
                {CAT_ICONS[cat] ? (() => { const Icon = CAT_ICONS[cat]; return <Icon className="w-6 h-6" />; })() : <Cake className="w-6 h-6" />}
              </span>
              <span className={`text-[9px] font-black leading-tight line-clamp-2
                ${selectedCategory === cat ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-5 mb-4">
        <div className="flex p-1 glass-card rounded-2xl">
          <button
            onClick={() => setActiveTab("ready")}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all duration-300
              ${activeTab === "ready"
                ? "bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white shadow-md"
                : "text-gray-400"
              }`}
          >
            كيك جاهز
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all duration-300
              ${activeTab === "custom"
                ? "bg-gradient-to-r from-[#F5C842] to-[#FF6B35] text-white shadow-md"
                : "text-gray-400"
              }`}
          >
            طلب خاص
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-5">
        {activeTab === "ready" ? (
          loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-[20px] overflow-hidden glass-card">
                  <div className="w-full aspect-square shimmer" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-3/4 rounded-full shimmer" />
                    <div className="h-3 w-1/2 rounded-full shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((item, i) => (
                <Link
                  href={`/shop/detail?id=${item.id}`}
                  key={i}
                  className="glass-card rounded-[20px] overflow-hidden active:scale-95 transition-all duration-300 cake-card group relative block"
                >
                  {i < 2 && (
                    <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      الأكثر طلباً
                    </div>
                  )}
                  <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-100 dark:bg-zinc-800">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover group-active:scale-110 transition-transform duration-500" />
                    )}
                    <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-xl text-[9px] font-black flex items-center gap-0.5 text-white border border-white/20">
                      <Star className="w-2.5 h-2.5 text-[#F5C842] fill-[#F5C842]" />
                      {item.rating || "4.9"}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-black text-xs mb-2 line-clamp-1 text-gray-800 dark:text-white">{item.name}</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[#FF3366] font-black text-xs">{Number(item.price).toLocaleString()}</span>
                        <span className="text-[9px] text-gray-400 mr-0.5">د.ع</span>
                      </div>
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#FF3366] to-[#E040FB] flex items-center justify-center shadow-md">
                        <ShoppingCart className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-2 text-center py-16">
                  <Cake className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-black text-gray-400">لا توجد كيكات في هذا التصنيف</p>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="rounded-[28px] overflow-hidden glass-card p-8 text-center relative">
            <Cake className="w-12 h-12 mx-auto text-[#F5C842] mb-3" />
            <h3 className="text-xl font-black mb-2 gradient-text-brand">صمم كيكتك الخاصة</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              اختر الحجم، النكهة، والتصميم الذي تحلم به، وسنخبزه خصيصاً لك.
            </p>
            <Link
              href="/custom-design"
              className="w-full bg-gradient-to-r from-[#F5C842] to-[#FF6B35] text-white py-3.5 rounded-2xl font-black flex justify-center items-center gap-2 shadow-lg active:scale-[0.98] transition"
            >
              ابدأ التصميم الآن <Plus className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      <div className="h-8" />
    </div>
  );
}

export default function Shop() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Cake className="w-8 h-8 text-[#FF3366] animate-pulse" />
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}
