"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Store, BarChart3, Plus, RefreshCw, Smartphone, Package, Home, DollarSign, Boxes, Image as ImageIcon
} from "lucide-react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminQuickEntry from "./AdminQuickEntry";

import { calculateFinancesStats, getCachedFinancesStats, persistFinancesStats, FinancesStats } from "@/lib/financesSync";

export default function AdminDashboard() {
  const [data, setData] = useState<FinancesStats>(() => {
    return getCachedFinancesStats();
  });
  const [loading, setLoading] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersSnap, extSnap, expSnap, storeSnap] = await Promise.all([
        getDocs(collection(db, "orders")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "external_orders")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "expenses")).catch(() => ({ docs: [] })),
        getDocs(collection(db, "store_sales")).catch(() => ({ docs: [] })),
      ]);

      const orders = ordersSnap.docs.map((d: any) => d.data());
      const externalOrders = extSnap.docs.map((d: any) => d.data());
      const expenses = expSnap.docs.map((d: any) => d.data());
      const storeSales = storeSnap.docs.map((d: any) => d.data());

      const result = calculateFinancesStats(orders, externalOrders, storeSales, expenses);
      setData(result);
      persistFinancesStats(result);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  return (
    <>
      {showEntry && (
        <AdminQuickEntry
          onClose={() => setShowEntry(false)}
          onSuccess={() => { setShowEntry(false); setRefreshKey(k => k + 1); }}
        />
      )}

      <section className="mx-4 my-4 rounded-3xl overflow-hidden border border-white/30 dark:border-zinc-700/50 shadow-xl shadow-black/5 bg-white dark:bg-zinc-900">
        {/* Header Strip */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">الإدارة السريعة</h2>
              <p className="text-pink-100 text-[10px] font-bold">لوحة تحكم المديرة</p>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition"
          >
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="p-4">
          {/* New Top Section: Home Finance & Quick Entry */}
          <div className="flex flex-col gap-3 mb-4">
            <Link 
              href="/admin/home-finance" 
              className="w-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-2xl p-4 flex items-center justify-between transition shadow-md shadow-red-500/20 border border-red-400"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div className="text-right">
                  <h3 className="font-black text-sm text-white">إدارة منزل حيدر وإيمان</h3>
                  <p className="text-[10px] text-red-100 font-bold mt-0.5">مصاريف، فواتير، وواجبات العائلة</p>
                </div>
              </div>
            </Link>

            <button
              onClick={() => setShowEntry(true)}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-black transition shadow-md shadow-pink-500/20"
            >
              <Plus className="w-4 h-4" /> الإدخال
            </button>
          </div>

          {/* Top Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-zinc-700 flex flex-col justify-center">
              <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold mb-1">المبيعات الشهرية</p>
              <p className="text-blue-600 dark:text-blue-400 font-black text-sm">{loading ? "..." : (data?.monthSales ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-3 text-center flex flex-col justify-center border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold mb-1">مبيعات الأسبوع</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                {loading ? "..." : (data?.weekSales ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-3 text-center border border-gray-100 dark:border-zinc-700 flex flex-col justify-center">
              <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold mb-1">مبيعات اليوم</p>
              <p className="text-pink-600 dark:text-pink-400 font-black text-sm">{loading ? "..." : (data?.todaySales ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Action Buttons & Modules */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <Link href="/admin/hub?tab=external" className="bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 text-center transition shadow-sm border border-emerald-100 dark:border-emerald-800/30 aspect-square">
                <Smartphone className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-black leading-tight">السوشيال</span>
              </Link>

              <Link href="/admin/hub?tab=orders" className="bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 text-center transition shadow-sm border border-amber-100 dark:border-amber-800/30 aspect-square">
                <Package className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-black leading-tight">التطبيق</span>
              </Link>

              <Link href="/admin/hub?tab=inventory" className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 text-center transition shadow-sm border border-blue-100 dark:border-blue-800/30 aspect-square">
                <Boxes className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-black leading-tight">المخزن</span>
              </Link>

              <Link href="/admin/custom-orders/grid-maker" className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-2xl p-2 flex flex-col items-center justify-center gap-1 text-center transition shadow-sm border border-purple-100 dark:border-purple-800/30 aspect-square">
                <ImageIcon className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-black leading-tight">تعديل الصور</span>
              </Link>
            </div>

            {/* Financial Stats Component */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <h3 className="text-xs font-black text-gray-800 dark:text-white mb-3">المالية والمصروفات</h3>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-3 border border-purple-100 dark:border-purple-800/20">
                  <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mb-0.5 flex items-center gap-1"><DollarSign className="w-3 h-3"/> الإيرادات</p>
                  <p className="text-sm font-black text-purple-700 dark:text-purple-300">{loading ? "..." : (data?.totalRevenue ?? 0).toLocaleString()} <span className="text-[8px]">د.ع</span></p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-3 border border-red-100 dark:border-red-800/20">
                  <p className="text-[9px] font-bold text-red-600 dark:text-red-400 mb-0.5 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> أموال الكيك</p>
                  <p className="text-sm font-black text-red-700 dark:text-red-300">{loading ? "..." : (data?.totalExpenses ?? 0).toLocaleString()} <span className="text-[8px]">د.ع</span></p>
                </div>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-3 mb-2 border border-emerald-100 dark:border-emerald-800/20 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> صافي الربح التقديري (بعد المصاريف)</p>
                  <p className="text-base font-black text-emerald-700 dark:text-emerald-300">{loading ? "..." : (data?.netProfit ?? 0).toLocaleString()} <span className="text-[8px]">د.ع</span></p>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-3 mb-3 border border-orange-100 dark:border-orange-800/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <div>
                    <p className="text-[9px] font-bold text-orange-600 dark:text-orange-400 mb-0.5">دين مستحق (الراتب)</p>
                    <p className="text-sm font-black text-orange-700 dark:text-orange-300">{loading ? "..." : (data?.totalSalaryDebt ?? 0).toLocaleString()} <span className="text-[8px]">د.ع</span></p>
                  </div>
                </div>
                <Link href="/admin/finances" className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] px-2.5 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap">
                  تسديد
                </Link>
              </div>

              <div className="grid grid-cols-4 gap-1">
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                   <p className="text-[8px] text-gray-500 dark:text-gray-400 mb-0.5">سوشيال</p>
                   <p className="text-[10px] font-black text-gray-800 dark:text-gray-200">{loading ? "..." : (data?.breakdown?.social ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                   <p className="text-[8px] text-gray-500 dark:text-gray-400 mb-0.5">مواد كيك</p>
                   <p className="text-[10px] font-black text-gray-800 dark:text-gray-200">{loading ? "..." : (data?.breakdown?.storeSupplies ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                   <p className="text-[8px] text-gray-500 dark:text-gray-400 mb-0.5">أكاديمية</p>
                   <p className="text-[10px] font-black text-gray-800 dark:text-gray-200">{loading ? "..." : (data?.breakdown?.appAcademy ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl p-2 text-center">
                   <p className="text-[8px] text-gray-500 dark:text-gray-400 mb-0.5">تطبيق</p>
                   <p className="text-[10px] font-black text-gray-800 dark:text-gray-200">{loading ? "..." : (data?.breakdown?.appCakes ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <Link href="/admin" className="mt-4 w-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-2xl py-3 flex items-center justify-center gap-2 font-black text-sm transition shadow-sm">
            <Home className="w-4 h-4" /> مقر القيادة المركزية
          </Link>
        </div>
      </section>
    </>
  );
}
