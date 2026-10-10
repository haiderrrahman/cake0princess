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

  // Tactical Core 4 Operation Hubs with distributed sales & balances
  const tacticalPillars = [
    {
      title: "طلبات السوشيال",
      subtitle: "واتساب وانستغرام",
      icon: "📱",
      href: "/admin/hub?tab=external",
      label: "المبيعات",
      amount: statsLoading ? "…" : `${fmt(realStats?.breakdown?.social)} د.ع`,
      badge: activeOperationalCounts.pendingExternal > 0 ? `${activeOperationalCounts.pendingExternal} قيد التنفيذ` : null,
      gradient: "from-emerald-500 to-teal-700",
      glow: "shadow-emerald-500/25",
      border: "border-emerald-500/40",
    },
    {
      title: "طلبات التطبيق",
      subtitle: "متجر الزبائن",
      icon: "🛒",
      href: "/admin/hub?tab=orders",
      label: "المبيعات",
      amount: statsLoading ? "…" : `${fmt(realStats?.breakdown?.appCakes)} د.ع`,
      badge: activeOperationalCounts.pendingApp > 0 ? `${activeOperationalCounts.pendingApp} طلب نشط` : null,
      gradient: "from-pink-500 to-rose-700",
      glow: "shadow-pink-500/25",
      border: "border-pink-500/40",
    },
    {
      title: "المخزن والمستودع",
      subtitle: "جرد ومتابعة المواد",
      icon: "📦",
      href: "/admin/hub?tab=inventory",
      label: "المواد الخام",
      amount: statsLoading ? "…" : `${fmt(realStats?.cakeMaterialsExpense)} د.ع`,
      badge: "مخزون ومواد",
      gradient: "from-cyan-500 to-blue-700",
      glow: "shadow-cyan-500/25",
      border: "border-cyan-500/40",
    },
    {
      title: "فواتير ومواد الكيك",
      subtitle: "المشتريات وتتبع النفاد",
      icon: "🧂",
      href: "/admin/hub?tab=supplies_orders",
      label: "المصروفات",
      amount: statsLoading ? "…" : `${fmt(realStats?.totalExpenses)} د.ع`,
      badge: activeOperationalCounts.totalExpensesCount > 0 ? `${activeOperationalCounts.totalExpensesCount} فواتير` : null,
      gradient: "from-amber-500 to-orange-700",
      glow: "shadow-amber-500/25",
      border: "border-amber-500/40",
    },
  ];

  interface CommandItem {
    title: string;
    subtitle: string;
    icon: string;
    href: string;
    bg: string;
    glow: string;
    badge?: string | null;
    amount?: string | null;
  }

  interface CommandSection {
    title: string;
    items: CommandItem[];
  }

  // Strategic Operations Matrix Categories
  const commandSections: CommandSection[] = [
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
          badge: "VIP 🏡",
          amount: null,
        },
        {
          title: "الجرد المالي السريع",
          subtitle: `إيرادات: ${fmt(realStats?.totalRevenue)} د.ع | شهري: ${fmt(realStats?.monthSales)} د.ع`,
          icon: "💰",
          href: "/admin/finances",
          bg: "from-teal-600 to-emerald-800",
          glow: "shadow-teal-600/30",
          badge: profitMargin > 0 ? `${profitMargin}% هامش` : "أرباح",
          amount: statsLoading ? "…" : `صافي الربح: ${fmt(realStats?.netProfit)} د.ع`,
        },
        {
          title: "المطابقة والكشف المالي",
          subtitle: "ديون وصندوق الكيك",
          icon: "📊",
          href: "/admin/hub?tab=audit",
          bg: "from-indigo-600 to-blue-800",
          glow: "shadow-indigo-600/30",
          badge: debtRatio > 0 ? `${debtRatio}% دين` : null,
          amount: statsLoading ? "…" : `دين مستحق: ${fmt(realStats?.totalSalaryDebt)} د.ع`,
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
          amount: (realStats?.breakdown?.appAcademy && realStats.breakdown.appAcademy > 0)
            ? `مبيعات: ${fmt(realStats.breakdown.appAcademy)} د.ع`
            : null,
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
                  className={`bg-gradient-to-br ${item.gradient} p-4 rounded-3xl shadow-md dark:shadow-xl ${item.glow} hover:-translate-y-1 active:scale-95 transition-all text-white relative overflow-hidden group flex flex-col justify-between min-h-[145px]`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full blur-xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

                  <div className="flex items-start justify-between">
                    <span className="text-2xl sm:text-3xl p-1 bg-white/10 rounded-2xl backdrop-blur-md">
                      {item.icon}
                    </span>
                    {item.badge && (
                      <span className="bg-white/20 text-white font-mono font-black text-[10px] sm:text-xs px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-md animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <h3 className="font-black text-xs sm:text-sm tracking-tight text-white mb-0.5">{item.title}</h3>
                    <p className="text-[10px] text-white/80 font-bold mb-2">{item.subtitle}</p>

                    {item.amount && (
                      <div className="bg-black/20 dark:bg-black/35 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/20 flex items-baseline justify-between gap-1 shadow-inner">
                        <span className="text-[9px] sm:text-[10px] text-white/80 font-bold">{item.label}:</span>
                        <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-white">
                          {item.amount}
                        </span>
                      </div>
                    )}
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
                      className={`bg-gradient-to-br ${item.bg} rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-md dark:shadow-lg ${item.glow} hover:-translate-y-1 active:scale-95 transition-all text-white relative overflow-hidden group min-h-[145px] border border-white/20 dark:border-white/10`}
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

                      <div className="flex items-start justify-between">
                        <span className="text-2xl sm:text-3xl">{item.icon}</span>
                        {item.badge && (
                          <span className="bg-white/20 text-white font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border border-white/30 backdrop-blur-md">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <h4 className="font-black text-xs sm:text-sm tracking-tight text-white leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-white/75 font-bold mt-0.5 mb-2 leading-tight">{item.subtitle}</p>

                        {item.amount && (
                          <div className="bg-black/20 dark:bg-black/35 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-white/20 text-[11px] sm:text-xs font-black font-mono tracking-tight text-white shadow-inner">
                            {item.amount}
                          </div>
                        )}
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
