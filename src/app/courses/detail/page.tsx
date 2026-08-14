"use client";
import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, PlayCircle, Clock, Star, Users, CheckCircle2, FileText, Lock, Loader2, Heart, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";

function DetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as string;
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const docRef = doc(db, "courses", id);
        const coursePromise = getDoc(docRef);
        const userPromise = user?.uid ? getDoc(doc(db, "users", user.uid)) : Promise.resolve(null);

        const [docSnap, userDoc] = await Promise.all([coursePromise, userPromise]);

        if (docSnap.exists()) {
          const courseData: any = { id: docSnap.id, ...docSnap.data() };
          setCourse(courseData);
          
          let hasPurchased = false;
          if (userDoc && userDoc.exists()) {
            const purchased = userDoc.data().purchasedCourses || [];
            hasPurchased = purchased.includes(id);
            setIsEnrolled(hasPurchased);
          }

          if (courseData.curriculum && courseData.curriculum.length > 0) {
            if (hasPurchased) {
              setCurrentVideoId(courseData.curriculum[0].videoId);
            } else {
              const freeVid = courseData.curriculum.find((c: any) => c.free);
              if (freeVid) {
                setCurrentVideoId(freeVid.videoId);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching course:", error);
      }
      setLoading(false);
    };

    fetchCourse();
  }, [id, user]);

  const [showLockedModal, setShowLockedModal] = useState(false);

  const handleAddToCart = () => {
    if (!course) return;
    addToCart({
      id: course.id,
      name: course.title,
      price: course.price,
      quantity: 1,
      image: course.image || course.thumbnail || "",
      isCourse: true
    });
    router.push("/cart");
  };

  const isBunnyStream = currentVideoId && currentVideoId.includes('mediadelivery.net');
  const isYouTube = !isBunnyStream && currentVideoId && (currentVideoId.includes('youtube.com') || currentVideoId.includes('youtu.be') || (!currentVideoId.includes('http') && !currentVideoId.includes('/')));
  
  let ytId = "";
  if (isYouTube && currentVideoId) {
    ytId = (!currentVideoId.includes('http') && !currentVideoId.includes('/')) 
      ? currentVideoId 
      : currentVideoId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^&?]+)/)?.[1] || "";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">الدورة غير موجودة</h1>
        <Link href="/courses" className="bg-[#d4a853] text-white px-6 py-2 rounded-xl hover:bg-[#c29642] transition">العودة للأكاديمية</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-zinc-950 pb-48">
      {/* Header */}
      <header className="px-4 py-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/courses" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
            <ChevronRight className="w-6 h-6" />
          </Link>
          <h1 className="text-lg font-bold truncate">{course.title}</h1>
        </div>
        <button 
          onClick={() => toggleFavorite({
            id: course.id,
            name: course.title,
            price: course.price,
            image: course.image,
            isCourse: true
          })}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
        >
          <Heart className={`w-6 h-6 ${isFavorite(course?.id) ? 'text-red-500 fill-red-500' : 'text-gray-500'}`} />
        </button>
      </header>

      {currentVideoId ? (
        <div className="w-full aspect-video bg-black relative overflow-hidden group">
          {!isPlaying ? (
            <div 
              className="absolute inset-0 cursor-pointer flex items-center justify-center z-10"
              onClick={() => setIsPlaying(true)}
            >
              <img 
                src={isYouTube ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : (course.image || '/images/placeholder.jpg')} 
                alt="Video Thumbnail" 
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="z-20 w-16 h-16 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-md group-hover:bg-[#d4a853] group-hover:scale-110 transition-all shadow-2xl">
                <PlayCircle className="w-8 h-8" />
              </div>
            </div>
          ) : (
            isBunnyStream ? (
              <iframe 
                src={currentVideoId.includes('autoplay') ? currentVideoId : `${currentVideoId}${currentVideoId.includes('?') ? '&' : '?'}autoplay=true`}
                loading="lazy"
                className="absolute top-0 left-0 w-full h-full border-0"
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
                allowFullScreen
              ></iframe>
            ) : isYouTube ? (
              <div className="w-full h-full relative group/yt bg-black overflow-hidden">
                {/* Overlay to block clicking the top title/channel bar */}
                <div className="absolute top-0 left-0 right-0 h-16 z-50 bg-transparent" style={{ cursor: 'default' }}></div>
                
                {/* Overlay to block clicking the YouTube logo on bottom right */}
                <div className="absolute bottom-0 right-0 w-28 h-16 z-50 bg-transparent" style={{ cursor: 'default' }}></div>
                
                <iframe 
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&showinfo=0&iv_load_policy=3&fs=1`} 
                  className="absolute inset-0 w-full h-full border-0 z-10"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <video 
                src={currentVideoId} 
                className="absolute top-0 left-0 w-full h-full object-contain bg-black"
                controls 
                autoPlay 
                playsInline
                preload="metadata"
              ></video>
            )
          )}
        </div>
      ) : (
        <div className="w-full bg-black aspect-video relative overflow-hidden flex items-center justify-center">
          {course.image && (
            <img 
              src={course.image}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20">
            {isEnrolled ? (
              <>
                <FileText className="w-12 h-12 text-white/80 mb-3 drop-shadow-lg" />
                <p className="text-white font-bold bg-black/60 px-6 py-2.5 rounded-full backdrop-blur-md border border-white/10 shadow-2xl">
                  قريباً... يتم تجهيز دروس هذه الدورة
                </p>
              </>
            ) : (
              <>
                <Lock className="w-12 h-12 text-white/80 mb-3 drop-shadow-lg" />
                <p className="text-white font-bold bg-black/60 px-6 py-2.5 rounded-full backdrop-blur-md border border-white/10 shadow-2xl">
                  اشترك في الدورة لمشاهدة الدروس
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Course Info */}
      <div className="p-6 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex gap-2 mb-3">
          <span className="bg-[#d4a853]/10 text-[#d4a853] text-[10px] font-bold px-2 py-1 rounded-md uppercase">{course.level || "احترافي"}</span>
          <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-1 rounded-md uppercase">شهادة معتمدة</span>
        </div>
        <h2 className="text-2xl font-bold mb-2 leading-tight">{course.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-3">
          {course.description}
        </p>
        
        <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-300 font-medium">
          <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {course.rating || "4.9"} تقييم</div>
          <div className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {course.students || "1k"} طالب</div>
          <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {course.duration || "ساعات"}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-zinc-900 mt-2 sticky top-[73px] z-30 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex px-2 overflow-x-auto hide-scrollbar">
          {['overview', 'curriculum', 'reviews'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition ${activeTab === tab ? 'border-[#d4a853] text-[#d4a853]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {tab === 'overview' ? 'نظرة عامة' : tab === 'curriculum' ? 'الدروس' : 'التقييمات'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 bg-white dark:bg-zinc-900 min-h-[300px]">
        {activeTab === 'overview' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="font-bold mb-3">ماذا ستتعلم في هذه الدورة؟</h3>
            <ul className="space-y-3 mb-8">
              {(course.learningPoints || []).map((item: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
              {!course.learningPoints && (
                <li className="text-gray-500 text-sm">محتوى الدورة غير متوفر حالياً.</li>
              )}
            </ul>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">محتوى الدورة</h3>
              <span className="text-xs text-gray-500">{(course.curriculum || []).length} درس • {course.duration}</span>
            </div>
            
            <div className="space-y-3">
              {(course.curriculum || []).map((lesson: any, i: number) => {
                const isActive = currentVideoId === lesson.videoId;
                const canPlay = lesson.free || isEnrolled;
                return (
                <div 
                  key={i} 
                  onClick={() => {
                    if (canPlay && lesson.videoId) {
                      setCurrentVideoId(lesson.videoId);
                      setIsPlaying(true);
                    }
                    else if (!canPlay) setShowLockedModal(true);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${canPlay ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800' : ''} ${isActive ? 'border-[#d4a853] bg-[#d4a853]/10' : lesson.free ? 'border-[#d4a853]/20 bg-[#d4a853]/5' : 'border-gray-100 dark:border-zinc-800 transition-colors'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#d4a853] text-white' : lesson.free ? 'bg-[#d4a853]/20 text-[#d4a853]' : 'bg-gray-100 text-gray-400 dark:bg-zinc-800'}`}>
                    {lesson.type === 'video' ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-sm font-bold ${isActive ? 'text-[#d4a853]' : (!lesson.free && !isEnrolled) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{lesson.title}</h4>
                    <p className={`text-xs ${isActive ? 'text-[#d4a853]/80' : 'text-gray-500'}`}>{lesson.time}</p>
                  </div>
                  {lesson.free && !isEnrolled ? (
                    <span className="text-[10px] font-bold text-[#d4a853] bg-[#d4a853]/10 px-2 py-1 rounded">مجاني</span>
                  ) : isActive ? (
                    <span className="text-[10px] font-bold text-white bg-[#d4a853] px-2 py-1 rounded">يتم العرض</span>
                  ) : (
                    !isEnrolled && <Lock className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              )})}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center justify-center py-10 text-center">
            <Star className="w-12 h-12 text-yellow-500 fill-yellow-500 mb-3 opacity-50" />
            <h3 className="font-bold mb-1">التقييمات ممتازة</h3>
            <p className="text-sm text-gray-500">هذه الدورة حازت على إعجاب أكثر من {course.students || "1k"} متدرب بدرجة {course.rating || "4.9"}/5</p>
          </div>
        )}
      </div>

      {/* Locked Lesson Modal */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowLockedModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center mt-4 mb-6">
              <div className="w-16 h-16 bg-[#d4a853]/10 text-[#d4a853] rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black mb-2">الدرس مقفول</h3>
              <p className="text-sm text-gray-500">هذا الدرس متاح للمشتركين فقط. يرجى الاشتراك في الدورة أولاً لتتمكن من مشاهدة جميع الدروس والمحتوى الحصري.</p>
            </div>
            <button 
              onClick={() => {
                setShowLockedModal(false);
                if (course) {
                  handleAddToCart();
                }
              }}
              className="w-full bg-[#d4a853] hover:bg-[#c29642] text-white py-3.5 rounded-xl font-bold transition active:scale-95 shadow-lg shadow-[#d4a853]/20"
            >
              اشترك في الدورة الآن
            </button>
          </div>
        </div>
      )}

      {/* Sticky Bottom Buy Button */}
      <div className="fixed bottom-[72px] left-0 w-full p-4 bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between z-40">
        {isEnrolled ? (
          <div className="flex w-full items-center justify-between gap-4">
            <div>
              <p className="text-xs text-green-600 font-bold mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> أنت مشترك
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">الدورة متاحة للمشاهدة</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-6 py-3 rounded-full font-bold text-sm">
              تم التفعيل
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">سعر الدورة</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-[#d4a853]">{course.price.toLocaleString()} د.ع</p>
                {course.originalPrice && (
                  <p className="text-xs text-gray-400 line-through">{course.originalPrice.toLocaleString()} د.ع</p>
                )}
              </div>
            </div>
            <button onClick={handleAddToCart} className="bg-[#d4a853] hover:bg-[#c29642] text-white px-8 py-3.5 rounded-full font-bold shadow-lg shadow-[#d4a853]/20 dark:shadow-none transition transform active:scale-95">
              اشترك الآن
            </button>
          </>
        )}
      </div>
      
      <BottomNav />
    </div>
  );
}

export default function CourseDetails() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#d4a853]" /></div>}>
      <DetailPage />
    </Suspense>
  );
}
