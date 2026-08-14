"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronLeft, ShoppingCart, Star, Clock, Users, PlayCircle, Loader2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [products, setProducts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const [productsSnap, coursesSnap, suppliesSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "courses")),
          getDocs(collection(db, "supplies"))
        ]);

        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setSupplies(suppliesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching for search:", error);
      }
      setLoading(false);
    };
    fetchResults();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/search?q=${query}`);
  };

  const filteredProducts = products.filter(p => query && p.name?.toLowerCase().includes(query.toLowerCase()));
  const filteredCourses = courses.filter(c => query && c.title?.toLowerCase().includes(query.toLowerCase()));
  const filteredSupplies = supplies.filter(s => query && s.name?.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-full">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-black">نتائج البحث</h1>
        </div>
        
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="ابحث عن كيك، دورات، مواد..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 rounded-2xl py-3 pr-10 pl-4 text-sm border border-gray-100 dark:border-zinc-700 focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all outline-none" 
          />
        </form>
      </header>

      {/* Results */}
      <div className="px-5 mt-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : (
          <>
            {filteredProducts.length === 0 && filteredCourses.length === 0 && filteredSupplies.length === 0 && query ? (
              <div className="text-center py-20 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>لا توجد نتائج مطابقة لبحثك</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredProducts.length > 0 && (
                  <div>
                    <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 bg-[#e8456b] rounded-full"></div>
                      الكيك والمنتجات ({filteredProducts.length})
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {filteredProducts.map(item => (
                        <Link href={`/shop/detail?id=${item.id}`} key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 border border-gray-100 dark:border-zinc-800 active:scale-[0.97] transition block">
                          <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-2.5 bg-gray-50 dark:bg-zinc-800">
                            {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                          </div>
                          <h4 className="font-bold text-xs mb-1.5 line-clamp-1">{item.name}</h4>
                          <div className="flex justify-between items-center">
                            <span className="text-[#e8456b] font-black text-xs">{Number(item.price).toLocaleString()} <span className="text-[9px] text-gray-400">د.ع</span></span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredCourses.length > 0 && (
                  <div>
                    <h2 className="font-bold text-lg mb-3 mt-6 flex items-center gap-2">
                      <div className="w-1 h-5 bg-[#d4a853] rounded-full"></div>
                      الدورات التعليمية ({filteredCourses.length})
                    </h2>
                    <div className="flex flex-col gap-3">
                      {filteredCourses.map(course => (
                        <Link href={`/courses/detail?id=${course.id}`} key={course.id} className="flex gap-3.5 p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 active:scale-[0.98] transition">
                          <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800">
                            {course.thumbnail && <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />}
                          </div>
                          <div className="flex flex-col justify-between py-0.5 flex-1 min-w-0">
                            <h4 className="font-bold text-sm mb-1 leading-snug line-clamp-2">{course.title}</h4>
                            <span className="font-black text-[#d4a853] text-sm">{Number(course.price).toLocaleString()} د.ع</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {filteredSupplies.length > 0 && (
                  <div>
                    <h2 className="font-bold text-lg mb-3 mt-6 flex items-center gap-2">
                      <div className="w-1 h-5 bg-[#4B5563] rounded-full"></div>
                      مواد وأدوات الكيك ({filteredSupplies.length})
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {filteredSupplies.map(supply => (
                        <Link href={`/supplies/detail?id=${supply.id}`} key={supply.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-2.5 border border-gray-100 dark:border-zinc-800 active:scale-[0.97] transition block">
                          <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 bg-gray-50 dark:bg-zinc-800">
                            {supply.image && <Image src={supply.image} alt={supply.name} fill className="object-cover" />}
                          </div>
                          <h4 className="font-bold text-xs mb-1.5 line-clamp-1">{supply.name}</h4>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-800 dark:text-gray-200 font-black text-xs">{Number(supply.price).toLocaleString()} <span className="text-[9px] text-gray-400">د.ع</span></span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>}>
      <SearchContent />
    </Suspense>
  );
}
