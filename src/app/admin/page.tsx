"use client";
import Link from "next/link";
import {
  Package, BookOpen, ShoppingBag, Users, BarChart3, DollarSign, Smartphone,
  Receipt, Store, Settings, Crown, Image as ImageIcon, Tag, Sparkles, TrendingUp,
  Star, Home, Megaphone, Box, GraduationCap, Cake, ShoppingCart, Layers,
  PlusCircle, Wallet, ClipboardList, Award, ArrowUpRight, ShieldCheck, Activity,
  AlertTriangle, CheckCircle2, ChevronRight, ChevronLeft, Clock, Zap, Target, Flame, Compass, RefreshCw
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { subscribeSocialOrders, useSocialOrders, toMillis } from "@/lib/socialOrders";
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
        const raw = localStorage.getItem("admin_dashboard_counts_v3");
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
      pendingSupplies: 0,
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
      let pSupplies = 0;
      currentOrders.forEach((o) => {
        const isActive = ["pending", "processing", "delivering"].includes(o.status);
        if (isActive) {
          const hasSupplies = o.items && Array.isArray(o.items) && o.items.some((i: any) =>
            i.type === "supply" || i.isSupply || i.category === "supplies" || i.id?.includes("supply")
          );
          if (hasSupplies) {
            pSupplies++;
          } else {
            pApp++;
          }
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
        pendingSupplies: pSupplies,
        todayDeliveries: todayDlv,
        totalExpensesCount: currentExpenses.length,
      };
      setActiveOperationalCounts(counts);

      persistFinancesStats(result);
      try {
        localStorage.setItem(
          "admin_dashboard_counts_v3",
          JSON.stringify({ _timestamp: Date.now(), data: counts })
        );
      } catch {}
    };

    let debounceTimer: NodeJS.Timeout | null = null;
    const scheduleCalculateStats = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        calculateStats();
      }, 80);
    };

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200));
    const qExp = query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(150));
    const qStore = query(collection(db, "store_sales"), orderBy("createdAt", "desc"), limit(100));

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      currentOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      scheduleCalculateStats();
    });
    // طلبات السوشيال من المخزن المشترك (نفس المستمع المستخدم في صفحة الطلبات والمركز)
    const unsubExt = subscribeSocialOrders((st) => {
      if (st.loading) return;
      currentExtOrders = st.orders;
      scheduleCalculateStats();
      // منطق التنبيهات يعمل فقط على بيانات مؤكدة من الخادم حتى لا تتكرر الإشعارات من نسخة قديمة
      if (st.fromCache) return;

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

        scheduleCalculateStats();
      });
      const unsubExp = onSnapshot(qExp, (snap) => {
        currentExpenses = snap.docs.map((d) => d.data());
        scheduleCalculateStats();
      });
      const unsubStore = onSnapshot(qStore, (snap) => {
        currentStoreSales = snap.docs.map((d) => d.data());
        scheduleCalculateStats();
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

  // طلبات السوشيال من المخزن المشترك (نفس مستمع صفحة الطلبات) لبطاقة «اليوم»
  const { orders: socialOrders } = useSocialOrders();
  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 86400000;
    const finished = (o: any) => ["delivered", "completed", "cancelled", "rejected"].includes(o.status);
    const deliveries = socialOrders
      .filter((o) => !finished(o))
      .map((o) => ({ o, t: toMillis(o.deliveryDate) }))
      .filter(({ t }) => t >= start.getTime() && t < end)
      .sort((a, b) => a.t - b.t)
      .map(({ o, t }) => ({ id: o.id, name: o.customerName || "زبون", cake: o.cakeName || "", time: t, price: Number(o.price) || 0 }));
    const overdue = socialOrders.filter((o) => !finished(o) && toMillis(o.deliveryDate) > 0 && toMillis(o.deliveryDate) < start.getTime()).length;
    let oweUs = 0;
    for (const o of socialOrders) {
      if (o.status === "delivered" && o.paidAmount !== undefined && !o.isDebtSettled && Number(o.paidAmount) < Number(o.price)) {
        oweUs += Number(o.price) - Number(o.paidAmount);
      }
    }
    return { deliveries, overdue, oweUs };
  }, [socialOrders]);

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

  const money = (n: number | undefined | null) => (statsLoading ? "…" : `${fmt(n)} د.ع`);
  const todayLabel = new Date().toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user?.displayName?.split(" ")[0] || "";

  const kpis = [
    { label: "مبيعات اليوم", value: money(realStats?.todaySales), icon: Activity, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "هذا الأسبوع", value: money(realStats?.weekSales), icon: TrendingUp, tone: "text-sky-600 dark:text-sky-400" },
    { label: "هذا الشهر", value: money(realStats?.monthSales), icon: BarChart3, tone: "text-violet-600 dark:text-violet-400" },
    {
      label: "صافي الربح",
      value: money(realStats?.netProfit),
      icon: Wallet,
      tone: (Number(realStats?.netProfit) || 0) < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
      note: profitMargin > 0 ? `هامش ${profitMargin}%` : undefined,
    },
  ];

  type Tile = { title: string; subtitle: string; href: string; icon: any; color: string; badge?: string | null; amount?: string | null };
  const sections: { title: string; hint: string; tiles: Tile[] }[] = [
    {
      title: "المبيعات",
      hint: "الطلبات الواردة من كل القنوات",
      tiles: [
        {
          title: "طلبات السوشيال", subtitle: "واتساب، انستغرام، فيسبوك", href: "/admin/hub?tab=external", icon: Smartphone,
          color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
          badge: activeOperationalCounts.pendingExternal > 0 ? `${activeOperationalCounts.pendingExternal} قيد التنفيذ` : null,
          amount: money(realStats?.breakdown?.social),
        },
        {
          title: "طلبات التطبيق", subtitle: "طلبات زبائن المتجر الإلكتروني", href: "/admin/hub?tab=orders", icon: ShoppingCart,
          color: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
          badge: activeOperationalCounts.pendingApp > 0 ? `${activeOperationalCounts.pendingApp} نشط` : null,
          amount: money(realStats?.breakdown?.appCakes),
        },
        {
          title: "مواد الكيك أونلاين", subtitle: "طلبات المستلزمات من التطبيق", href: "/admin/hub?tab=supplies_orders", icon: ShoppingBag,
          color: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
          badge: activeOperationalCounts.pendingSupplies > 0 ? `${activeOperationalCounts.pendingSupplies} نشط` : null,
          amount: money(realStats?.breakdown?.appSupplies || 0),
        },
        {
          title: "مبيعات المحل", subtitle: "بيع مباشر للمستلزمات", href: "/admin/store-sales", icon: Store,
          color: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
          amount: money(realStats?.breakdown?.storeSupplies),
        },
      ],
    },
    {
      title: "البيت والمالية",
      hint: "الميزانية، الأرباح، الديون والمصاريف",
      tiles: [
        { title: "إدارة المنزل", subtitle: "الميزانية، العائلة، الاحتياجات", href: "/admin/home-finance", icon: Home, color: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300" },
        {
          title: "الجرد المالي", subtitle: "الإيرادات والأرباح", href: "/admin/finances", icon: DollarSign,
          color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
          amount: money(realStats?.totalRevenue),
        },
        {
          title: "المطابقة والديون", subtitle: "صندوق الكيك وديون الراتب", href: "/admin/hub?tab=audit", icon: ShieldCheck,
          color: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300",
          badge: debtRatio > 0 ? `${debtRatio}% دين` : null,
          amount: money(realStats?.totalSalaryDebt),
        },
        {
          title: "المصاريف", subtitle: "مصاريف الكيك والتشغيل", href: "/admin/expenses", icon: Receipt,
          color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
          amount: money(realStats?.totalExpenses),
        },
      ],
    },
    {
      title: "الإنتاج والمخزون",
      hint: "المواد، المنتجات والتصاميم",
      tiles: [
        {
          title: "المخزن", subtitle: "جرد المواد ودورات الشراء", href: "/admin/hub?tab=inventory", icon: Box,
          color: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300",
          amount: money(realStats?.cakeMaterialsExpense),
        },
        { title: "منتجات الكيك", subtitle: "القائمة والأسعار", href: "/admin/products", icon: Cake, color: "bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300" },
        { title: "مستلزمات المتجر", subtitle: "مواد تُباع للزبائن", href: "/admin/supplies", icon: Package, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300" },
        { title: "تصاميم خاصة", subtitle: "طلبات مخصصة بالصور", href: "/admin/custom-orders", icon: Sparkles, color: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/50 dark:text-fuchsia-300" },
        { title: "التصنيفات", subtitle: "أقسام المعرض", href: "/admin/categories", icon: Layers, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
      ],
    },
    {
      title: "التسويق",
      hint: "واجهة المتجر والعروض",
      tiles: [
        { title: "البنرات", subtitle: "حملات الصفحة الرئيسية", href: "/admin/banners", icon: ImageIcon, color: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300" },
        { title: "الإعلانات", subtitle: "إعلانات ترويجية", href: "/admin/ads", icon: Megaphone, color: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300" },
        { title: "العروض", subtitle: "أكواد وخصومات", href: "/admin/offers", icon: Tag, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300" },
        { title: "المسابقات", subtitle: "تفاعل الزبائن والجوائز", href: "/admin/competitions", icon: Award, color: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" },
      ],
    },
    {
      title: "العملاء والأكاديمية",
      hint: "الزبائن، الحسابات والدورات",
      tiles: [
        { title: "الزبائن", subtitle: "سجل العملاء والنقاط", href: "/admin/customers", icon: Users, color: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300" },
        {
          title: "الأكاديمية", subtitle: "دورات صناعة الكيك", href: "/admin/courses", icon: GraduationCap,
          color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
          amount: (realStats?.breakdown?.appAcademy || 0) > 0 ? money(realStats?.breakdown?.appAcademy) : null,
        },
        { title: "أرشيف الطلبات", subtitle: "كل طلبات التطبيق", href: "/admin/orders", icon: ClipboardList, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
        { title: "المستخدمون", subtitle: "الحسابات والصلاحيات", href: "/admin/users", icon: Settings, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
      ],
    },
  ];

  const timeOf = (ms: number) => new Date(ms).toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0912] text-slate-800 dark:text-slate-100 pb-32">
      {/* ── الترويسة ── */}
      <header className="bg-white dark:bg-[#120f1c] border-b border-slate-200/80 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
              <img src="/cp-logo.png" alt="كيك الأميرة" className="w-9 h-9 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">لوحة الإدارة</h1>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                {firstName ? `أهلاً ${firstName} · ` : ""}{todayLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/home-finance"
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95"
            >
              <Home className="w-4 h-4" /> البيت
            </Link>
            <button
              type="button"
              onClick={() => setShowQuickEntry(true)}
              className="px-4 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" /> إدخال سريع
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* ── المؤشرات ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-3xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.tone}`} />
              </div>
              <p className={`mt-2 text-lg sm:text-xl font-black tracking-tight ${k.tone}`} dir="rtl">{k.value}</p>
              {k.note && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{k.note}</p>}
            </div>
          ))}
        </section>

        {/* ── اليوم ── */}
        <section className="bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-pink-600" /> اليوم
            </h2>
            <Link href="/admin/hub?tab=external" className="text-[11px] font-black text-pink-600 dark:text-pink-400 flex items-center gap-0.5">
              كل الطلبات <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">تسليمات اليوم</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{today.deliveries.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">قيد التنفيذ</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{activeOperationalCounts.pendingExternal}</p>
            </div>
            <div className={`rounded-2xl p-3 text-center ${today.oweUs > 0 ? "bg-rose-50 dark:bg-rose-950/40" : "bg-slate-50 dark:bg-white/5"}`}>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">ديون نطلبها</p>
              <p className={`text-base sm:text-lg font-black ${today.oweUs > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                {fmt(today.oweUs)}
              </p>
            </div>
          </div>

          {today.overdue > 0 && (
            <Link
              href="/admin/hub?tab=external"
              className="mb-3 flex items-center gap-2 rounded-2xl border border-orange-200 dark:border-orange-900/60 bg-orange-50 dark:bg-orange-950/30 px-3 py-2.5 text-xs font-black text-orange-700 dark:text-orange-300"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {today.overdue === 1 ? "طلب واحد" : `${today.overdue} طلبات`} تجاوز موعد تسليمه ولم يُحدَّث
            </Link>
          )}

          {today.deliveries.length === 0 ? (
            <p className="text-xs font-bold text-slate-400 py-2 text-center">لا توجد تسليمات مجدولة اليوم</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {today.deliveries.slice(0, 5).map((d) => (
                <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{d.name}</p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{d.cake}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs font-black text-pink-600 dark:text-pink-400">{timeOf(d.time)}</p>
                    <p className="text-[11px] font-bold text-slate-500">{fmt(d.price)} د.ع</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── الأقسام ── */}
        {sections.map((sec) => (
          <section key={sec.title}>
            <div className="flex items-baseline justify-between mb-2.5 px-1">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">{sec.title}</h2>
              <span className="text-[11px] font-bold text-slate-400">{sec.hint}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sec.tiles.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="group bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-500/50 rounded-3xl p-4 flex flex-col gap-3 transition active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${t.color}`}>
                      <t.icon className="w-5 h-5" />
                    </span>
                    {t.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{t.title}</h3>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{t.subtitle}</p>
                  </div>
                  {t.amount && (
                    <p className="mt-auto text-xs font-black text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-white/5 rounded-xl px-2.5 py-1.5">
                      {t.amount}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>

      {showQuickEntry && (
        <AdminQuickEntry onClose={() => setShowQuickEntry(false)} onSuccess={() => setShowQuickEntry(false)} />
      )}
    </div>
  );
}
