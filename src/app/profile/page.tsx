"use client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, LogOut, Shield, Crown, Camera, Loader2, User as UserIcon, Search, Package } from "lucide-react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

export default function ProfilePage() {
  const { user, loading, logout: authLogout, isAdmin } = useAuth();
  const router = useRouter();
  
  const [profileStats, setProfileStats] = useState({ orders: 0, courses: 0, favorites: 0 });
  const [userData, setUserData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Guest state
  const [guestPhone, setGuestPhone] = useState("");
  const [isGuestSearching, setIsGuestSearching] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfileStats = async () => {
      setStatsLoading(true);
      try {
        const [ordersSnap, favSnap, userDocSnap] = await Promise.all([
          getDocs(query(collection(db, "orders"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "favorites"), where("userId", "==", user.uid))),
          getDoc(doc(db, "users", user.uid))
        ]);
        
        const allOrders = ordersSnap.docs.map(d => d.data() as any);
        const coursesCount = allOrders.reduce((sum: number, o: any) => {
          return sum + (o.items || []).filter((i: any) => i.isCourse).length;
        }, 0);
        
        let points = 0;
        allOrders.forEach(o => {
          if (o.status === "completed" || o.status === "delivered") {
            points += Math.floor((o.total || 0) / 1000); // 1 point per 1000 IQD
          }
        });

        let rank = "مبتدئ";
        let rankColor = "text-gray-500";
        if (points >= 5000) { rank = "ألماسي 💎"; rankColor = "text-blue-500"; }
        else if (points >= 2000) { rank = "ذهبي 🥇"; rankColor = "text-yellow-500"; }
        else if (points >= 500) { rank = "فضي 🥈"; rankColor = "text-gray-400"; }
        else if (points >= 100) { rank = "برونزي 🥉"; rankColor = "text-amber-700"; }

        setProfileStats({
          orders: ordersSnap.size,
          courses: coursesCount,
          favorites: favSnap.size,
        });

        const data = userDocSnap.exists() ? userDocSnap.data() : {};
        data.points = points;
        data.rank = rank;
        data.rankColor = rankColor;
        setUserData(data);

        // Update rank in db asynchronously
        if (userDocSnap.exists() && (data.points !== points || data.rank !== rank)) {
          updateDoc(doc(db, "users", user.uid), { points, rank });
        }
      } catch (e) {
        console.error("Profile stats error", e);
      }
      setStatsLoading(false);
    };
    fetchProfileStats();
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    const file = e.target.files[0];

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً! الحد الأقصى 5MB");
      return;
    }
    
    setIsUploading(true);
    try {
      // Store using Firebase Storage instead of Imgur
      const fileRef = ref(storage, `profiles/${user.uid}_${Date.now()}`);
      await uploadBytes(fileRef, file);
      const photoUrl = await getDownloadURL(fileRef);

      // Store Imgur URL in Firestore
      await updateDoc(doc(db, "users", user.uid), { photoURL: photoUrl });
      // Update Firebase Auth profile
      await updateProfile(user, { photoURL: photoUrl });
      
      toast.success("تم تغيير الصورة بنجاح! ✅");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("Image upload failed:", err);
      toast.error("فشل رفع الصورة. يرجى المحاولة مرة أخرى.");
    }
    setIsUploading(false);
  };

  const handleGuestTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestPhone.trim()) {
      setIsGuestSearching(true);
      router.push(`/track-order?q=${guestPhone.trim()}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 px-5 pt-12 pb-32">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-pink-50 dark:bg-zinc-900 rounded-[22px] flex items-center justify-center mx-auto mb-4 border border-pink-100 dark:border-zinc-800">
            <UserIcon className="w-10 h-10 text-pink-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">أهلاً بك كضيف</h1>
          <p className="text-sm text-gray-500">قم بتسجيل الدخول للحصول على النقاط والمراتب وتجربة أفضل</p>
        </div>

        <div className="space-y-4 mb-10">
          <button onClick={() => router.push('/login')} className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-black text-base shadow-sm transition-all active:scale-[0.98]">
            تسجيل الدخول / إنشاء حساب
          </button>
        </div>

        <div className="glass-card rounded-[24px] p-6 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800">
          <Package className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h2 className="text-lg font-black text-gray-800 dark:text-white mb-1">تتبع طلباتك كضيف</h2>
          <p className="text-xs text-gray-500 mb-5">أدخل رقم الهاتف الذي استخدمته في الطلب لتتبع الحالة</p>
          
          <form onSubmit={handleGuestTrack} className="flex gap-2">
            <button type="submit" disabled={!guestPhone || isGuestSearching} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 rounded-xl flex items-center justify-center disabled:opacity-50">
              {isGuestSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
            <input
              type="text"
              placeholder="رقم الهاتف (مثل: 077...)"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-right"
              dir="ltr"
            />
          </form>
        </div>
      </div>
    );
  }

  const menuItems = [
    { emoji: "📦", label: "طلباتي", desc: "متابعة حالة الطلبات", href: "/orders", gradient: "from-blue-400 to-blue-600" },
    { emoji: "🎓", label: "دوراتي", desc: "الدورات المشترك بها", href: "/profile/courses", gradient: "from-[#F5C842] to-[#FF6B35]" },
    { emoji: "💕", label: "المفضلة", desc: "الكيكات المحفوظة", href: "/favorites", gradient: "from-[#FF3366] to-[#E040FB]" },
    { emoji: "🔔", label: "الإشعارات", desc: "إدارة التنبيهات", href: "/notifications", gradient: "from-[#E040FB] to-purple-600" },
  ];

  const supportItems = [
    { emoji: "💌", label: "المساعدة والدعم", href: "/support" },
    { emoji: "🔒", label: "شروط الاستخدام والخصوصية", href: "/privacy" },
    { emoji: "⚙️", label: "الإعدادات", href: "/settings" },
  ];

  const initial = (user.displayName || "م")[0];

  return (
    <div className="flex flex-col min-h-screen pb-32 animate-slide-up">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden pb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FF3366] via-[#E040FB] to-[#F5C842] animate-gradient" />
        <div className="absolute top-8 left-4 text-2xl animate-float opacity-60">💕</div>
        <div className="absolute top-16 right-6 text-xl animate-float-delay-1 opacity-50">✨</div>
        <div className="absolute bottom-10 left-8 text-lg animate-float-delay-2 opacity-50">🌸</div>

        <div className="relative px-5 pt-14 pb-0 flex items-center justify-between">
          <h1 className="text-xl font-black text-white drop-shadow">حسابي 💎</h1>
        </div>

        <div className="relative px-5 mt-5">
          <div className="glass rounded-[28px] p-5 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.15)] relative">
            <div className="flex items-center gap-4">
              <div className="relative">
                {user.photoURL ? (
                  <div className="relative w-20 h-20 rounded-[22px] overflow-hidden shadow-lg glow-brand flex-shrink-0">
                    <Image src={user.photoURL} alt="Profile" fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#FF3366] to-[#E040FB] flex items-center justify-center text-white text-3xl font-black shadow-lg glow-brand flex-shrink-0">
                    {initial}
                  </div>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-lg border border-gray-100 dark:border-zinc-700 text-pink-500 hover:scale-110 transition disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-black text-lg text-gray-800 dark:text-white">{user.displayName || (isAdmin ? "مدير" : "مستخدم")}</h2>
                  {isAdmin && (
                    <span className={`text-white text-[9px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-0.5 shadow-md ${
                      userData?.gender === "male"
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                        : "bg-gradient-to-r from-[#F5C842] to-[#FF6B35]"
                    }`}>
                      <Crown className="w-3 h-3" />
                      {userData?.gender === "male" ? "مدير 👑" : (userData?.gender === "female" ? "مديرة 👑" : "إدارة 👑")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{user.email}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {userData && userData.rank && (
                    <span className={`text-xs font-black ${userData.rankColor} bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg shadow-sm`}>
                      المرتبة: {userData.rank}
                    </span>
                  )}
                  {userData && userData.points !== undefined && (
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg shadow-sm">
                      ✨ {userData.points} نقطة
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="px-5 mt-4">
          <button
            onClick={() => router.push('/admin')}
            className="w-full bg-gradient-to-l from-[#0D0A1A] to-[#1a0d2e] text-white py-4 rounded-[22px] font-black flex items-center justify-center gap-2.5 active:scale-[0.98] transition shadow-xl"
          >
            <Shield className="w-5 h-5" /> 🔐 مركز القيادة المركزي
          </button>
        </div>
      )}

      <div className="px-5 mt-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: statsLoading ? "..." : profileStats.orders.toString(), label: "طلب", emoji: "📦" },
            { num: statsLoading ? "..." : profileStats.courses.toString(), label: "دورة", emoji: "🎓" },
            { num: statsLoading ? "..." : profileStats.favorites.toString(), label: "مفضلة", emoji: "💕" },
          ].map((stat, i) => (
            <div key={i} className="glass-card rounded-[18px] py-3.5 px-2 text-center shadow-sm">
              <div className="text-xl mb-1">{stat.emoji}</div>
              <div className="font-black text-lg text-gray-800 dark:text-white">{stat.num}</div>
              <div className="text-[10px] text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6">
        <p className="text-xs text-gray-400 font-black mb-3 mr-1">⚡ القائمة الرئيسية</p>
        <div className="flex flex-col gap-3">
          {menuItems.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className="glass-card rounded-[20px] p-4 flex items-center gap-4 active:scale-[0.98] transition-all duration-300 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-[16px] bg-gradient-to-br ${item.gradient} flex items-center justify-center text-2xl shadow-md flex-shrink-0`}>
                {item.emoji}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-sm text-gray-800 dark:text-white">{item.label}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              <ChevronLeft className="w-5 h-5 text-gray-300" />
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6">
        <p className="text-xs text-gray-400 font-black mb-3 mr-1">🔧 الدعم والإعدادات</p>
        <div className="glass-card rounded-[20px] overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800 shadow-sm">
          {supportItems.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className="flex items-center gap-3.5 p-4 active:bg-gray-50 dark:active:bg-zinc-800 transition"
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="font-black text-sm flex-1 text-gray-700 dark:text-gray-300">{item.label}</span>
              <ChevronLeft className="w-4 h-4 text-gray-300" />
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={authLogout}
          className="w-full glass-card border border-red-200 dark:border-red-900/30 text-red-500 py-4 rounded-[20px] font-black flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-sm"
        >
          <LogOut className="w-5 h-5" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
