"use client";
import Image from "next/image";
import Link from "next/link";
import { Star, ShoppingCart, Search, ChevronLeft, Clock, Users, ArrowLeft, Sparkles, Cake, GraduationCap, Paintbrush, Trophy, Heart, Coffee, Gift, PlayCircle, Crown, Info, Baby } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useCart } from "@/context/CartContext";
import NotificationBadge from "@/components/NotificationBadge";
import { useAuth } from "@/context/AuthContext";
import dynamic from "next/dynamic";
const AdminDashboard = dynamic(() => import("@/components/AdminDashboard"), { ssr: false });

// Demo products
const DEMO_PRODUCTS = [
  { id: "demo-1", name: "كيكة الفراولة الملكية", price: 45000, image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80", rating: "4.9", category: "أعياد ميلاد" },
  { id: "demo-2", name: "تشيز كيك التوت", price: 35000, image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80", rating: "4.8", category: "يومي" },
  { id: "demo-3", name: "كيكة الشوكولا الداكنة", price: 55000, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80", rating: "5.0", category: "مناسبات" },
  { id: "demo-4", name: "ريد فيلفت فاخرة", price: 50000, image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&q=80", rating: "4.7", category: "زفاف" },
  { id: "demo-5", name: "كيكة الكراميل المملحة", price: 40000, image: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&q=80", rating: "4.9", category: "يومي" },
  { id: "demo-9", name: "كيكة الشاي الكلاسيكية", price: 15000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80", rating: "4.8", category: "كيك الشاي" },
];

const DEMO_COURSES = [
  { id: "course-1", title: "ماستر كلاس صناعة الكيك", price: 75000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", rating: "4.9", students: "2.3k", lessons: 24, duration: "8 ساعات" },
  { id: "course-2", title: "فن تزيين الكيك بالكريمة", price: 55000, image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80", rating: "4.8", students: "1.8k", lessons: 18, duration: "6 ساعات" },
  { id: "course-3", title: "كيكات الفوندان والعجائن", price: 65000, image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&q=80", rating: "5.0", students: "980", lessons: 15, duration: "5 ساعات" },
  { id: "course-6", title: "دورة كيك الشاي والطاوة", price: 25000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80", rating: "4.8", students: "2.1k", lessons: 3, duration: "2 ساعات" },
];

const DEMO_SUPPLIES = [
  { id: "s-1", name: "طحين كيك فاخر", price: 4000, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80", category: "مواد أساسية" },
  { id: "s-2", name: "كريمة زبدة جاهزة", price: 8000, image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=400&q=80", category: "كريمات" },
  { id: "s-3", name: "حشوة شوكولاتة بلجيكية", price: 12000, image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&q=80", category: "حشوات" },
  { id: "s-4", name: "شموع أعياد ميلاد", price: 3500, image: "https://images.unsplash.com/photo-1530103043960-ef38714abb15?w=400&q=80", category: "زينة" },
  { id: "s-5", name: "كارتون كيك شفاف", price: 2000, image: "https://images.unsplash.com/photo-1587241321921-91a834d6d191?w=400&q=80", category: "علب وتغليف" },
  { id: "s-6", name: "أقماع تزيين الكريمة", price: 15000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "أدوات تزيين" },
  { id: "s-7", name: "ألوان طعام جل", price: 6000, image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=400&q=80", category: "ألوان" },
  { id: "s-8", name: "سبرنكلز ملون للتزيين", price: 4000, image: "https://images.unsplash.com/photo-1514517521153-1be72277b32f?w=400&q=80", category: "زينة" },
  { id: "s-9", name: "قواعد كيك خشبية", price: 5000, image: "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=400&q=80", category: "قواعد" },
  { id: "s-10", name: "أدوات خفق متكاملة", price: 18000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", category: "أدوات تزيين" },
];

const CATEGORIES = [
  { name: "الكل", icon: Sparkles, href: "/shop" },
  { name: "أعياد ميلاد", icon: Cake, href: "/shop?cat=birthday" },
  { name: "زفاف", icon: Heart, href: "/shop?cat=wedding" },
  { name: "شوكولا", icon: Gift, href: "/shop?cat=chocolate" },
  { name: "فراولة", icon: Star, href: "/shop?cat=strawberry" },
  { name: "كريمة", icon: Star, href: "/shop?cat=cream" },
  { name: "كيك الشاي", icon: Coffee, href: "/shop?cat=tea" },
  { name: "مناسبات", icon: Star, href: "/shop?cat=events" },
];

const QUICK_LINKS = [
  { name: "المتجر", icon: Cake, href: "/shop", gradient: "from-[#FF3366] to-[#c0392b]", desc: "تسوق الآن" },
  { name: "الأكاديمية", icon: GraduationCap, href: "/courses", gradient: "from-[#F5C842] to-[#c9a000]", desc: "تعلم بشغف" },
  { name: "أدوات ومواد", icon: Paintbrush, href: "/supplies", gradient: "from-fuchsia-400 to-fuchsia-600", desc: "أبدع بالكيك" },
  { name: "المسابقات", icon: Trophy, href: "/competitions", gradient: "from-[#FF6B35] to-[#FF3366]", desc: "اربح جوائز" },
];

const PARTICLES = ["🌸", "✨", "💕", "🎀", "⭐", "🌺", "💖", "🍰"];

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const router = useRouter();
  const { items: cartItems } = useCart();
  const cartItemCount = cartItems.reduce((total: number, item: any) => total + item.quantity, 0);
  const { isAdmin } = useAuth();

  // Banner auto-rotate
  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { collection, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const [productsSnap, coursesSnap, suppliesSnap, bannersSnap, adsSnap, categoriesSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "supplies")),
          getDocs(collection(db, "banners")),
          getDocs(collection(db, "ads")),
          getDocs(collection(db, "categories")),
        ]);
        const items = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const courseItems = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const supplyItems = suppliesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(items);
        setCourses(courseItems);
        setSupplies(supplyItems);
        setBanners(bannersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAds(adsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCategories(categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        

      } catch (error) {
        console.error("Error fetching home data:", error);
        setProducts([]);
        setCourses([]);
        setSupplies([]);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/search?q=${searchQuery}`);
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCourses = courses.filter(c =>
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen pb-32 animate-slide-up">

      {/* ══════════════════════════════
          HEADER
      ══════════════════════════════ */}
      <header className="sticky top-0 z-40 px-5 pt-14 pb-4 glass border-b border-white/50 dark:border-white/5 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-4">
          {/* Logo */}
          <div className="relative w-16 h-16 drop-shadow-xl shrink-0">
            <Image src="/cp-logo.png" alt="كيك الأميرة" fill className="object-contain" priority />
          </div>
          <div className="text-right flex flex-col justify-center">
            <h1 className="text-2xl font-black gradient-text-brand leading-normal py-1 mb-1.5">كيك الأميرة</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold bg-white/50 dark:bg-white/5 px-3 py-1 rounded-full border border-white/40 dark:border-white/10 inline-flex items-center justify-center gap-1">Cake Princess <Crown className="w-3 h-3 text-[#D4AF37]"/></p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="البحث"
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full rounded-2xl py-3.5 pr-11 pl-4 text-sm outline-none transition-all duration-300 font-medium
              ${searchFocused 
                ? "bg-white dark:bg-white/10 shadow-[0_0_0_2px_rgba(255,51,102,0.3)] border border-[#FF3366]/30" 
                : "bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10"
              }`}
          />
        </form>
      </header>

      {/* ══════════════════════════════
          ADMIN INTELLIGENCE PANEL
          (Visible to admins only)
      ══════════════════════════════ */}
      {isAdmin && <AdminDashboard />}

      {/* ══════════════════════════════
          HERO BANNER
      ══════════════════════════════ */}
      <section className="px-5 pt-5 pb-3">
        <div className="relative w-full h-52 rounded-[28px] overflow-hidden shadow-[0_16px_48px_rgba(255,51,102,0.2)]">
          {banners.length > 0 ? banners.map((banner, i) => (
            <div
              key={banner.id || i}
              className={`absolute inset-0 transition-all duration-1000 ${i === currentBanner ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-105"}`}
            >
              {(banner.image || banner.imageUrl) && (
                <Image src={banner.image || banner.imageUrl} alt={banner.title || "Banner"} fill sizes="(max-width: 768px) 100vw" className="object-cover" priority />
              )}
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/30 to-black/75" />

              <div className="absolute inset-0 flex flex-col justify-center p-6">
                <span className="bg-gradient-to-r from-[#F5C842] to-[#FF3366] text-white text-[10px] font-black px-3 py-1 rounded-full w-fit mb-2.5 flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" /> {banner.tag || "عرض خاص ✨"}
                </span>
                <h2 className="text-[22px] font-black text-white leading-tight max-w-[200px] mb-4 text-glow-brand">
                  {banner.title}
                </h2>
                <Link href={banner.link || "/shop"} className="w-fit bg-white text-[#FF3366] px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-xl active:scale-95 transition hover:shadow-[#FF3366]/30">
                  تسوق الآن <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FF3366] via-[#E040FB] to-[#F5C842] animate-gradient relative overflow-hidden flex items-center justify-center">
              <div className="text-center text-white z-10 px-6">
                <h2 className="text-2xl font-black mb-2 drop-shadow-lg flex items-center justify-center gap-2">كيك الأميرة <Crown className="w-6 h-6"/></h2>
                <p className="text-sm opacity-90 font-medium mb-4">أناقة المذاق الفاخر</p>
                <Link href="/shop" className="bg-white/20 backdrop-blur-md text-white px-6 py-2.5 rounded-2xl text-sm font-black border border-white/40 active:scale-95 transition shadow-lg inline-block">
                  اكتشف المتجر
                </Link>
              </div>
            </div>
          )}

          {/* Banner dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentBanner(i)}
                  className={`transition-all duration-300 rounded-full h-1.5 ${i === currentBanner ? "w-6 bg-white shadow-md" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════
          QUICK LINKS (4 GRID)
      ══════════════════════════════ */}
      <section className="px-5 py-4">
        <div className="grid grid-cols-4 gap-3">
          {QUICK_LINKS.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="flex flex-col items-center gap-1.5 active:scale-90 transition-all duration-200"
            >
              <div className={`w-14 h-14 rounded-[18px] bg-gradient-to-br ${link.gradient} flex items-center justify-center shadow-lg text-white cake-card`}>
                <link.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black text-gray-700 dark:text-gray-300">{link.name}</span>
              <span className="text-[8px] text-gray-400">{link.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CATEGORIES GRID (ثابتة - تحوّل للمتجر)
      ══════════════════════════════ */}
      <section className="px-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-gray-800 dark:text-white flex items-center gap-2">
            التصنيفات
          </h2>
          <Link href="/shop" className="text-xs font-black text-[#FF3366] flex items-center gap-0.5">
            الكل <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {(categories.length > 0 ? categories.slice(0, 8) : [
            { name: "أعياد ميلاد", href: "/shop?category=كيك+أعياد+الميلاد" },
            { name: "زفاف", href: "/shop?category=كيك+الزفاف+والخطوبة" },
            { name: "أطفال", href: "/shop?category=كيك+الأطفال" },
            { name: "شوكولا", href: "/shop?category=كيك+الشوكولا" },
            { name: "كيك شاي", href: "/shop?category=كيك+الشاي+والطاوة" },
            { name: "مناسبات", href: "/shop?category=كيك+المناسبات+الخاصة" },
            { name: "صحي", href: "/shop?category=كيك+صحي+ودايت" },
            { name: "تخرج", href: "/shop?category=كيك+التخرج+والنجاح" },
          ]).map((cat: any, i: number) => {
            // Assign icons based on name or use a default
            const getIcon = (name: string) => {
              if (name.includes("ميلاد")) return Cake;
              if (name.includes("زفاف") || name.includes("عرس") || name.includes("حب")) return Heart;
              if (name.includes("أطفال") || name.includes("ولادة")) return Baby;
              if (name.includes("شوكولا")) return Gift;
              if (name.includes("شاي") || name.includes("قهوة")) return Coffee;
              if (name.includes("تخرج") || name.includes("نجاح")) return GraduationCap;
              if (name.includes("صحي") || name.includes("دايت")) return Star;
              return Sparkles;
            };
            const Icon = cat.icon || getIcon(cat.name);
            const href = cat.href || `/shop?category=${encodeURIComponent(cat.name)}`;
            
            return (
              <Link
                key={cat.id || i}
                href={href}
                className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-[18px] glass-card active:scale-90 transition-all duration-200 text-center"
              >
                <Icon className="w-6 h-6 text-gray-700 dark:text-gray-300 mb-1" />
                <span className="text-[9px] font-black text-gray-700 dark:text-gray-300 leading-tight">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════
          COURSES — HORIZONTAL SCROLL
      ══════════════════════════════ */}
      <section className="pb-6">
        <div className="px-5 flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              أكاديمية الكيك
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">تعلم من الصفر حتى الاحتراف</p>
          </div>
          <Link href="/courses" className="flex items-center gap-1 text-xs font-black text-[#FF3366]">
            الكل <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5">
          {filteredCourses.slice(0, 4).map((course, i) => {
            const gradients = [
              "from-[#FF3366]/90 to-[#c0392b]/90",
              "from-[#F5C842]/90 to-[#E040FB]/90",
              "from-[#E040FB]/90 to-[#FF3366]/90",
              "from-[#FF6B35]/90 to-[#F5C842]/90",
            ];
            return (
              <Link
                href={`/courses/detail?id=${course.id}`}
                key={i}
                className="rounded-[20px] overflow-hidden glass-card shadow-md active:scale-95 transition-all duration-300 cake-card group flex flex-col"
              >
                <div className="relative w-full aspect-video overflow-hidden">
                  <Image src={course.thumbnail || course.image} alt={course.title} fill className="object-cover group-active:scale-105 transition-transform duration-500" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${gradients[i % gradients.length]} opacity-60`} />
                  <div className="absolute top-2 right-2 bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-black text-white border border-white/20">
                    {course.lessons || 0} درس
                  </div>
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-active:opacity-100 transition">
                    <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border border-white/50 text-sm"><PlayCircle className="w-4 h-4 text-white"/></div>
                  </div>
                </div>
                <div className="p-2.5 flex-1 flex flex-col">
                  <h3 className="font-black text-[11px] mb-1.5 line-clamp-2 text-gray-800 dark:text-white leading-snug flex-1">{course.title}</h3>
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <div className="flex items-center gap-1.5 text-[8px] text-gray-400">
                      <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-[#F5C842] fill-[#F5C842]" /> {course.rating}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {course.duration}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-black text-[#FF3366] text-[10px]">{Number(course.price).toLocaleString()} د.ع</span>
                      <span className="bg-[#FF3366] text-white px-2 py-0.5 rounded-lg text-[8px] font-bold shadow-sm">
                        التفاصيل
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════
          BEST SELLERS
      ══════════════════════════════ */}
      <section className="px-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              الأكثر مبيعاً
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">الكيكات المفضلة لدى زبائننا</p>
          </div>
          <Link href="/shop" className="flex items-center gap-1 text-xs font-black text-[#FF3366]">
            الكل <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
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
            {filteredProducts.slice(0, 6).map((item, i) => (
              <Link
                href={`/shop/detail?id=${item.id}`}
                key={i}
                className="glass-card rounded-[20px] overflow-hidden active:scale-95 transition-all duration-300 cake-card group relative"
              >
                {/* Hot badge for first 2 */}
                {i < 2 && (
                  <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md">
                    🔥 الأكثر طلباً
                  </div>
                )}
                <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-zinc-800">
                  {item.image && (
                    <Image src={item.image} alt={item.name} fill className="object-cover group-active:scale-110 transition-transform duration-500" />
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
          </div>
        )}
      </section>

      {/* ══════════════════════════════
          SUPPLIES & DECORATIONS
      ══════════════════════════════ */}
      <section className="px-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              مواد الكيك والتزيين
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">أفضل الأدوات لأجمل إبداعاتك</p>
          </div>
          <Link href="/supplies" className="flex items-center gap-1 text-xs font-black text-fuchsia-500">
            الكل <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-[20px] overflow-hidden glass-card shadow-sm">
                <div className="w-full aspect-square shimmer" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {supplies.slice(0, 4).map((item, i) => (
              <Link
                href={`/supplies/detail?id=${item.id}`}
                key={i}
                className="glass-card rounded-[20px] overflow-hidden active:scale-95 transition-all duration-300 cake-card group relative flex flex-col border border-fuchsia-500/10"
              >
                <div className="relative w-full aspect-square overflow-hidden bg-gray-100 dark:bg-zinc-800">
                  {item.image && (
                    <Image src={item.image} alt={item.name} fill className="object-cover group-active:scale-110 transition-transform duration-500" />
                  )}
                  {item.category && (
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-black text-white border border-white/20">
                      {item.category}
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-black text-xs mb-2 line-clamp-1 text-gray-800 dark:text-white flex-1">{item.name}</h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-fuchsia-500 font-black text-xs">{Number(item.price).toLocaleString()}</span>
                      <span className="text-[9px] text-gray-400 mr-0.5">د.ع</span>
                    </div>
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 flex items-center justify-center shadow-md">
                      <span className="text-white text-xs font-bold">+</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════════════════
          ADS
      ══════════════════════════════ */}
      {ads.length > 0 && (
        <section className="px-5 pb-8">
          <div className="flex flex-col gap-4">
            {ads.map((ad, i) => (
              <a
                key={ad.id || i}
                href={ad.link || "#"}
                target={ad.link ? "_blank" : "_self"}
                className="block relative w-full h-36 rounded-[24px] overflow-hidden shadow-xl active:scale-95 transition"
              >
                {(ad.image || ad.imageUrl) && <Image src={ad.image || ad.imageUrl} alt={ad.title || "إعلان"} fill className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 p-5 flex flex-col justify-end">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[9px] px-2.5 py-0.5 rounded-full mb-1.5 w-fit font-black border border-white/30 flex items-center gap-1">
                    <Info className="w-3 h-3"/> مساحة إعلانية
                  </span>
                  <h3 className="text-white font-black text-base leading-tight">{ad.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════
          FOOTER STRIP
      ══════════════════════════════ */}
      <section className="px-5 pb-4">
        <div className="rounded-[24px] bg-gradient-to-br from-[#FF3366] via-[#E040FB] to-[#F5C842] animate-gradient p-5 text-center shadow-xl relative overflow-hidden">
          <h3 className="text-white font-black text-base mb-1 flex items-center justify-center gap-2">كيك الأميرة <Crown className="w-4 h-4"/></h3>
          <p className="text-white/80 text-xs font-medium mb-3">الحلاوة في كل لقمة، والأناقة في كل مناسبة</p>
          <Link href="/support" className="inline-block bg-white/20 backdrop-blur-md text-white px-5 py-2 rounded-2xl text-xs font-black border border-white/30 active:scale-95 transition">
            تواصل معنا
          </Link>
        </div>
      </section>

    </div>
  );
}
