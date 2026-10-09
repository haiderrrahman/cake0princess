"use client";
import Link from "next/link";
import {
  Package, BookOpen, ShoppingBag, Users, BarChart3, DollarSign, Smartphone,
  Receipt, Store, Settings, Crown, Image as ImageIcon, Tag, Sparkles, TrendingUp,
  Star, Home, Megaphone, Box, GraduationCap, Cake, ShoppingCart, Layers,
  PlusCircle, Wallet, ClipboardList, Award, ArrowUpRight, ShieldCheck, Activity,
  AlertTriangle, CheckCircle2, ChevronRight, Zap, Target, Flame, Compass, RefreshCw
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminQuickEntry from "@/components/AdminQuickEntry";
import { calculateFinancesStats, getCachedFinancesStats, persistFinancesStats } from "@/lib/financesSync";

function BaghdadClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("ar-IQ", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-cyan-300 font-bold" dir="ltr">{time || "..."}</span>;
}

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [statsLoading, setStatsLoading] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [activeOperationalCounts, setActiveOperationalCounts] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("admin_dashboard_counts_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?._timestamp && (Date.now() - parsed._timestamp < 15 * 60 * 1000)) {
            return parsed.data;
          }
        }
      } catch {}
    }
    return {
      pendingExternal: 0,
      pendingApp: 0,
      todayDeliveries: 0,
      totalExpensesCount: 0,
    };
  });

  const [realStats, setRealStats] = useState(() => {
    return getCachedFinancesStats();
  });

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentOrders: any[] = [];
    let currentExtOrders: any[] = [];
    let currentExpenses: any[] = [];
    let currentStoreSales: any[] = [];

    const calculateStats = () => {
      let pExt = 0;
      let todayDlv = 0;

      currentExtOrders.forEach((o) => {
        const isDelivered = o.status === "delivered" || o.status === "completed";
        if (!isDelivered && o.status !== "cancelled" && o.status !== "rejected") {
          pExt++;
        }

        // Today's delivery check: ONLY count active un-delivered orders
        const isFinished = ["delivered", "completed", "cancelled", "rejected"].includes(o.status);
        if (o.deliveryDate && !isFinished) {
          const dlDate = new Date(o.deliveryDate);
          dlDate.setHours(0, 0, 0, 0);
          if (dlDate.getTime() === today.getTime()) {
            todayDlv++;
          }
        }
      });

      let pApp = 0;
      currentOrders.forEach((o) => {
        if (["pending", "processing", "delivering"].includes(o.status)) {
          pApp++;
        }
      });

      const result = calculateFinancesStats(
        currentOrders,
        currentExtOrders,
        currentStoreSales,
        currentExpenses
      );

      setRealStats(result);
      setStatsLoading(false);
      const counts = {
        pendingExternal: pExt,
        pendingApp: pApp,
        todayDeliveries: todayDlv,
        totalExpensesCount: currentExpenses.length,
      };
      setActiveOperationalCounts(counts);

      persistFinancesStats(result);
      try {
        localStorage.setItem(
          "admin_dashboard_counts_v2",
          JSON.stringify({ _timestamp: Date.now(), data: counts })
        );
      } catch {}
    };

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const qExt = query(collection(db, "external_orders"), orderBy("createdAt", "desc"));
    const qExp = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const qStore = query(collection(db, "store_sales"), orderBy("createdAt", "desc"));

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      currentOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      calculateStats();
    });
    const unsubExt = onSnapshot(qExt, (snap) => {
      currentExtOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Notifications Logic: Only check ACTIVE, un-delivered orders
        const now = new Date();
        currentExtOrders.forEach((o) => {
          const isFinished = ["delivered", "completed", "cancelled", "rejected"].includes(o.status);
          if (!isFinished && o.deliveryDate) {
            const deliveryDateObj = new Date(o.deliveryDate);
            const diffHours = (deliveryDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);
            let title = "",
              message = "",
              updateObj: any = null;
            if (diffHours <= 1 && diffHours >= 0 && !o.notified1h) {
              title = `طلب الزبون: ${o.customerName || "مجهول"} ⚠️`;
              message = `الوقت يقترب! يجب تسليم كيكة (${o.cakeName || "بدون اسم"}) بعد ساعة.`;
              updateObj = { notified1h: true };
            } else if (diffHours <= 10 && diffHours > 1 && !o.notified10h) {
              title = `طلب الزبون: ${o.customerName || "مجهول"} ⚠️`;
              message = `يجب إكمال كيكة (${o.cakeName || "بدون اسم"}) الآن!`;
              updateObj = { notified10h: true };
            } else if (diffHours <= 24 && diffHours > 10 && !o.notified24h) {
              title = `طلب الزبون: ${o.customerName || "مجهول"} ⚠️`;
              message = `تذكير: يجب تحضير كيكة (${o.cakeName || "بدون اسم"}) بسرعة.`;
              updateObj = { notified24h: true };
            }
            if (updateObj) {
              addDoc(collection(db, "notifications"), {
                userId: "admin",
                title,
                message,
                type: "order",
                imageUrl: o.imageUrl || "",
                read: false,
                link: "/admin/hub?tab=external",
                createdAt: serverTimestamp(),
              }).catch(console.error);
              updateDoc(doc(db, "external_orders", o.id), updateObj).catch(console.error);
            }
          }
        });

        calculateStats();
      });
      const unsubExp = onSnapshot(qExp, (snap) => {
        currentExpenses = snap.docs.map((d) => d.data());
        calculateStats();
      });
      const unsubStore = onSnapshot(qStore, (snap) => {
        currentStoreSales = snap.docs.map((d) => d.data());
        calculateStats();
      });

    return () => {
      unsubOrders();
      unsubExt();
      unsubExp();
      unsubStore();
    };
  }, []);

  // Performance calculations
  const profitMargin = useMemo(() => {
    const rev = Number(realStats?.totalRevenue) || 0;
    if (rev <= 0) return 0;
    return Math.round(((Number(realStats?.netProfit) || 0) / rev) * 100);
  }, [realStats]);

  const debtRatio = useMemo(() => {
    const rev = Number(realStats?.totalRevenue) || 0;
    if (rev <= 0) return 0;
    return Math.round(((Number(realStats?.totalSalaryDebt) || 0) / rev) * 100);
  }, [realStats]);

  const fmt = (n: number | undefined | null) => Math.round(Number(n) || 0).toLocaleString("en-US");

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-rose-400 font-black">
        <div className="bg-rose-950/40 border border-rose-800/60 p-8 rounded-3xl backdrop-blur-xl">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-rose-400" />
          <h2 className="text-xl">غير مصرح لك بالدخول</h2>
          <p className="text-xs text-rose-300/80 mt-1">هذه المنطقة مخصصة لإدارة كيك الأميرة فقط</p>
        </div>
      </div>
    );
  }

  // Tactical Core 4 Operation Hubs
  const tacticalPillars = [
    {
      title: "طلبات السوشيال",
      subtitle: "واتساب وانستغرام",
      icon: "📱",
      href: "/admin/hub?tab=external",
      count: activeOperationalCounts.pendingExternal,
      countLabel: "قيد التنفيذ",
      gradient: "from-emerald-500 to-teal-700",
      glow: "shadow-emerald-500/25",
      border: "border-emerald-500/40",
    },
    {
      title: "طلبات التطبيق",
      subtitle: "متجر الزبائن",
      icon: "🛒",
      href: "/admin/hub?tab=orders",
      count: activeOperationalCounts.pendingApp,
      countLabel: "طلب نشط",
      gradient: "from-pink-500 to-rose-700",
      glow: "shadow-pink-500/25",
      border: "border-pink-500/40",
    },
    {
      title: "المخزن والمستودع",
      subtitle: "جرد ومتابعة المواد",
      icon: "📦",
      href: "/admin/hub?tab=inventory",
      count: null,
      countLabel: "مراقبة المخزون",
      gradient: "from-cyan-500 to-blue-700",
      glow: "shadow-cyan-500/25",
      border: "border-cyan-500/40",
    },
    {
      title: "فواتير ومواد الكيك",
      subtitle: "المشتريات وتتبع النفاد",
      icon: "🧂",
      href: "/admin/hub?tab=supplies_orders",
      count: null,
      countLabel: "الفواتير والمصروف",
      gradient: "from-amber-500 to-orange-700",
      glow: "shadow-amber-500/25",
      border: "border-amber-500/40",
    },
  ];

  // Strategic Operations Matrix Categories
  const commandSections = [
    {
      title: "👑 الإدارة المالية والحسابات",
      items: [
        {
          title: "إدارة المنزل والميزانية",
          subtitle: "قسم خاص ومستقل",
          icon: "🏠",
          href: "/admin/home-finance",
          bg: "from-rose-600 to-red-800",
          glow: "shadow-rose-600/30",
          badge: "VIP",
        },
        {
          title: "الجرد المالي السريع",
          subtitle: "أرباح ومصروفات",
          icon: "💰",
          href: "/admin/finances",
          bg: "from-teal-600 to-emerald-800",
          glow: "shadow-teal-600/30",
          badge: null,
        },
        {
          title: "المطابقة والكشف المالي",
          subtitle: "ديون وصندوق الكيك",
          icon: "📊",
          href: "/admin/hub?tab=audit",
          bg: "from-indigo-600 to-blue-800",
          glow: "shadow-indigo-600/30",
          badge: null,
        },
      ],
    },
    {
      title: "🎂 الإنتاج وتصاميم الكيك",
      items: [
        {
          title: "منتجات الكيك",
          subtitle: "قائمة الكيك والأسعار",
          icon: "🎂",
          href: "/admin/products",
          bg: "from-purple-600 to-pink-800",
          glow: "shadow-purple-600/30",
          badge: null,
        },
        {
          title: "تصميم خاص بالزبون",
          subtitle: "طلبات مخصصة بالصور",
          icon: "👑",
          href: "/admin/custom-orders",
          bg: "from-fuchsia-600 to-purple-800",
          glow: "shadow-fuchsia-600/30",
          badge: null,
        },
        {
          title: "تصنيفات المتجر",
          subtitle: "أقسام المعرض",
          icon: "🏷️",
          href: "/admin/categories",
          bg: "from-violet-600 to-indigo-800",
          glow: "shadow-violet-600/30",
          badge: null,
        },
      ],
    },
    {
      title: "📢 التسويق والبنرات والمبيعات",
      items: [
        {
          title: "استوديو البنرات",
          subtitle: "حملات الصفحة الرئيسية",
          icon: "🖼️",
          href: "/admin/banners",
          bg: "from-sky-500 to-blue-700",
          glow: "shadow-sky-500/30",
          badge: "جديد ⚡",
        },
        {
          title: "الإعلانات والعروض",
          subtitle: "خصومات ترويجية",
          icon: "📢",
          href: "/admin/ads",
          bg: "from-lime-600 to-emerald-800",
          glow: "shadow-lime-600/30",
          badge: null,
        },
        {
          title: "العروض الترويجية",
          subtitle: "أكواد وخصومات",
          icon: "🏷️",
          href: "/admin/offers",
          bg: "from-amber-600 to-orange-800",
          glow: "shadow-amber-600/30",
          badge: null,
        },
        {
          title: "المسابقات والجوائز",
          subtitle: "تفاعل الزبائن",
          icon: "🏆",
          href: "/admin/competitions",
          bg: "from-yellow-500 to-amber-700",
          glow: "shadow-yellow-500/30",
          badge: null,
        },
      ],
    },
    {
      title: "👥 العملاء والتدريب الاحترافي",
      items: [
        {
          title: "الزبائن والمستخدمين",
          subtitle: "سجل العملاء والنقاط",
          icon: "👥",
          href: "/admin/customers",
          bg: "from-purple-700 to-indigo-900",
          glow: "shadow-purple-700/30",
          badge: null,
        },
        {
          title: "الأكاديمية والورشات",
          subtitle: "دورات صناعة الكيك",
          icon: "🎓",
          href: "/admin/courses",
          bg: "from-cyan-600 to-teal-800",
          glow: "shadow-cyan-600/30",
          badge: null,
        },
        {
          title: "الطلبات العامة",
          subtitle: "سجل الأرشيف الشامل",
          icon: "📋",
          href: "/admin/orders",
          bg: "from-slate-600 to-gray-800",
          glow: "shadow-slate-600/30",
          badge: null,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#07050e] text-slate-800 dark:text-slate-100 pb-36 font-sans relative selection:bg-pink-500 selection:text-white transition-colors duration-300">
      {/* Background Holographic Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-100">
        <div className="absolute -top-40 right-[-10%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-pink-500/10 dark:bg-pink-600/10 rounded-full blur-[60px] sm:blur-[120px] will-change-transform" />
        <div className="absolute top-1/3 left-[-15%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[60px] sm:blur-[120px] will-change-transform" />
        <div className="absolute bottom-10 right-1/4 w-[280px] sm:w-[400px] h-[280px] sm:h-[400px] bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-[60px] sm:blur-[120px] will-change-transform" />
        <div className="absolute inset-0 bg-[radial-gradient(#0000000a_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-30" />
      </div>

      <div className="relative z-10">
        {/* ═══════════════ CYBER EXECUTIVE HEADER ═══════════════ */}
        <header className="pt-12 pb-8 px-4 sm:px-6 border-b border-pink-100/80 dark:border-white/10 bg-gradient-to-b from-white/95 via-pink-50/30 to-[#f8fafc]/90 dark:from-[#130b24]/90 dark:via-[#0d081b]/80 dark:to-transparent backdrop-blur-xl transition-colors">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Top Bar: Status, Clock & Profile */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl p-1 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-[2px] shadow-lg shadow-pink-500/20">
                    <div className="w-full h-full bg-white dark:bg-[#0d0718] rounded-[14px] flex items-center justify-center overflow-hidden border border-slate-100 dark:border-transparent">
                      <img src="/cp-logo.png" alt="كيك الأميرة" className="w-10 h-10 object-contain" />
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#0d0718] rounded-full animate-pulse" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                      مقر القيادة المركزية <span className="text-amber-500 dark:text-amber-400">👑</span>
                    </h1>
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      LIVE ● مباشر
                    </span>
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-300/80 font-bold mt-0.5">
                    مرحباً {user?.displayName?.split(" ")[0] || "مديرة كيك الأميرة"} ✨ | توقيت بغداد:{" "}
                    <BaghdadClock />
                  </p>
                </div>
              </div>

              {/* Fast Action Trigger Bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickEntry(true)}
                  className="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black px-4 py-2.5 rounded-2xl shadow-lg shadow-pink-500/20 flex items-center gap-2 text-xs sm:text-sm active:scale-95 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إدخال فوري ذكي</span>
                </button>

                <Link
                  href="/admin/home-finance"
                  prefetch={true}
                  className="bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white font-black px-3 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs transition active:scale-95 shadow-xs backdrop-blur-md"
                >
                  <span>🏠 المنزل</span>
                </Link>
              </div>
            </div>

            {/* ═══════════════ AI SENTINEL RADAR (OPERATIONAL PULSE) ═══════════════ */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white dark:from-purple-950/60 dark:via-indigo-950/40 dark:to-slate-900/60 border border-purple-200/70 dark:border-purple-500/30 rounded-3xl p-4 backdrop-blur-xl shadow-md dark:shadow-2xl relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-400/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-300 animate-spin-slow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-purple-900 dark:text-purple-200">المرصد الذكي للعمليات الحية:</span>
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 px-2 py-0.5 rounded-full font-mono font-bold">
                        Sentinel AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-bold mt-1">
                      {activeOperationalCounts.todayDeliveries > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300 font-black">
                          🚨 انتباه: لديك {activeOperationalCounts.todayDeliveries} طلبات سوشيال تستحق التسليم اليوم! اضغط لمتابعتها في المحور.
                        </span>
                      ) : activeOperationalCounts.pendingExternal > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          ⚡ العمليات نشطة: يوجد {activeOperationalCounts.pendingExternal} طلب سوشيال قيد التجهيز و {activeOperationalCounts.pendingApp} طلب تطبيق.
                        </span>
                      ) : (
                        <span className="text-cyan-700 dark:text-cyan-300">
                          ✅ كافة الطلبات مكتملة ومحدّثة. الأداء التشغيلي في أعلى درجات الاستقرار.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    href="/admin/hub?tab=external"
                    className="text-xs font-black bg-purple-100 hover:bg-purple-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 border border-purple-300 dark:border-purple-400/40 text-purple-800 dark:text-purple-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition shadow-xs"
                  >
                    <span>فتح غرفة العمليات</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                </div>
              </div>
            </div>

            {/* ═══════════════ KPI FLIGHT DECK (FINANCIAL RADAR) ═══════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Card 1: Total Revenue */}
              <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-sm dark:shadow-none backdrop-blur-md relative overflow-hidden group">
                <div className="flex items-center justify-between text-purple-700 dark:text-purple-200 mb-2">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" /> إجمالي الإيرادات
                  </span>
                  <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                    كل القنوات
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {statsLoading ? "…" : fmt(realStats.totalRevenue)}
                  <span className="text-xs text-slate-400 dark:text-purple-300/70 font-normal mr-1">د.ع</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>مبيعات اليوم:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">+{fmt(realStats.todaySales)} د.ع</span>
                </div>
              </div>

              {/* Card 2: Monthly Inflow */}
              <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-sm dark:shadow-none backdrop-blur-md relative overflow-hidden group">
                <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-200 mb-2">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> مبيعات 30 يوماً
                  </span>
                  <span className="text-[10px] bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                    شهري
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-700 dark:text-cyan-300 tracking-tight">
                  {statsLoading ? "…" : fmt(realStats.monthSales)}
                  <span className="text-xs text-slate-400 dark:text-cyan-200/70 font-normal mr-1">د.ع</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>الأسبوع الحالي:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-black">{fmt(realStats.weekSales)} د.ع</span>
                </div>
              </div>

              {/* Card 3: Cake Operating Expenses */}
              <div className="bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-sm dark:shadow-none backdrop-blur-md relative overflow-hidden group">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-200 mb-2">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-rose-600 dark:text-rose-400" /> مصروفات الكيك
                  </span>
                  <span className="text-[10px] bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold">
                    أموال الكيك
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {statsLoading ? "…" : fmt(realStats.totalExpenses)}
                  <span className="text-xs text-slate-400 dark:text-rose-300/70 font-normal mr-1">د.ع</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>منها مواد خام ومخزن:</span>
                  <span className="text-rose-600 dark:text-rose-300 font-black">{fmt(realStats.cakeMaterialsExpense)} د.ع</span>
                </div>
              </div>

              {/* Card 4: Net Profit */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/40 dark:from-emerald-950/60 dark:to-emerald-900/30 border border-emerald-200/80 dark:border-emerald-500/30 rounded-3xl p-4 shadow-sm dark:shadow-lg backdrop-blur-md relative overflow-hidden group">
                <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-200 mb-2">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> صافي الربح الحقيقي
                  </span>
                  <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-black">
                    {profitMargin}% هامش
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                  {statsLoading ? "…" : fmt(realStats.netProfit)}
                  <span className="text-xs text-slate-400 dark:text-emerald-200/70 font-normal mr-1">د.ع</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-500/20 text-[10px] text-emerald-800/80 dark:text-emerald-300/80 font-bold">
                  <span>بعد خصم المصاريف والديون:</span>
                  <span className="text-emerald-950 dark:text-white font-black">صافي كاش</span>
                </div>
              </div>
            </div>

            {/* Salary Debt Alert Cockpit Bar */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-white dark:from-orange-950/50 dark:via-amber-950/40 dark:to-slate-900/50 border border-amber-200 dark:border-orange-500/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black">
                  👤
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-amber-900 dark:text-orange-300 font-black">دين مستحق شخصي (أموال الراتب المدفوعة للكيك):</p>
                    {debtRatio > 0 && (
                      <span className="text-[10px] bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-bold">
                        يمثل {debtRatio}% من الإيراد
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {statsLoading ? "…" : fmt(realStats.totalSalaryDebt)}{" "}
                    <span className="text-xs font-normal text-amber-700 dark:text-orange-200/70">د.ع مستحق استرداده لكِ</span>
                  </p>
                </div>
              </div>
              <Link
                href="/admin/finances"
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow-md shadow-orange-500/20 whitespace-nowrap active:scale-95"
              >
                تسديد واسترداد الدين
              </Link>
            </div>

            {/* ═══════════════ REVENUE CHANNELS RADAR ═══════════════ */}
            <div className="bg-white/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl p-3.5 shadow-xs dark:shadow-none backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-300 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400" />
                  توزيع مصادر الدخل التشغيلي
                </span>
                <span className="text-[10px] text-slate-400">تحديث فوري لكل قناة</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 dark:bg-black/30 rounded-xl p-2.5 border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                    <span>📱 سوشيال</span>
                    <span className="font-mono">
                      {(Number(realStats?.totalRevenue) || 0) > 0
                        ? Math.round(((Number(realStats?.breakdown?.social) || 0) / Number(realStats?.totalRevenue)) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{fmt(realStats?.breakdown?.social)} د.ع</p>
                </div>

                <div className="bg-slate-50 dark:bg-black/30 rounded-xl p-2.5 border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-pink-600 dark:text-pink-400 font-bold mb-1">
                    <span>🛒 كيك التطبيق</span>
                    <span className="font-mono">
                      {(Number(realStats?.totalRevenue) || 0) > 0
                        ? Math.round(((Number(realStats?.breakdown?.appCakes) || 0) / Number(realStats?.totalRevenue)) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{fmt(realStats?.breakdown?.appCakes)} د.ع</p>
                </div>

                <div className="bg-slate-50 dark:bg-black/30 rounded-xl p-2.5 border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400 font-bold mb-1">
                    <span>🎓 الأكاديمية</span>
                    <span className="font-mono">
                      {(Number(realStats?.totalRevenue) || 0) > 0
                        ? Math.round(((Number(realStats?.breakdown?.appAcademy) || 0) / Number(realStats?.totalRevenue)) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{fmt(realStats?.breakdown?.appAcademy)} د.ع</p>
                </div>

                <div className="bg-slate-50 dark:bg-black/30 rounded-xl p-2.5 border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-bold mb-1">
                    <span>🧂 مستلزمات ومواد</span>
                    <span className="font-mono">
                      {(Number(realStats?.totalRevenue) || 0) > 0
                        ? Math.round(((Number(realStats?.breakdown?.storeSupplies) || 0) / Number(realStats?.totalRevenue)) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{fmt(realStats?.breakdown?.storeSupplies)} د.ع</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ═══════════════ MAIN CONTENT BODY ═══════════════ */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
          {/* TACTICAL CORE 4 PILLARS */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                محاور العمليات الميدانية الأربعة
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">غرفة العمليات المركزية</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tacticalPillars.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className={`bg-gradient-to-br ${item.gradient} p-4 rounded-3xl shadow-md dark:shadow-xl ${item.glow} hover:-translate-y-1 active:scale-95 transition-all text-white relative overflow-hidden group flex flex-col justify-between min-h-[125px]`}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/15 rounded-full blur-xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

                  <div className="flex items-start justify-between">
                    <span className="text-2xl sm:text-3xl p-1 bg-white/10 rounded-2xl backdrop-blur-md">
                      {item.icon}
                    </span>
                    {item.count !== null && item.count > 0 && (
                      <span className="bg-white/20 text-white font-mono font-black text-xs px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-md animate-pulse">
                        {item.count} {item.countLabel}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-black text-sm tracking-tight text-white mb-0.5">{item.title}</h3>
                    <p className="text-[10px] text-white/80 font-bold">{item.subtitle}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* STRATEGIC SECTIONS MATRIX */}
          <div className="space-y-6">
            {commandSections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-3">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-300 px-1 tracking-wide flex items-center gap-1.5">
                  <span>{sec.title}</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sec.items.map((item, i) => (
                    <Link
                      key={i}
                      href={item.href}
                      className={`bg-gradient-to-br ${item.bg} rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-md dark:shadow-lg ${item.glow} hover:-translate-y-1 active:scale-95 transition-all text-white relative overflow-hidden group min-h-[110px] border border-white/20 dark:border-white/10`}
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

                      <div className="flex items-start justify-between">
                        <span className="text-2xl sm:text-3xl">{item.icon}</span>
                        {item.badge && (
                          <span className="bg-white/20 text-white font-black text-[9px] px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-md">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <h4 className="font-black text-xs sm:text-sm tracking-tight text-white leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-white/75 font-bold mt-0.5">{item.subtitle}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Quick Entry Drawer */}
      {showQuickEntry && (
        <AdminQuickEntry onClose={() => setShowQuickEntry(false)} onSuccess={() => setShowQuickEntry(false)} />
      )}
    </div>
  );
}
