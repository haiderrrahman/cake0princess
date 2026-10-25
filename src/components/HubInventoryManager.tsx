"use client";
import React, { useState, useMemo } from "react";
import {
  Package, Search, Filter, Plus, Trash2, Edit, ShoppingCart, Clock,
  AlertTriangle, CheckCircle, Receipt, DollarSign, Store, Tag, Sparkles,
  ChevronDown, ChevronUp, Layers, Check, X, Bot, Camera, Image as ImageIcon,
  ArrowUpDown, List, Grid3X3, Eye
} from "lucide-react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import { CakeMaterialPurchase } from "@/lib/cakeMaterialPurchases";
import { CAKE_INVENTORY_CATEGORIES } from "@/lib/scanCakeInvoiceClient";

interface HubInventoryManagerProps {
  inventory: any[];
  setInventory: React.Dispatch<React.SetStateAction<any[]>>;
  purchases: CakeMaterialPurchase[];
  itemsWithConsumption: any[];
  cycleFilterStatus: string;
  setCycleFilterStatus: (val: any) => void;
  onOpenAddModal: () => void;
  onEditItem: (item: any) => void;
  onSinglePurchase: (item?: any) => void;
  onViewHistory: (itemName: string) => void;
  onViewTimeline: (item: any) => void;
  onScanInvoice: () => void;
  updateInventoryQuantity: (id: string, currentQty: number, change: number) => Promise<void>;
  handlePurchaseMissing: (item: any) => Promise<void>;
  handleDeleteWholeInvoice: (inv: any) => Promise<void>;
  handleDeletePurchase: (purchaseId: string) => Promise<void>;
  setEditingCakeInvoice: (inv: any) => void;
  groupedInvoices: any[];
  setViewingInvoice?: (inv: any) => void;
}

const CAT_ICONS: Record<string, string> = {
  "طحين وسكر": "🌾",
  "كريمات": "🧁",
  "حشوات": "🍫",
  "شوكولاتة وكاكاو": "🌰",
  "ألوان وإضافات": "🎨",
  "منكهات وعطور": "🧪",
  "عجينة سكر": "🎂",
  "فواكه ومكسرات": "🍓",
  "تغليف وزينة": "🎀",
  "مستهلكات": "🧻",
  "قوالب وصواني": "🥧",
  "أدوات": "🔧",
  "أخرى": "📦",
};

const CAT_COLORS: Record<string, string> = {
  "طحين وسكر": "from-amber-500 to-yellow-600",
  "كريمات": "from-pink-500 to-rose-600",
  "حشوات": "from-purple-600 to-indigo-700",
  "شوكولاتة وكاكاو": "from-amber-700 to-stone-800",
  "ألوان وإضافات": "from-blue-500 to-cyan-600",
  "منكهات وعطور": "from-teal-500 to-emerald-600",
  "عجينة سكر": "from-fuchsia-500 to-pink-600",
  "فواكه ومكسرات": "from-red-500 to-rose-700",
  "تغليف وزينة": "from-violet-500 to-purple-600",
  "مستهلكات": "from-slate-500 to-gray-700",
  "قوالب وصواني": "from-orange-500 to-amber-700",
  "أدوات": "from-cyan-600 to-blue-700",
  "أخرى": "from-gray-500 to-slate-700",
};

