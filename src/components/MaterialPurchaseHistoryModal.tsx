"use client";
import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Calendar,
  Store,
  DollarSign,
  Package,
  Clock,
  Receipt,
  Eye,
  TrendingDown,
  TrendingUp,
  Tag,
  CreditCard,
  Layers,
  ArrowRight
} from "lucide-react";
import { CakeMaterialPurchase, normalizeArabicText } from "@/lib/cakeMaterialPurchases";

interface MaterialPurchaseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItemName?: string;
  inventoryItems: any[];
  purchases?: CakeMaterialPurchase[];
  allPurchases?: CakeMaterialPurchase[];
  onOpenInvoiceDetails?: (invoice: any) => void;
  onOpenManualPurchase?: (itemName: string) => void;
  onViewImage?: (imageUrl: string, title: string) => void;
}

export default function MaterialPurchaseHistoryModal({
  isOpen,
  onClose,
  initialItemName = "",
  inventoryItems,
  purchases: rawPurchases,
  allPurchases,
  onOpenInvoiceDetails,
  onOpenManualPurchase,
  onViewImage
}: MaterialPurchaseHistoryModalProps) {
  const purchases = rawPurchases || allPurchases || [];
  const [selectedMaterialName, setSelectedMaterialName] = useState<string>(initialItemName);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sync initialItemName when opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialItemName) {
        setSelectedMaterialName(initialItemName);
        setSearchQuery(initialItemName);
      } else {
        setSelectedMaterialName("");
        setSearchQuery("");
      }
    }
  }, [isOpen, initialItemName]);

  // Extract all unique material names from inventory + purchases
  const allMaterialNames = useMemo(() => {
    const setNames = new Map<string, string>(); // normalized -> original
    inventoryItems.forEach((inv) => {
      if (inv.name && inv.name.trim()) {
        const norm = normalizeArabicText(inv.name);
        if (!setNames.has(norm)) setNames.set(norm, inv.name.trim());
      }
    });
    purchases.forEach((p) => {
      if (p.itemName && p.itemName.trim()) {
        const norm = normalizeArabicText(p.itemName);
        if (!setNames.has(norm)) setNames.set(norm, p.itemName.trim());
      }
    });
    return Array.from(setNames.values());
  }, [inventoryItems, purchases]);

  // Filtered suggested materials based on searchQuery
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return allMaterialNames.slice(0, 10);
    const norm = normalizeArabicText(searchQuery);
    return allMaterialNames.filter((name) => normalizeArabicText(name).includes(norm));
  }, [allMaterialNames, searchQuery]);

  // Selected material matching purchases
  const materialPurchases = useMemo(() => {
    if (!selectedMaterialName) return [];
    const normTarget = normalizeArabicText(selectedMaterialName);
    return purchases
      .filter((p) => normalizeArabicText(p.itemName) === normTarget)
      .sort((a, b) => (b.purchaseDate || "").localeCompare(a.purchaseDate || ""));
  }, [purchases, selectedMaterialName]);

  // Inventory record for the selected material
  const matchedInventoryItem = useMemo(() => {
    if (!selectedMaterialName) return null;
    const normTarget = normalizeArabicText(selectedMaterialName);
    return inventoryItems.find((inv) => normalizeArabicText(inv.name) === normTarget) || null;
  }, [inventoryItems, selectedMaterialName]);

  // Analytics: When, Where, Price Comparison
  const analytics = useMemo(() => {
    if (materialPurchases.length === 0) return null;

    const count = materialPurchases.length;
    const latest = materialPurchases[0];
    const oldest = materialPurchases[count - 1];

    const totalQty = materialPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const unit = latest.unit || matchedInventoryItem?.unit || "كغم";

    // Days since last purchase
    let daysAgoText = "اليوم";
    if (latest.purchaseDate) {
      const now = new Date();
      const pDate = new Date(latest.purchaseDate);
      const diffMs = now.getTime() - pDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) daysAgoText = "اليوم";
      else if (diffDays === 1) daysAgoText = "أمس";
      else if (diffDays === 2) daysAgoText = "قبل يومين";
      else if (diffDays <= 10) daysAgoText = `قبل ${diffDays} أيام`;
      else daysAgoText = `قبل ${diffDays} يوماً`;
    }

    // Prices comparison
    const prices = materialPurchases
      .map((p) => Number(p.unitPrice) || 0)
      .filter((pr) => pr > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : Number(latest.unitPrice || 0);
    const maxPrice = prices.length > 0 ? Math.max(...prices) : Number(latest.unitPrice || 0);
    const latestPrice = Number(latest.unitPrice || 0);

    // Group by store name (منين اشتريتها)
    const storeMap: Record<string, { count: number; lastDate: string; lastPrice: number; prices: number[] }> = {};
    materialPurchases.forEach((p) => {
      const sName = p.storeName?.trim() || "متجر غير محدد";
      if (!storeMap[sName]) {
        storeMap[sName] = {
          count: 0,
          lastDate: p.purchaseDate || "",
          lastPrice: Number(p.unitPrice) || 0,
          prices: []
        };
      }
      storeMap[sName].count += 1;
      if (Number(p.unitPrice) > 0) storeMap[sName].prices.push(Number(p.unitPrice));
      if (!storeMap[sName].lastDate || (p.purchaseDate && p.purchaseDate > storeMap[sName].lastDate)) {
        storeMap[sName].lastDate = p.purchaseDate;
        storeMap[sName].lastPrice = Number(p.unitPrice) || 0;
      }
    });

    const storeList = Object.entries(storeMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        lastDate: data.lastDate,
        lastPrice: data.lastPrice,
        avgPrice: data.prices.length > 0 ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length) : data.lastPrice
      }))
      .sort((a, b) => b.count - a.count);

    return {
      count,
      latest,
      oldest,
      totalQty,
      unit,
      daysAgoText,
      minPrice,
      maxPrice,
      latestPrice,
      storeList
    };
  }, [materialPurchases, matchedInventoryItem]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border-0 sm:border border-gray-100 dark:border-zinc-800 sm:rounded-3xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden shadow-2xl flex flex-col my-auto custom-scrollbar">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Search className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                كاشف مشتريات المواد
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                  شوكت ومنين اشتريتها؟
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                ابحث عن أي مادة لمعرفة تاريخ شرائها ومتاجرها وأسعارها بدقة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Quick Chips */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800 shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب اسم المادة (مثال: طحين، سكر، فانيلا، فستق، كريمة...)"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-sm font-black rounded-xl py-2.5 pr-10 pl-9 focus:outline-none focus:border-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedMaterialName("");
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Suggested Material Chips */}
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
            {filteredSuggestions.slice(0, 14).map((name) => {
              const isSelected = normalizeArabicText(name) === normalizeArabicText(selectedMaterialName);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelectedMaterialName(name);
                    setSearchQuery(name);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>📦 {name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0 custom-scrollbar">
          {!selectedMaterialName ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto text-3xl">
                🔎
              </div>
              <h4 className="font-black text-gray-800 dark:text-white text-base">
                اختر أو اكتب اسم مادة للبحث
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                سيعرض لك النظام متى اشتريتها آخر مرة، من أي متجر، مقارنة الأسعار، وكل الفواتير التي وردت فيها.
              </p>
            </div>
          ) : materialPurchases.length === 0 ? (
            <div className="text-center py-10 bg-amber-50/50 dark:bg-zinc-800/40 border border-amber-200 dark:border-zinc-700 rounded-3xl p-6 space-y-3">
              <Package className="w-12 h-12 text-amber-500 mx-auto" />
              <h4 className="font-black text-gray-900 dark:text-white text-base">
                لا توجد سجلات شراء سابقة لمادة &quot;{selectedMaterialName}&quot;
              </h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                {matchedInventoryItem
                  ? `المادة مسجلة في المخزن برصيد (${matchedInventoryItem.quantity} ${matchedInventoryItem.unit}) ولكن لم يتم تسجيل فاتورة شراء لها بعد.`
                  : "المادة غير مسجلة في فواتير الشراء أو المخزن حالياً."}
              </p>
            </div>
          ) : (
            analytics && (
              <>
                {/* ─── SUMMARY CARDS: WHEN & WHERE (شوكت ومنين) ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Card 1: شوكت اشتريتها (When) */}
                  <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:from-zinc-800/80 dark:to-zinc-800/40 border border-blue-100 dark:border-zinc-700 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300 font-bold text-xs">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>📅 شوكت اشتريتها؟ (التاريخ)</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-500 font-bold">آخر شراء:</span>
                        <div className="text-left">
                          <span className="font-black text-sm text-gray-900 dark:text-white font-mono">
                            {analytics.latest.purchaseDate || "—"}
                          </span>
                          <span className="text-[10px] mr-1.5 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-black">
                            {analytics.daysAgoText}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-gray-500 font-bold">عدد مرات الشراء:</span>
                        <span className="font-black">{analytics.count} مرات</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-gray-500 font-bold">إجمالي ما تم شراؤه:</span>
                        <span className="font-black text-indigo-700 dark:text-indigo-300">
                          {analytics.totalQty} {analytics.unit}
                        </span>
                      </div>

                      {matchedInventoryItem && (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-100 dark:border-zinc-700">
                          <span className="text-gray-500 font-bold">المتوفر في المخزن الآن:</span>
                          <span className={`font-black px-2 py-0.5 rounded-lg ${
                            Number(matchedInventoryItem.quantity) <= Number(matchedInventoryItem.minAlert || 1)
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}>
                            {matchedInventoryItem.quantity} {matchedInventoryItem.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: منين اشتريتها (Where) */}
                  <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-zinc-800/80 dark:to-zinc-800/40 border border-purple-100 dark:border-zinc-700 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                      <Store className="w-4 h-4 text-purple-600" />
                      <span>🏪 منين اشتريتها؟ (المتاجر والموردين)</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-500 font-bold">آخر متجر:</span>
                        <span className="font-black text-sm text-purple-950 dark:text-purple-200 truncate max-w-[170px]">
                          {analytics.latest.storeName || "متجر غير محدد"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-gray-500 font-bold">آخر سعر مفرد:</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          {analytics.latestPrice.toLocaleString()} د.ع
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span className="text-gray-500 font-bold">مقارنة الأسعار:</span>
                        <span className="text-[11px] font-black">
                          أرخص: {analytics.minPrice.toLocaleString()} | أغلى: {analytics.maxPrice.toLocaleString()}
                        </span>
                      </div>

                      {analytics.storeList.length > 1 && (
                        <div className="pt-1.5 border-t border-purple-100 dark:border-zinc-700">
                          <span className="text-[10px] text-gray-400 font-bold block mb-1">
                            تم الشراء من {analytics.storeList.length} متاجر مختلفة:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {analytics.storeList.map((st) => (
                              <span
                                key={st.name}
                                className="text-[9px] bg-white dark:bg-zinc-700 px-1.5 py-0.5 rounded border border-purple-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 font-bold"
                              >
                                {st.name} ({st.count}x)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── STORES COMPARISON LIST (منين؟) ─── */}
                <div className="space-y-2">
                  <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>تفاصيل المتاجر التي وفرت &quot;{selectedMaterialName}&quot;</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analytics.storeList.map((st) => (
                      <div
                        key={st.name}
                        className="bg-gray-50 dark:bg-zinc-800/70 p-3 rounded-xl border border-gray-100 dark:border-zinc-700/60 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-black text-xs text-gray-900 dark:text-white truncate">
                            🏬 {st.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-bold">
                            آخر شراء: {st.lastDate || "—"} ({st.count} مرات)
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                            {st.lastPrice.toLocaleString()} د.ع
                          </span>
                          <span className="block text-[9px] text-gray-400">سعر المفرد</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ─── CHRONOLOGICAL PURCHASE TIMELINE (شوكت؟) ─── */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>السجل الزمني لكافة المشتريات ({materialPurchases.length})</span>
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold">من الأحدث إلى الأقدم</span>
                  </div>

                  <div className="space-y-2">
                    {materialPurchases.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Right: Date, Store, Invoice Info */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-gray-900 dark:text-white flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-500" />
                              {p.purchaseDate || "بدون تاريخ"}
                            </span>
                            {p.invoiceNumber && (
                              <span className="text-[10px] bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded font-mono font-bold text-slate-700 dark:text-slate-300">
                                #{p.invoiceNumber}
                              </span>
                            )}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              p.paymentSource === "salary"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : p.paymentSource === "split"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                                : p.paymentSource === "none"
                                ? "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                            }`}>
                              {p.paymentSource === "salary"
                                ? "دين راتب"
                                : p.paymentSource === "split"
                                ? "مقسم"
                                : p.paymentSource === "none"
                                ? "مخزن فقط"
                                : "أموال كيك"}
                            </span>
                          </div>

                          <p className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="truncate">{p.storeName || "متجر غير محدد"}</span>
                          </p>

                          {p.notes && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                              💬 {p.notes}
                            </p>
                          )}
                        </div>

                        {/* Left: Quantity, Price & Attached Receipt Image */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-zinc-700/60">
                          {/* Attached Receipt Image Thumbnail */}
                          {p.invoiceImageUrl && (
                            <button
                              type="button"
                              onClick={() => onViewImage && onViewImage(p.invoiceImageUrl!, `فاتورة: ${p.storeName || selectedMaterialName}`)}
                              className="relative group shrink-0"
                              title="معاينة صورة الفاتورة الأصلية"
                            >
                              <img
                                src={p.invoiceImageUrl}
                                alt="Receipt"
                                className="w-10 h-10 rounded-xl object-cover border border-purple-200 dark:border-purple-800 group-hover:scale-105 transition shadow-xs"
                              />
                              <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                          )}

                          <div className="text-left">
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="text-xs font-bold text-gray-500">الكمية:</span>
                              <span className="font-black text-xs text-blue-700 dark:text-blue-300">
                                {p.quantity} {p.unit}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="text-[10px] text-gray-400">المفرد:</span>
                              <span className="font-black text-xs text-gray-800 dark:text-gray-200">
                                {Number(p.unitPrice || 0).toLocaleString()} د.ع
                              </span>
                            </div>
                            <div className="font-black text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {Number(p.totalPrice || 0).toLocaleString()} د.ع
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-zinc-800/80 border-t border-gray-100 dark:border-zinc-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-200 font-bold text-xs transition"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
}
