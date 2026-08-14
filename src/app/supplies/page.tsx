"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Search, Sparkles, ChevronLeft, Tag, ShoppingCart, Box, Droplet, PartyPopper, Gift, Paintbrush, Palette, Utensils, StarIcon } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

const DEMO_SUPPLIES = [
  { id: "s-1", name: "طحين كيك فاخر", price: 4000, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80", category: "مواد أساسية" },
  { id: "s-2", name: "كريمة زبدة جاهزة", price: 8000, image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80", category: "كريمات وحشوات" },
  { id: "s-3", name: "حشوة شوكولاتة بلجيكية", price: 12000, image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80", category: "كريمات وحشوات" },
  { id: "s-4", name: "شموع أعياد ميلاد", price: 3500, image: "https://images.unsplash.com/photo-1530103043960-ef38714abb15?w=400&q=80", category: "أعياد ميلاد" },
  { id: "s-5", name: "كارتون كيك شفاف", price: 2000, image: "https://images.unsplash.com/photo-1587241321921-91a834d6d191?w=400&q=80", category: "علب وتغليف" },
  { id: "s-6", name: "أقماع تزيين الكريمة", price: 15000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "أدوات تزيين" },
  { id: "s-7", name: "ألوان طعام جل", price: 6000, image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80", category: "ألوان ونكهات" },
  { id: "s-8", name: "سبرنكلز ملون للتزيين", price: 4000, image: "https://images.unsplash.com/photo-1514517521153-1be72277b32f?w=400&q=80", category: "أدوات تزيين" },
  { id: "s-9", name: "قواعد كيك خشبية", price: 5000, image: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&q=80", category: "قوالب" },
  { id: "s-10", name: "أدوات خفق متكاملة", price: 18000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "قوالب" },
];

const CAT_ICONS: Record<string, any> = {
  "الكل": SparklesIcon,
  "مواد أساسية": Box,
  "كريمات وحشوات": Droplet,
  "أعياد ميلاد": PartyPopper,
  "علب وتغليف": Gift,
  "أدوات تزيين": Paintbrush,
  "ألوان ونكهات": Palette,
  "قوالب": Utensils,
};

function SparklesIcon(props: any) {
  return <StarIcon {...props} />;
}

function SuppliesContent() {
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "الكل");
  const [supplies, setSupplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<string[]>(["الكل"]);
  const [sortPrice, setSortPrice] = useState<"none" | "asc" | "desc">("none");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliesSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "supplies")),
          getDocs(collection(db, "supplies_categories"))
        ]);
        const items = suppliesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSupplies(items);
        const cats = categoriesSnap.docs.map(doc => doc.data().name);
        setCategories(["الكل", ...cats]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  let filteredSupplies = supplies
    .filter(s => selectedCategory === "الكل" || s.category === selectedCategory)
    .filter(s => !searchQuery || s.name?.includes(searchQuery));

  if (sortPrice === "asc") filteredSupplies = [...filteredSupplies].sort((a, b) => Number(a.price) - Number(b.price));
  if (sortPrice === "desc") filteredSupplies = [...filteredSupplies].sort((a, b) => Number(b.price) - Number(a.price));

  return (
    <div className="flex flex-col min-h-screen pb-32 animate-slide-up">

      {/* ── Header ── */}
      <header className="px-5 pt-14 pb-6 glass sticky top-0 z-40 border-b border-white/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="relative mb-1">
          <h1 className="text-2xl font-black gradient-text-brand flex items-center justify-center gap-2">
            مواد الكيك والتزيين
          </h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium bg-white/50 dark:bg-white/5 px-4 py-1 rounded-full border border-white/40 dark:border-white/10">أفضل الأدوات والمواد لأجمل إبداعاتك</p>

        {/* Search + Sort */}
        <div className="flex gap-2.5 mt-4 w-full">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث عن الأدوات أو المواد..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none font-medium"
            />
          </div>
          <select
            value={sortPrice}
            onChange={e => setSortPrice(e.target.value as any)}
            className="bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl px-3 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FF3366]/30 text-gray-600 dark:text-gray-300"
          >
            <option value="none">الترتيب</option>
            <option value="asc">سعر ↑</option>
            <option value="desc">سعر ↓</option>
          </select>
        </div>
      </header>

      {/* ── Categories ── */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-y-4 gap-x-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl shadow-sm border border-black/5 dark:border-white/5 ${
                selectedCategory === cat 
                  ? "bg-gradient-to-br from-[#FF3366] to-[#E040FB] shadow-lg shadow-pink-500/20 text-white" 
                  : "bg-white dark:bg-zinc-800"
              }`}>
                {CAT_ICONS[cat] ? (() => { const Icon = CAT_ICONS[cat]; return <Icon className="w-6 h-6" />; })() : <Box className="w-6 h-6" />}
              </div>
              <span className={`text-[9.5px] text-center font-black leading-tight ${selectedCategory === cat ? "text-[#FF3366]" : "text-gray-500 dark:text-gray-400"}`}>
                {cat}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Items Grid ── */}
      <div className="px-5 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-[20px] overflow-hidden glass-card shadow-sm border border-white/50 dark:border-white/5">
                <div className="w-full aspect-square shimmer" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 rounded-full shimmer" />
                  <div className="h-3 w-1/2 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSupplies.length === 0 ? (
          <div className="text-center py-20">
            <Box className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-bold">عذراً، لا توجد مواد مطابقة للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredSupplies.map((item, i) => (
              <Link
                href={`/supplies/detail?id=${item.id}`}
                key={i}
                className="glass-card rounded-[20px] overflow-hidden cake-card group relative flex flex-col"
              >
                <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-zinc-800">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover group-active:scale-105 transition-transform duration-500"
                  />
                  {item.category && (
                    <div className="absolute top-2 right-2 z-10 bg-black/40 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-lg border border-white/20">
                      {item.category}
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-black text-[11px] mb-1.5 text-gray-800 dark:text-white leading-snug line-clamp-2 flex-1">
                    {item.name}
                  </h3>
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <span className="font-black text-[#FF3366] text-xs">
                      {Number(item.price).toLocaleString()} د.ع
                    </span>
                    <button className="bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform">
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default function Supplies() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Paintbrush className="w-8 h-8 text-[#FF3366] animate-pulse" />
      </div>
    }>
      <SuppliesContent />
    </Suspense>
  );
}