export default function HubInventoryManager({
  inventory,
  setInventory,
  purchases,
  itemsWithConsumption,
  cycleFilterStatus,
  setCycleFilterStatus,
  onOpenAddModal,
  onEditItem,
  onSinglePurchase,
  onViewHistory,
  onViewTimeline,
  onScanInvoice,
  updateInventoryQuantity,
  handlePurchaseMissing,
  handleDeleteWholeInvoice,
  handleDeletePurchase,
  setEditingCakeInvoice,
  groupedInvoices,
  setViewingInvoice,
}: HubInventoryManagerProps) {
  // Sub-tabs
  const [subTab, setSubTab] = useState<"stock" | "shortages" | "cycles" | "purchases">("stock");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "low" | "zero">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // View Mode: Cards Grid, Table/List, or Grouped by Category
  const [viewMode, setViewMode] = useState<"cards" | "table" | "grouped">("cards");

  // Purchases sub-tab filters & view mode
  const [purchasesSearch, setPurchasesSearch] = useState("");
  const [invoiceViewMode, setInvoiceViewMode] = useState<"cards" | "table">("cards");
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  const fmt = (n: number | string | undefined | null) => Math.round(Number(n) || 0).toLocaleString("en-US");

  // Purchases / Invoices KPIs (Home Finance Style)
  const invoiceMetrics = useMemo(() => {
    const list = groupedInvoices || [];
    const totalAmount = list.reduce((s, inv) => s + (Number(inv.totalAmount) || 0), 0);
    const totalItems = list.reduce((s, inv) => s + (inv.items?.length || 0), 0);
    const avgAmount = list.length > 0 ? Math.round(totalAmount / list.length) : 0;
    return {
      count: list.length,
      totalAmount,
      totalItems,
      avgAmount
    };
  }, [groupedInvoices]);

  // ─── Key Metrics ───
  const inventoryValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  }, [inventory]);

  const availableItems = useMemo(() => {
    return inventory.filter(i => Number(i.quantity) > 0);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter(i => Number(i.neededQuantity || 0) > 0 || Number(i.quantity) <= Number(i.minAlert || 1));
  }, [inventory]);

  const lowStockCost = useMemo(() => {
    return lowStockItems.reduce((sum, i) => sum + (Number(i.price || 0) * (Number(i.neededQuantity) || 1)), 0);
  }, [lowStockItems]);

  const totalPurchasesCost = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
  }, [purchases]);

  // ─── Filtered Inventory ───
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // 1. Text Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchStore = item.lastStoreName?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchStore) return false;
      }

      // 2. Status Filter
      const qty = Number(item.quantity) || 0;
      const minAlert = Number(item.minAlert) || 1;
      const needed = Number(item.neededQuantity) || 0;

      if (statusFilter === "available" && qty <= 0) return false;
      if (statusFilter === "low" && !(qty <= minAlert && qty > 0) && needed <= 0) return false;
      if (statusFilter === "zero" && qty > 0) return false;

      // 3. Category Filter
      if (selectedCategory && item.category !== selectedCategory) return false;

      return true;
    });
  }, [inventory, search, statusFilter, selectedCategory]);

  // Filtered total value
  const filteredTotalValue = useMemo(() => {
    return filteredInventory.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
  }, [filteredInventory]);

  // Available categories with metrics
  const availableCategoriesWithMetrics = useMemo(() => {
    return CAKE_INVENTORY_CATEGORIES.map(cat => {
      const catItems = inventory.filter(i => i.category === cat);
      const catValue = catItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
      return {
        label: cat,
        icon: CAT_ICONS[cat] || "📦",
        count: catItems.length,
        totalValue: catValue,
      };
    }).filter(c => c.count > 0);
  }, [inventory]);

  // Delete inventory item with CustomConfirm (Yes/No)
  const handleDeleteItem = async (item: any) => {
    const confirmed = await customConfirm(
      `هل تريد بالتأكيد حذف مادة "${item.name}" نهائياً من المخزن؟`
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "cake_inventory", item.id));
      setInventory(prev => prev.filter(i => i.id !== item.id));
      toast.success(`تم حذف "${item.name}" من المخزن بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error("فشل حذف المادة من المخزن");
    }
  };

  // Copy report for AI (matching Home Finance feature)
  const handleCopyAiReport = () => {
    const lines = filteredInventory.map((i, idx) => {
      const total = Number(i.price || 0) * Number(i.quantity || 0);
      return `${idx + 1}. ${i.name} | ${i.category || "أخرى"} | الكمية: ${i.quantity} ${i.unit} | السعر: ${fmt(i.price)} د.ع | الإجمالي: ${fmt(total)} د.ع | النقص: ${i.neededQuantity || 0}`;
    });
    const text = `📦 تقرير جرد المخزن (كيك الأميرة)\nإجمالي المواد: ${filteredInventory.length}\nالقيمة الكلية: ${fmt(filteredTotalValue)} د.ع\n\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ تقرير المخزن للذكاء الاصطناعي 🤖✨");
  };

  return (
    <div className="space-y-4">
      {/* ═══════════════ TOP FINANCIAL & OPERATIONAL KPIS ═══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-100 dark:border-zinc-800">
        {/* Total Value */}
        <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-blue-500" /> القيمة الكلية للمخزن
          </span>
          <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1">
            {fmt(inventoryValue)} <span className="text-[9px] text-gray-400">د.ع</span>
          </span>
        </div>

        {/* Available Stock */}
        <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> المواد المتوفرة
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {availableItems.length} <span className="text-[9px] text-gray-400">مادة ({inventory.length > 0 ? Math.round((availableItems.length / inventory.length) * 100) : 0}%)</span>
          </span>
        </div>

        {/* Shortages & Needed */}
        <div
          onClick={() => setSubTab("shortages")}
          className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-400 transition"
        >
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> النواقص والشراء
            </span>
            <span className="text-[9px] underline font-black">عرض ↗</span>
          </span>
          <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 mt-1">
            {lowStockItems.length} <span className="text-[9px] text-gray-400">مادة ({fmt(lowStockCost)} د.ع)</span>
          </span>
        </div>

        {/* Purchases Total */}
        <div
          onClick={() => setSubTab("purchases")}
          className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-400 transition"
        >
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" /> سجل الفواتير والمشتريات
            </span>
            <span className="text-[9px] underline font-black">سجل ↗</span>
          </span>
          <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {purchases.length} <span className="text-[9px] text-gray-400">حركة ({fmt(totalPurchasesCost)} د.ع)</span>
          </span>
        </div>
      </div>

      {/* ═══════════════ SUB-TAB NAVIGATION SEGMENTS ═══════════════ */}
      <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("stock")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            subTab === "stock"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>جرد المخزن ({inventory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("shortages")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            subTab === "shortages"
              ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>النواقص والتجهيز ({lowStockItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("cycles")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            subTab === "cycles"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>دورة النفاد ({itemsWithConsumption.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("purchases")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
            subTab === "purchases"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>سجل المشتريات ({purchases.length})</span>
        </button>
      </div>

      {/* ═══════════════ SUB-TAB 1: STOCK INVENTORY ═══════════════ */}
      {subTab === "stock" && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="ابحث عن مادة، قسم، أو مورد في المخزن..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 pr-10 text-xs sm:text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition shadow-xs"
              />
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={onOpenAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md shadow-blue-600/25 active:scale-95 transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مادة / قائمة</span>
              </button>

              <button
                type="button"
                onClick={onScanInvoice}
                className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 font-black text-xs px-3 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
                title="مسح فاتورة مستلزمات الكيك بالذكاء الاصطناعي"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-950" />
                <span className="hidden sm:inline">فاتورة AI</span>
                <span className="sm:hidden">AI</span>
              </button>

              <button
                type="button"
                onClick={() => onViewHistory("")}
                className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-bold text-xs px-3 py-2.5 rounded-2xl flex items-center gap-1.5 hover:bg-gray-50 active:scale-95 transition shrink-0"
                title="شوكت ومنين اشتريت؟"
              >
                <Search className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">كاشف الشراء</span>
              </button>

              {/* View Mode Toggle Buttons */}
              <div className="flex bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-2xl border border-gray-200 dark:border-zinc-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`p-2 rounded-xl transition ${
                    viewMode === "cards" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-xs" : "text-gray-500"
                  }`}
                  title="عرض بطاقات أنيقة"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-xl transition ${
                    viewMode === "table" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-xs" : "text-gray-500"
                  }`}
                  title="عرض جدول وقوائم تفصيلية"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={`p-2 rounded-xl transition ${
                    viewMode === "grouped" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-xs" : "text-gray-500"
                  }`}
                  title="تجميع حسب الأقسام"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ STATUS QUICK FILTERS ══════════ */}
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {[
              { id: "all", label: "الكل", count: inventory.length },
              { id: "available", label: "🟢 المتوفر", count: availableItems.length },
              { id: "low", label: "⚠️ قارب على النفاد", count: lowStockItems.length },
              { id: "zero", label: "🔴 نفدت تماماً", count: inventory.filter(i => Number(i.quantity) <= 0).length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm scale-102"
                    : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-75 font-mono">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* ══════════ CATEGORY PILLS (IDENTICAL TO HOME FINANCE) ══════════ */}
          <div className="flex flex-wrap gap-1.5 justify-center pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-bold transition ${
                !selectedCategory
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-105"
                  : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400"
              }`}
            >
              <span>كل الأقسام</span>
            </button>

            {(() => {
              const cats = showAllCategories
                ? availableCategoriesWithMetrics
                : availableCategoriesWithMetrics.slice(0, 5);

              return (
                <>
                  {cats.map(cat => {
                    const isActive = selectedCategory === cat.label;
                    return (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => setSelectedCategory(isActive ? null : cat.label)}
                        className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-bold transition ${
                          isActive
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-105"
                            : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                        }`}>
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}

                  {!showAllCategories && availableCategoriesWithMetrics.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(true)}
                      className="px-3 py-1.5 border rounded-full text-xs font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100"
                    >
                      المزيد (+{availableCategoriesWithMetrics.length - 5})...
                    </button>
                  )}
                  {showAllCategories && availableCategoriesWithMetrics.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(false)}
                      className="px-3 py-1.5 border rounded-full text-xs font-bold transition bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-100"
                    >
                      عرض أقل
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          {/* ══════════ FILTERED SUMMARY BANNER ══════════ */}
          {(search || selectedCategory || statusFilter !== "all") && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl px-4 py-2.5 flex justify-between items-center text-xs">
              <div>
                <span className="text-blue-800 dark:text-blue-300 font-bold">
                  نتائج التصفية:{" "}
                  <strong className="text-blue-600 dark:text-blue-400 font-black">
                    {filteredInventory.length} مادة
                  </strong>
                </span>
                <span className="mx-2 text-gray-300">|</span>
                <span className="text-gray-600 dark:text-gray-400 font-bold">
                  القيمة الكلية:{" "}
                  <strong className="text-gray-900 dark:text-white font-black">
                    {fmt(filteredTotalValue)} د.ع
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyAiReport}
                className="bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-300 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-zinc-700 flex items-center gap-1 hover:bg-blue-50 transition active:scale-95"
                title="نسخ تقرير المخزن"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>نسخ للذكاء 🤖</span>
              </button>
            </div>
          )}

          {/* ══════════ EMPTY STATE ══════════ */}
          {filteredInventory.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center border border-gray-100 dark:border-zinc-800 space-y-3">
              <span className="text-5xl block mb-2">📦</span>
              <h4 className="text-base font-black text-gray-800 dark:text-gray-200">
                لا توجد مواد تطابق البحث أو التصفية الحالية
              </h4>
              <p className="text-xs text-gray-500 font-bold">
                جرّب تعديل كلمة البحث، أو اختر تصنيفاً آخر، أو أضف مواد جديدة للمخزن.
              </p>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="bg-blue-600 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-md shadow-blue-500/20 active:scale-95 transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مادة للمخزن الآن</span>
              </button>
            </div>
          ) : viewMode === "cards" ? (
            /* ══════════ VIEW MODE 1: LUXURY CARDS GRID ══════════ */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredInventory.map(item => {
                const qty = Number(item.quantity) || 0;
                const minAlert = Number(item.minAlert) || 1;
                const isZero = qty <= 0;
                const isLow = qty <= minAlert && !isZero;
                const catGradient = CAT_COLORS[item.category] || "from-gray-400 to-gray-600";
                const totalItemValue = qty * (Number(item.price) || 0);

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition hover:shadow-md ${
                      isZero
                        ? "border-red-200 dark:border-red-900/40 bg-gradient-to-b from-red-50/20 to-white dark:from-red-950/10 dark:to-zinc-900"
                        : isLow
                        ? "border-amber-200 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/20 to-white dark:from-amber-950/10 dark:to-zinc-900"
                        : "border-gray-100 dark:border-zinc-800"
                    }`}
                  >
                    {/* Top Status Gradient Strip */}
                    <div
                      className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r ${
                        isZero
                          ? "from-red-500 to-rose-600"
                          : isLow
                          ? "from-amber-500 to-orange-500"
                          : catGradient
                      }`}
                    />

                    {/* Top Row: Quick Image & Badge */}
                    <div className="p-3 pb-2 flex items-start gap-2.5">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative border border-gray-200/60 dark:border-zinc-700 text-2xl">
                        {item.imageUrl || item.tempImageUrl ? (
                          <img
                            src={item.imageUrl || item.tempImageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{CAT_ICONS[item.category] || "📦"}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold truncate">
                            {item.category || "أخرى"}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditItem(item)}
                              className="text-gray-400 hover:text-blue-500 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                              title="تعديل المادة"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-800 transition"
                              title="حذف المادة من المخزن"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white truncate leading-tight mt-0.5" title={item.name}>
                          {item.name}
                        </h4>

                        {/* Status Badge */}
                        <div className="mt-1">
                          {isZero ? (
                            <span className="text-[9px] bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                              🔴 نفدت (نقص: {item.neededQuantity || 1} {item.unit})
                            </span>
                          ) : isLow ? (
                            <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                              ⚠️ نقص ({qty} {item.unit})
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                              🟢 متوفر ({qty} {item.unit})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pricing Information */}
                    <div className="px-3 py-1.5 bg-gray-50/70 dark:bg-zinc-800/50 border-y border-gray-100 dark:border-zinc-800 text-[11px] flex items-center justify-between font-bold">
                      <span className="text-gray-500">
                        المفرد: <strong className="text-gray-800 dark:text-gray-200">{fmt(item.price)}</strong>
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        الإجمالي: {fmt(totalItemValue)} د.ع
                      </span>
                    </div>

                    {/* Stock Stepper & Quick Action Buttons */}
                    <div className="p-3 pt-2 space-y-2">
                      {/* Quantity Stepper (+ / −) */}
                      <div className="flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => updateInventoryQuantity(item.id, qty, 1)}
                          className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-600 font-black flex items-center justify-center transition active:scale-95 shadow-xs"
                          title="زيادة الكمية +1"
                        >
                          +
                        </button>
                        <span className="text-xs font-black text-gray-900 dark:text-white font-mono">
                          {qty} <span className="text-[10px] text-gray-400">{item.unit}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => updateInventoryQuantity(item.id, qty, -1)}
                          className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 font-black flex items-center justify-center transition active:scale-95 shadow-xs"
                          title="إنقاص الكمية -1"
                        >
                          −
                        </button>
                      </div>

                      {/* Action Links */}
                      <div className="flex items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => onSinglePurchase(item)}
                          className="flex-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] py-1.5 rounded-xl flex items-center justify-center gap-1 transition active:scale-95"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>شراء</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onViewHistory(item.name)}
                          className="w-7 h-7 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center transition active:scale-95"
                          title="كاشف الشراء (شوكت ومنين؟)"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onViewTimeline(item)}
                          className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 flex items-center justify-center transition active:scale-95"
                          title="دورة النفاد وتاريخ الاستهلاك"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === "table" ? (
            /* ══════════ VIEW MODE 2: ITEMIZED TABLE / LIST ══════════ */
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-zinc-700">
                    <tr>
                      <th className="py-3 px-3">المادة</th>
                      <th className="py-3 px-2">القسم</th>
                      <th className="py-3 px-2 text-center">الكمية بالمخزن</th>
                      <th className="py-3 px-2 text-center">السعر المفرد</th>
                      <th className="py-3 px-2 text-center">القيمة الكلية</th>
                      <th className="py-3 px-2 text-center">الحالة</th>
                      <th className="py-3 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {filteredInventory.map(item => {
                      const qty = Number(item.quantity) || 0;
                      const isZero = qty <= 0;
                      const isLow = qty <= Number(item.minAlert || 1) && !isZero;
                      const totalItemValue = qty * (Number(item.price) || 0);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition font-bold"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{CAT_ICONS[item.category] || "📦"}</span>
                              <div>
                                <p className="font-black text-gray-900 dark:text-white leading-tight">
                                  {item.name}
                                </p>
                                {item.lastStoreName && (
                                  <p className="text-[10px] text-gray-400 font-normal">
                                    المورد: {item.lastStoreName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-gray-600 dark:text-gray-300">
                            {item.category || "أخرى"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <div className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
                              <button
                                type="button"
                                onClick={() => updateInventoryQuantity(item.id, qty, 1)}
                                className="text-emerald-600 hover:scale-110 font-black"
                              >
                                +
                              </button>
                              <span>{qty} {item.unit}</span>
                              <button
                                type="button"
                                onClick={() => updateInventoryQuantity(item.id, qty, -1)}
                                className="text-red-500 hover:scale-110 font-black"
                              >
                                −
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-gray-700 dark:text-gray-300">
                            {fmt(item.price)} د.ع
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {fmt(totalItemValue)} د.ع
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {isZero ? (
                              <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 px-2 py-0.5 rounded-full font-black">
                                نفدت
                              </span>
                            ) : isLow ? (
                              <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-black">
                                نقص
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-black">
                                متوفر
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSinglePurchase(item)}
                                className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-100 transition"
                                title="شراء"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                className="p-1.5 bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition"
                                title="تعديل"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 rounded-lg hover:bg-red-100 transition"
                                title="حذف المادة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ══════════ VIEW MODE 3: GROUPED BY CATEGORY ══════════ */
            <div className="space-y-6">
              {CAKE_INVENTORY_CATEGORIES.map(cat => {
                const catItems = filteredInventory.filter(item => {
                  const itemCat = item.category || "أخرى";
                  return itemCat === cat || (cat === "أخرى" && !CAKE_INVENTORY_CATEGORIES.includes(itemCat));
                });
                if (catItems.length === 0) return null;

                const catTotal = catItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0);

                return (
                  <div key={cat} className="space-y-2.5">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60 px-3.5 py-2 rounded-2xl border border-gray-200/80 dark:border-zinc-700/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CAT_ICONS[cat] || "📦"}</span>
                        <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                          {cat} ({catItems.length})
                        </h4>
                      </div>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        {fmt(catTotal)} د.ع
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {catItems.map(item => {
                        const qty = Number(item.quantity) || 0;
                        const isZero = qty <= 0;
                        const isLow = qty <= Number(item.minAlert || 1) && !isZero;
                        return (
                          <div
                            key={item.id}
                            className={`bg-white dark:bg-zinc-900 rounded-2xl p-3 border shadow-xs flex flex-col justify-between ${
                              isZero ? "border-red-300 dark:border-red-900/60" : isLow ? "border-amber-300 dark:border-amber-900/60" : "border-gray-100 dark:border-zinc-800"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h5 className="font-black text-xs text-gray-900 dark:text-white truncate flex-1">
                                {item.name}
                              </h5>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 my-1">
                              <span>المفرد: {fmt(item.price)}</span>
                              <span className="font-mono text-gray-900 dark:text-white">
                                {qty} {item.unit}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                              <button
                                type="button"
                                onClick={() => onSinglePurchase(item)}
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-bold py-1 rounded-lg text-center"
                              >
                                شراء
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                className="p-1 rounded-lg bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SUB-TAB 2: SHORTAGES & RESTOCK ═══════════════ */}
      {subTab === "shortages" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-3xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-black text-base sm:text-lg">قائمة النواقص ومستلزمات الشراء</h3>
              </div>
              <p className="text-orange-100 text-xs font-bold mt-1">
                جميع المواد التي نفدت أو شارفت على الانتهاء وبحاجة لتجهيز عاجل
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/20 text-center">
              <span className="text-[10px] text-orange-100 font-bold block">التكلفة التقديرية</span>
              <span className="text-base sm:text-lg font-black">{fmt(lowStockCost)} د.ع</span>
            </div>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-black text-base text-gray-900 dark:text-white">المخزن متكامل تماماً!</h4>
              <p className="text-xs text-gray-500 font-bold mt-0.5">
                لا توجد مواد ناقصة أو منتهية حالياً. جميع الأصناف متوفرة فوق الحد الأدنى.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lowStockItems.map(item => {
                const neededQty = Number(item.neededQuantity) || 1;
                const cost = neededQty * Number(item.price || 0);

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-200 dark:border-orange-800/40 p-3 flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-2xl">{CAT_ICONS[item.category] || "📦"}</span>
                        <span className="text-[10px] bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-black px-2 py-0.5 rounded-full">
                          مطلوب: {neededQty} {item.unit}
                        </span>
                      </div>
                      <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                        التكلفة: <strong className="text-gray-900 dark:text-white">{fmt(cost)} د.ع</strong>
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handlePurchaseMissing(item)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-1.5 rounded-xl flex items-center justify-center gap-1 transition active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تم التوفير</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSinglePurchase(item)}
                        className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] py-1.5 rounded-xl text-center"
                      >
                        🛒 شراء بتفاصيل
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ SUB-TAB 3: CONSUMPTION CYCLES ═══════════════ */}
      {subTab === "cycles" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>معدل الاستهلاك ودورة النفاد المتوقعة لكل مادة</span>
            </h4>
            <div className="flex bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-xl text-xs font-bold">
              {["all", "critical", "warning", "healthy"].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCycleFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    cycleFilterStatus === st ? "bg-white dark:bg-zinc-700 text-purple-600 font-black shadow-xs" : "text-gray-500"
                  }`}
                >
                  {st === "all" ? "الكل" : st === "critical" ? "حرج" : st === "warning" ? "تحذير" : "آمن"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsWithConsumption.map((item, idx) => {
              const daysLeft = item.metrics?.estimatedDaysLeft ?? null;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white">
                        {item.name}
                      </h5>
                      <span className="text-[10px] text-gray-500 font-bold">
                        الكمية: {item.quantity} {item.unit}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      daysLeft !== null && daysLeft <= 3
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                        : daysLeft !== null && daysLeft <= 7
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}>
                      {daysLeft !== null ? `يكفي لـ ${daysLeft} يوم` : "غير محدد"}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">
                      معدل يومي: <strong>{item.metrics?.dailyConsumption?.toFixed(2) || "0"} {item.unit}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewTimeline(item)}
                      className="text-purple-600 font-bold hover:underline"
                    >
                      التفاصيل ↗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ SUB-TAB 4: PURCHASES & INVOICES (HOME FINANCE SYSTEM) ═══════════════ */}
      {subTab === "purchases" && (
        <div className="space-y-4">
          {/* Top KPI Banner for Invoices */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-200/60 dark:border-zinc-800">
            <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-purple-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-purple-600" /> إجمالي الفواتير
              </span>
              <span className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-300 mt-1">
                {fmt(invoiceMetrics.totalAmount)} <span className="text-[9px] text-gray-400">د.ع</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> عدد الفواتير
              </span>
              <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-1">
                {invoiceMetrics.count} <span className="text-[9px] text-gray-400">فاتورة</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-blue-500" /> إجمالي المواد المشتراة
              </span>
              <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400 mt-1">
                {invoiceMetrics.totalItems} <span className="text-[9px] text-gray-400">مادة</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-zinc-900/80 p-3 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> متوسط الفاتورة
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {fmt(invoiceMetrics.avgAmount)} <span className="text-[9px] text-gray-400">د.ع</span>
              </span>
            </div>
          </div>

          {/* Action Bar & Controls */}
          <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            {/* Search Box */}
            <div className="relative flex-1 w-full sm:w-auto">
              <input
                type="text"
                placeholder="ابحث في سجل المشتريات، المحلات، أو أسماء المواد..."
                value={purchasesSearch}
                onChange={e => setPurchasesSearch(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 pr-9 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-900 dark:text-white"
              />
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              {purchasesSearch && (
                <button
                  type="button"
                  onClick={() => setPurchasesSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Buttons & View Switcher */}
            <div className="flex flex-wrap items-center justify-between w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={onOpenAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة فاتورة / قائمة 📦</span>
              </button>

              <button
                type="button"
                onClick={onScanInvoice}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>مسح ذكي 📸</span>
              </button>

              {/* View Mode Toggle: Cards vs Table */}
              <div className="flex items-center bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setInvoiceViewMode("cards")}
                  className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    invoiceViewMode === "cards" ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-300 shadow-xs" : "text-gray-500"
                  }`}
                  title="عرض البطاقات"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[10px]">بطاقات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    invoiceViewMode === "table" ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-300 shadow-xs" : "text-gray-500"
                  }`}
                  title="عرض جدول الفواتير"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[10px]">جدول</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Invoices */}
          {(() => {
            const list = (groupedInvoices || []).filter(inv => {
              if (!purchasesSearch.trim()) return true;
              const q = purchasesSearch.toLowerCase().trim();
              return (
                inv.storeName?.toLowerCase().includes(q) ||
                inv.date?.toLowerCase().includes(q) ||
                inv.items?.some((i: any) => i.itemName?.toLowerCase().includes(q))
              );
            });

            if (list.length === 0) {
              return (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                  <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-bold">
                    {purchasesSearch ? "لا توجد فواتير مطابقة للبحث" : "لا توجد فواتير أو مشتريات مسجلة بعد"}
                  </p>
                </div>
              );
            }

            if (invoiceViewMode === "table") {
              return (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700 text-gray-500 font-black text-[11px]">
                          <th className="py-3 px-3 text-center w-10">#</th>
                          <th className="py-3 px-3">المحل / المورد</th>
                          <th className="py-3 px-3">التاريخ</th>
                          <th className="py-3 px-3 text-center">عدد المواد</th>
                          <th className="py-3 px-3">أبرز المواد</th>
                          <th className="py-3 px-3 text-left">المبلغ الإجمالي</th>
                          <th className="py-3 px-3 text-center w-24">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 font-bold">
                        {list.map((inv: any, idx: number) => {
                          const itemsCount = inv.items?.length || 0;
                          return (
                            <tr key={inv.id || idx} className="hover:bg-indigo-50/40 dark:hover:bg-zinc-800/40 transition">
                              <td className="py-3 px-3 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <Store className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="font-black text-gray-900 dark:text-white">{inv.storeName || "معرض مستلزمات الكيك"}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                📅 {inv.date}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-black">
                                  {itemsCount} مواد
                                </span>
                              </td>
                              <td className="py-3 px-3 max-w-xs">
                                <div className="truncate text-[11px] text-gray-500">
                                  {(inv.items || []).map((i: any) => i.itemName).slice(0, 3).join("، ")}
                                  {itemsCount > 3 ? "..." : ""}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-left whitespace-nowrap font-mono">
                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                  {fmt(inv.totalAmount)}
                                </span>
                                <span className="text-[10px] text-gray-400 mr-1">د.ع</span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCakeInvoice(inv)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                                    title="تعديل الفاتورة"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWholeInvoice(inv)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                                    title="حذف الفاتورة كاملة"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {list.map((inv: any) => {
                  const isExpanded = !!expandedInvoices[inv.id];
                  const itemsCount = inv.items?.length || 0;

                  return (
                    <div
                      key={inv.id}
                      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-200 dark:border-zinc-800 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{inv.storeName || "معرض مستلزمات الكيك"}</span>
                              {inv.invoiceNumber && (
                                <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                                  #{inv.invoiceNumber}
                                </span>
                              )}
                            </h4>
                            <span className="text-[10px] text-gray-500 font-bold">
                              📅 {inv.date} | {itemsCount} مواد
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                            {fmt(inv.totalAmount)} د.ع
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingCakeInvoice(inv)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 transition"
                            title="تعديل الفاتورة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWholeInvoice(inv)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 transition"
                            title="حذف الفاتورة كاملة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Items List Inside Invoice (Collapsible) */}
                      <div className="bg-gray-50/70 dark:bg-zinc-800/50 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-black text-gray-500 pb-1 border-b border-gray-200/50 dark:border-zinc-700/50">
                          <span>قائمة المواد المشمولة ({itemsCount}):</span>
                          {itemsCount > 3 && (
                            <button
                              type="button"
                              onClick={() => setExpandedInvoices(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>{isExpanded ? "طي المواد" : `عرض الكل (${itemsCount})`}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {(isExpanded ? inv.items : (inv.items || []).slice(0, 3))?.map((it: any, iIdx: number) => (
                          <div
                            key={iIdx}
                            className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300"
                          >
                            <span>• {it.itemName} ({it.quantity} {it.unit})</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {fmt(it.totalPrice)} د.ع
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
