"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Loader2, PlayCircle, Clock, Star } from "lucide-react";
import { doc, getDoc, collection, query, documentId, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function MyCourses() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/profile");
      return;
    }

    const fetchMyCourses = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const purchasedIds = userDoc.data().purchasedCourses || [];
          
          if (purchasedIds.length > 0) {
            // Firestore 'in' query supports max 10 items. For more, need chunks.
            // Assuming user has < 10 courses for now.
            const coursesRef = collection(db, "courses");
            const q = query(coursesRef, where("__name__", "in", purchasedIds));
            const snapshot = await getDocs(q);
            const coursesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setCourses(coursesData);
          } else {
            setCourses([]);
          }
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
      }
      setLoading(false);
    };

    fetchMyCourses();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-gray-50 dark:bg-zinc-950 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition -ml-2 active:scale-95 text-gray-800 dark:text-gray-200">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">دوراتي</h1>
        </div>
      </header>

      <div className="p-5">
        {courses.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800 mt-10">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد دورات حالياً</h2>
            <p className="text-gray-500 text-sm mb-6">لم تقم بالاشتراك في أي دورة بعد. تصفح دوراتنا لتطوير مهاراتك!</p>
            <Link href="/courses" className="inline-flex items-center justify-center bg-[#e8456b] hover:bg-[#d4394f] text-white font-bold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-[#e8456b]/20 active:scale-95">
              تصفح الدورات المتاحة
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {courses.map(course => (
              <div key={course.id} className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-zinc-800 group hover:shadow-md transition">
                <div className="relative h-48 w-full">
                  <Image 
                    src={course.image || "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80"}
                    alt={course.title}
                    fill
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg">
                    {course.level || "متوسط"}
                  </div>
                  
                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center cursor-pointer hover:bg-[#e8456b] transition-colors group/play">
                      <PlayCircle className="w-8 h-8 text-white group-hover/play:scale-110 transition-transform" />
                    </div>
                  </div>
                </div>
                
                <div className="p-5 relative">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-1">{course.title}</h3>
                  <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed mb-4">{course.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-400 border-t border-gray-50 dark:border-zinc-800 pt-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{course.duration || "غير محدد"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{course.rating || "5.0"}</span>
                    </div>
                  </div>
                  
                  <Link href={`/courses/detail?id=${course.id}`} className="mt-4 flex items-center justify-center w-full bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 font-bold py-3 rounded-2xl transition-colors text-sm">
                    متابعة الدورة
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
