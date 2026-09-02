"use client";
import Link from "next/link";
import {
  Package, BookOpen, ShoppingBag, Users, BarChart3, DollarSign, Smartphone,
  Receipt, Store, Settings, Crown, Image as ImageIcon, Tag, Sparkles, TrendingUp,
  Star, Home, Megaphone, Box, GraduationCap, Cake, ShoppingCart, Layers,
  PlusCircle, Wallet, ClipboardList, Award
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminQuickEntry from "@/components/AdminQuickEntry";

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const [statsLoading, setStatsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('admin_dashboard_stats');
    }
    return true;
  });
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [realStats, setRealStats] = useState(() => {
    // Load from cache for instant display
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('admin_dashboard_stats');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {
      todaySales: 0, weekSales: 0, monthSales: 0,
      totalRevenue: 0, netProfit: 0, totalExpenses: 0, cashInHand: 0,
      totalSalaryDebt: 0, cakeMaterialsExpense: 0,
      breakdown: { social: 0, appCakes: 0, appAcademy: 0, storeSupplies: 0 },
    };
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersSnap, extSnap, expSnap, storeSnap] = await Promise.all([
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "external_orders")),
          getDocs(collection(db, "expenses")),
          getDocs(collection(db, "store_sales")),
        ]);

        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        const externalOrders = extSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        const expenses = expSnap.docs.map(d => d.data());
        const storeSales = storeSnap.docs.map(d => d.data());

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        let todaySales = 0, weekSales = 0, monthSales = 0, totalRevenue = 0, totalProfit = 0;
        let social = 0, appCakes = 0, appAcademy = 0, storeSupplies = 0;

        const processOrder = (o: any, isExternal: boolean) => {
          if (["rejected", "cancelled"].includes(o.status)) return;
          const baseAmt = Number(isExternal ? o.price : (o.toPayNow || o.total)) || 0;
          const amt = o.paidAmount !== undefined ? Number(o.paidAmount) : baseAmt;
          const profit = Number(isExternal ? o.profit : (baseAmt * 0.3)) || 0;
          const isDelivered = o.status === 'delivered' || o.status === 'completed';
          if (isDelivered) {
            totalRevenue += amt;
            totalProfit += profit;
            
            if (isExternal) {
              social += amt;
            } else {
              if (o.type === 'course') appAcademy += amt;
              else appCakes += amt;
            }

            const d = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
            d.setHours(0, 0, 0, 0);
            if (d.getTime() === today.getTime()) todaySales += amt;
            if (d >= weekAgo) weekSales += amt;
            if (d >= monthAgo) monthSales += amt;
          }
        };

        orders.forEach(o => processOrder(o, false));
        externalOrders.forEach(o => {
          processOrder(o, true);
          if (o.deliveryDate) {
            const deliveryDateObj = new Date(o.deliveryDate);
            const now = new Date();
            const diffHours = (deliveryDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);
            let title = "", message = "", updateObj: any = null;
            if (diffHours <= 1 && diffHours >= 0 && !o.notified1h) {
              title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
              message = `الوقت يقترب! يجب تسليم كيكة (${o.cakeName || 'بدون اسم'}) بعد ساعة.`;
              updateObj = { notified1h: true };
            } else if (diffHours <= 10 && diffHours > 1 && !o.notified10h) {
              title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
              message = `يجب إكمال كيكة (${o.cakeName || 'بدون اسم'}) الآن!`;
              updateObj = { notified10h: true };
            } else if (diffHours <= 24 && diffHours > 10 && !o.notified24h) {
              title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
              message = `تذكير: يجب تحضير كيكة (${o.cakeName || 'بدون اسم'}) بسرعة.`;
              updateObj = { notified24h: true };
            }
            if (updateObj) {
              addDoc(collection(db, "notifications"), { userId: "admin", title, message, type: "order", imageUrl: o.imageUrl || "", read: false, link: "/admin/hub?tab=external", createdAt: serverTimestamp() });
              updateDoc(doc(db, "external_orders", o.id), updateObj).catch(console.error);
            }
          }
        });

        storeSales.forEach(o => {
          if (["rejected", "cancelled"].includes(o.status)) return;
          const amt = Number(o.price) || 0;
          const profit = Number(o.profit) || 0;
          totalRevenue += amt;
          totalProfit += profit;
          storeSupplies += amt;
          
          const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || o.date || 0);
          d.setHours(0, 0, 0, 0);
          if (d.getTime() === today.getTime()) todaySales += amt;
          if (d >= weekAgo) weekSales += amt;
          if (d >= monthAgo) monthSales += amt;
        });

        const totalExpenses = expenses.filter((e: any) => !e.isDebt).reduce((sum, e: any) => sum + (Number(e.amount) || 0), 0);
        const totalSalaryDebt = expenses.filter((e: any) => e.isDebt).reduce((s, e: any) => s + (Number(e.amount) || 0), 0);
        const cakeMaterialsExpense = expenses.filter((e: any) => {
          const cat = e.category || "";
          const desc = e.description || e.title || "";
          return cat === "مشتريات مخزنية" || cat === "مواد الكيك" || cat === "مواد كيك" || cat === "المواد الأولية (كيك وكريمة)" || 
                 desc.includes("المخزن") || desc.includes("مادة") || desc.includes("مواد");
        }).reduce((s, e: any) => s + (Number(e.amount) || 0), 0);
        const netProfit = totalProfit - totalExpenses - totalSalaryDebt; // Fixed: Use totalProfit instead of totalRevenue
        const cashInHand = totalRevenue - totalExpenses; // New: Cash in hand is revenue minus expenses

        const result = { 
          todaySales, weekSales, monthSales, 
          totalRevenue, netProfit, totalExpenses, cashInHand,
          totalSalaryDebt, cakeMaterialsExpense,
          breakdown: { social, appCakes, appAcademy, storeSupplies } 
        };
        setRealStats(result);
        // Cache for instant next load
        try { localStorage.setItem('admin_dashboard_stats', JSON.stringify(result)); } catch {}
      } catch (e) {
        console.error("Stats fetch error:", e);
      }
      setStatsLoading(false);
    };
    fetchStats();
  }, []);

  if (!isAdmin) {
    return <div className="p-8 text-center text-red-500 font-bold">غير مصرح لك بالدخول</div>;
  }

  const top4Icons = [
    { title: "سوشيال", icon: "📱", href: "/admin/hub?tab=external", bg: "bg-emerald-500", shadow: "shadow-emerald-500/30", badge: null },
    { title: "تطبيق", icon: "🛒", href: "/admin/hub?tab=orders", bg: "bg-pink-500", shadow: "shadow-pink-500/30", badge: null },
    { title: "المخزن", icon: "📦", href: "/admin/hub?tab=inventory", bg: "bg-blue-500", shadow: "shadow-blue-500/30", badge: null },
    { title: "مواد الكيك", icon: "🧂", href: "/admin/hub?tab=supplies_orders", bg: "bg-orange-500", shadow: "shadow-orange-500/30", badge: null },
  ];

  const mainIcons = [
    { title: "المستخدمين والزبائن", icon: "👥", href: "/admin/customers", bg: "bg-violet-500", shadow: "shadow-violet-500/30", badge: null },
    { title: "الجرد المالي", icon: "💰", href: "/admin/finances", bg: "bg-teal-500", shadow: "shadow-teal-500/30", badge: null },
    { title: "المطابقة والكشف", icon: "📊", href: "/admin/hub?tab=audit", bg: "bg-indigo-500", shadow: "shadow-indigo-500/30", badge: null },
    { title: "منتجات الكيك", icon: "🎂", href: "/admin/products", bg: "bg-rose-500", shadow: "shadow-rose-500/30", badge: null },
    { title: "الأكاديمية", icon: "🎓", href: "/admin/courses", bg: "bg-cyan-500", shadow: "shadow-cyan-500/30", badge: null },
    { title: "العروض", icon: "🏷️", href: "/admin/offers", bg: "bg-amber-500", shadow: "shadow-amber-500/30", badge: null },
    { title: "الإعلانات", icon: "📢", href: "/admin/ads", bg: "bg-lime-500", shadow: "shadow-lime-500/30", badge: null },
    { title: "البنرات", icon: "🖼️", href: "/admin/banners", bg: "bg-sky-500", shadow: "shadow-sky-500/30", badge: null },
    { title: "التصنيفات", icon: "🏷️", href: "/admin/categories", bg: "bg-fuchsia-500", shadow: "shadow-fuchsia-500/30", badge: null },
    { title: "المسابقات", icon: "🏆", href: "/admin/competitions", bg: "bg-yellow-500", shadow: "shadow-yellow-500/30", badge: null },
    { title: "تصميم خاص", icon: "👑", href: "/admin/custom-orders", bg: "bg-purple-500", shadow: "shadow-purple-500/30", badge: null },
    { title: "الطلبات العامة", icon: "📋", href: "/admin/orders", bg: "bg-gray-500", shadow: "shadow-gray-500/30", badge: null },
  ];

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-[#0D0A1A] pb-28 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-zinc-900 to-black pt-14 pb-10 px-5 rounded-b-[36px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-pink-600/20 blur-[100px] -translate-y-1/2 translate-x-1/3 rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-blue-600/20 blur-[70px] translate-y-1/2 -translate-x-1/4 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-0.5">مقر القيادة المركزية 👑</h1>
              <p className="text-xs text-pink-200 font-bold">أهلاً {user?.displayName?.split(" ")[0] || "مديرة كيك الأميرة"} ✨</p>
            </div>
            <button
              onClick={() => setShowQuickEntry(true)}
              className="bg-gradient-to-br from-pink-500 to-rose-600 text-white font-black px-4 py-3 rounded-2xl shadow-xl shadow-pink-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 text-sm"
            >
              <span className="text-lg leading-none">+</span> الإدخال
            </button>
          </div>

          {/* Financial Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-purple-200 mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> إجمالي المبيعات (المستلمة)</p>
              <p className="text-xl font-black text-white">{statsLoading ? "…" : fmt(realStats.totalRevenue)} <span className="text-[10px]">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-purple-200 mb-1 flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> إجمالي المصروفات</p>
              <p className="text-xl font-black text-red-300">{statsLoading ? "…" : fmt(realStats.totalExpenses)} <span className="text-[10px]">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:col-span-1 col-span-2">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> الأموال المتوفرة (الصندوق)</p>
              <p className="text-xl font-black text-emerald-300">{statsLoading ? "…" : fmt(realStats.cashInHand || 0)} <span className="text-[10px]">د.ع</span></p>
            </div>
          </div>
          
          <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 relative z-10 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> صافي الربح الحقيقي (بعد المصاريف)</p>
              <p className="text-xl font-black text-white">{statsLoading ? "…" : fmt(realStats.netProfit)} <span className="text-[10px]">د.ع</span></p>
            </div>
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          {/* Salary Debt Breakdown */}
          <div className="bg-orange-500/20 border border-orange-400/30 rounded-2xl px-4 py-3 mt-3 relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="text-[10px] text-orange-200 font-bold mb-1">دين مستحق (اموال الراتب)</p>
                <p className="text-lg font-black text-white">{statsLoading ? "…" : fmt(realStats.totalSalaryDebt)} <span className="text-[10px]">د.ع</span></p>
              </div>
            </div>
            <Link href="/admin/finances" className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-3 py-1.5 rounded-xl transition shadow-md whitespace-nowrap">
              تسديد الدين
            </Link>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 relative z-10">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition">
               <p className="text-[9px] text-purple-200 mb-1">الكل سوشيال</p>
               <p className="text-xs font-black text-white">{statsLoading ? "…" : fmt(realStats.breakdown.social)} <span className="text-[8px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition">
               <p className="text-[9px] text-purple-200 mb-1">مواد الكيك</p>
               <p className="text-xs font-black text-white">{statsLoading ? "…" : fmt(realStats.breakdown.storeSupplies)} <span className="text-[8px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition">
               <p className="text-[9px] text-purple-200 mb-1">الأكاديمية</p>
               <p className="text-xs font-black text-white">{statsLoading ? "…" : fmt(realStats.breakdown.appAcademy)} <span className="text-[8px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 text-center hover:bg-white/10 transition">
               <p className="text-[9px] text-purple-200 mb-1">طلبات التطبيق</p>
               <p className="text-xs font-black text-white">{statsLoading ? "…" : fmt(realStats.breakdown.appCakes)} <span className="text-[8px] font-normal">د.ع</span></p>
            </div>
          </div>
        </div>
      </div>

      {showQuickEntry && (
        <AdminQuickEntry onClose={() => setShowQuickEntry(false)} onSuccess={() => setShowQuickEntry(false)} />
      )}

      {/* Home Finance Distinct Block */}
      <div className="px-5 mt-6">
        <Link 
          href="/admin/home-finance" 
          className="bg-gradient-to-r from-red-500 to-rose-600 rounded-3xl p-5 flex items-center justify-between shadow-xl shadow-red-500/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-5 h-5 text-red-100" />
              <h2 className="text-lg font-black tracking-tight">إدارة المنزل والميزانية</h2>
            </div>
            <p className="text-xs text-red-100 font-bold opacity-80">قسم مستقل عن إدارة طلبات الكيك</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
            <span className="text-2xl">🏠</span>
          </div>
        </Link>
      </div>

      {/* Icons Grid */}
      <div className="px-5 mt-6">
        <div className="grid grid-cols-4 gap-2 mb-6">
          {top4Icons.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={`${item.bg} ${item.shadow} shadow-lg rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all text-white relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <span className="text-2xl">{item.icon}</span>
              <span className="text-[10px] font-black text-center leading-tight">{item.title}</span>
            </Link>
          ))}
        </div>

        <h2 className="text-sm font-black text-gray-700 dark:text-gray-300 mb-4 px-1">الوصول السريع</h2>
        <div className="grid grid-cols-3 gap-3">
          {mainIcons.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={`${item.bg} ${item.shadow} shadow-lg rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all text-white relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <span className="text-3xl">{item.icon}</span>
              <span className="text-[11px] font-black text-center leading-tight">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
