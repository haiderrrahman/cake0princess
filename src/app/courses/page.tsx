"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Clock, Star, Lock, Loader2, Users, Sparkles, Search, ChevronLeft, GraduationCap, Medal, StarIcon } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEMO_COURSES = [
  { id: "course-1", title: "ماستر كلاس صناعة الكيك الشاملة", price: 75000, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80", rating: "4.9", students: "2.3k", duration: "8 ساعات", level: "احترافي", description: "دورة شاملة تأخذك من الصفر إلى الاحتراف في عالم صناعة الكيك", locked: false },
  { id: "course-2", title: "فن تزيين الكيك بالكريمة والفوندان", price: 55000, image: "https://images.unsplash.com/photo-1486427944781-dbf45f4823a0?w=400&q=80", rating: "4.8", students: "1.8k", duration: "6 ساعات", level: "متوسط", description: "تعلم أساليب وتقنيات التزيين الحديثة", locked: false },
  { id: "course-3", title: "كيكات الفوندان والعجائن الفنية", price: 65000, image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=400&q=80", rating: "5.0", students: "980", duration: "5 ساعات", level: "متقدم", description: "أسرار الفوندان والزخارف الفنية المتقدمة", locked: false },
  { id: "course-4", title: "كيك الأعراس والمناسبات الخاصة", price: 85000, image: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c?w=400&q=80", rating: "4.9", students: "650", duration: "10 ساعات", level: "احترافي", description: "تعلم صناعة كيكات الأعراس الفاخرة", locked: true },
  { id: "course-5", title: "الكيك الصحي وبدائل السكر", price: 45000, image: "https://images.unsplash.com/photo-1562440499-64c9a111f713?w=400&q=80", rating: "4.7", students: "1.2k", duration: "4 ساعات", level: "مبتدئ", description: "وصفات كيك صحية بمكونات طبيعية", locked: false },
  { id: "course-6", title: "دورة كيك الشاي والطاوة", price: 25000, image: "https://images.unsplash.com/photo-1519869325930-281384150729?w=400&q=80", rating: "4.8", students: "2.1k", duration: "2 ساعات", level: "مبتدئ", description: "تعلم طرق عمل كيك الشاي الهش بأنواعه وكيك الطاوة السريع واللذيذ.", locked: false },
];

const LEVEL_COLORS: Record<string, string> = {
  "مبتدئ":   "from-emerald-400 to-teal-500",
  "متوسط":   "from-[#F5C842] to-[#FF6B35]",
  "متقدم":   "from-[#E040FB] to-[#FF3366]",
  "احترافي": "from-[#FF3366] to-[#c0392b]",
};

export default function Courses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const snapshot = await getDocs(collection(db, "courses"));
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCourses(items);
      } catch {
        setCourses([]);
      }
      setLoading(false);
    };
    fetchCourses();
  }, []);

  const filters = ["الكل", "مبتدئ", "متوسط", "متقدم", "احترافي"];
  const filteredCourses = courses
    .filter(c => activeFilter === "الكل" || c.level === activeFilter)
    .filter(c => !searchQuery || c.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GraduationCap className="w-10 h-10 animate-pulse text-[#FF3366]" />
      </div>
    );
  }

  const featured = filteredCourses[0] || null;

  return (
    <div className="flex flex-col min-h-screen pb-32 animate-slide-up">

      {/* ── Header ── */}
      <header className="px-5 pt-14 pb-6 glass sticky top-0 z-40 border-b border-white/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="relative mb-1">
          <h1 className="text-2xl font-black gradient-text-brand flex items-center gap-2">
            أكاديمية الكيك
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-white/50 dark:bg-white/5 px-4 py-1 rounded-full border border-white/40 dark:border-white/10">
            تعلم من الصفر حتى الاحتراف
          </p>
          <span className="text-[10px] text-white font-bold bg-[#FF3366] px-2.5 py-1 rounded-full shadow-sm">
            {filteredCourses.length} دورة
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن دورة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl py-2.5 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none font-medium"
          />
        </div>

        {/* Level Filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {filters.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-black transition-all duration-300 active:scale-90
                ${activeFilter === f
                  ? "bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white shadow-lg shadow-[#FF3366]/25"
                  : "glass-card text-gray-500 dark:text-gray-400"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* ── Featured Course ── */}
      {featured && (
        <section className="px-5 mt-5 mb-4">
          <Link href={`/courses/detail?id=${featured.id}`} className="block relative w-full h-52 rounded-[28px] overflow-hidden shadow-[0_16px_48px_rgba(255,51,102,0.2)] active:scale-[0.98] transition-all duration-300">
            <img
              src={featured.thumbnail || featured.image}
              alt={featured.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-5">
              <div className="flex gap-2 mb-2.5">
                <span className="bg-gradient-to-r from-[#F5C842] to-[#FF3366] text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" /> الأكثر مبيعاً
                </span>
                <span className={`bg-gradient-to-r ${LEVEL_COLORS[featured.level] || "from-gray-400 to-gray-600"} text-white text-[10px] font-black px-3 py-1 rounded-full`}>
                  {featured.level}
                </span>
              </div>
              <h2 className="text-lg font-black text-white mb-1.5 leading-snug">{featured.title}</h2>
              <div className="flex items-center gap-4 text-[11px] text-gray-300">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-[#F5C842] fill-[#F5C842]" /> {featured.rating}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {featured.students} طالب</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {featured.duration}</span>
              </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-xl">
              <PlayCircle className="w-7 h-7 text-white" />
            </div>
          </Link>
        </section>
      )}

      {/* ── Stats Banner ── */}
      <section className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: `${courses.length}+`, label: "دورة متاحة", icon: GraduationCap },
            { num: "0", label: "طالب معتمد", icon: Medal },
            { num: "0⭐", label: "تقييم ممتاز", icon: StarIcon },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-[18px] py-3 px-2 text-center flex flex-col items-center">
              <stat.icon className="w-6 h-6 mb-1 text-[#FF3366]" />
              <div className="font-black text-base text-gray-800 dark:text-white">{stat.num}</div>
              <div className="text-[9px] text-gray-400 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── All Courses ── */}
      <section className="px-5">
        <h3 className="text-base font-black mb-4 flex items-center gap-2 text-gray-800 dark:text-white">
          جميع الدورات
        </h3>
        <div className="flex flex-col gap-3.5">
          {filteredCourses.map((course, i) => (
            <Link
              href={`/courses/detail?id=${course.id}`}
              key={course.id || i}
              className="glass-card rounded-[22px] overflow-hidden active:scale-[0.98] transition-all duration-300 cake-card flex gap-0"
            >
              <div className="relative w-28 h-28 flex-shrink-0 overflow-hidden">
                <img src={course.thumbnail || course.image} alt={course.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-gradient-to-br ${LEVEL_COLORS[course.level] || "from-gray-400 to-gray-600"} opacity-40`} />
                {course.locked && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="absolute bottom-1.5 left-1.5 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-lg text-[9px] text-white font-black border border-white/20">
                  {course.duration}
                </div>
              </div>
              <div className="flex flex-col justify-between p-3.5 flex-1 min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`bg-gradient-to-r ${LEVEL_COLORS[course.level] || "from-gray-400 to-gray-600"} text-white text-[8px] font-black px-2 py-0.5 rounded-full`}>
                      {course.level}
                    </span>
                  </div>
                  <h4 className="font-black text-sm mb-1 leading-snug line-clamp-2 text-gray-800 dark:text-white">{course.title}</h4>
                  <div className="flex items-center gap-2.5 text-[9px] text-gray-400">
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-[#F5C842] fill-[#F5C842]" /> {course.rating}</span>
                    <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {course.students}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-black text-[#FF3366] text-sm">{Number(course.price).toLocaleString()} <span className="text-[9px] text-gray-400">د.ع</span></span>
                  <span className="bg-gradient-to-r from-[#FF3366] to-[#E040FB] text-white px-3 py-1 rounded-xl text-[9px] font-black shadow-md flex items-center gap-1">
                    اشترك الآن <ChevronLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="h-8" />
    </div>
  );
}
