"use client";
import React, { useState, useEffect } from "react";
import {
  Package,
  Calendar,
  Receipt,
  ShoppingCart,
  Store,
  Check,
  X,
  Loader2,
  DollarSign,
  Tag
} from "lucide-react";
import { toast } from "sonner";
import AutocompleteInput from "@/components/AutocompleteInput";
import {
  CAKE_INVENTORY_CATEGORIES,
  CAKE_INVENTORY_UNITS
} from "@/lib/scanCakeInvoiceClient";
import { recordSingleCakePurchase } from "@/lib/cakeMaterialPurchases";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ManualCakePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: any[];
  initialItem?: any;
  onSuccess: () => void;
}

export default function ManualCakePurchaseModal({
  isOpen,
  onClose,
  inventoryItems,
  initialItem,
  onSuccess
}: ManualCakePurchaseModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("طحين وسكر");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("كغم");
  const [totalPrice, setTotalPrice] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [hasInvoice, setHasInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [storeName, setStoreName] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentSource, setPaymentSource] = useState<"none" | "cake" | "salary" | "split">("cake");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);

  const existingItemNames = inventoryItems.map((i) => i.name).filter(Boolean);

  useEffect(() => {
    if (isOpen) {
      // Load previous store suggestions for fast autocomplete
      const fetchStores = async () => {
        try {
          const qSnap = await getDocs(query(collection(db, "cake_material_purchases"), limit(120)));
          const setNames = new Set<string>();
          qSnap.docs.forEach((d) => {
            const s = d.data().storeName;
            if (s && typeof s === "string" && s.trim()) setNames.add(s.trim());
          });
          try {
            const invSnap = await getDocs(query(collection(db, "cake_invoices"), limit(50)));
            invSnap.docs.forEach((d) => {
              const s = d.data().storeName;
              if (s && typeof s === "string" && s.trim()) setNames.add(s.trim());
            });
          } catch {}
          setStoreSuggestions(Array.from(setNames));
        } catch (e) {
          console.warn("Could not load store suggestions:", e);
        }
      };
      fetchStores();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split("T")[0];
      setPurchaseDate(todayStr);

      if (initialItem) {
        setSelectedItemId(initialItem.id);
        setItemName(initialItem.name);
        setCategory(initialItem.category || "طحين وسكر");
        setUnit(initialItem.unit || "كغم");
        setQuantity(initialItem.neededQuantity > 0 ? String(initialItem.neededQuantity) : "1");
        const initUnitP = Number(initialItem.price) || 0;
        if (initUnitP > 0) {
          setUnitPrice(String(initUnitP));
          setTotalPrice(String(initUnitP * (Number(initialItem.neededQuantity) || 1)));
        } else {
          setUnitPrice("");
          setTotalPrice("");
        }
      } else {
        setSelectedItemId("");
        setItemName("");
        setCategory("طحين وسكر");
        setQuantity("1");
        setUnit("كغم");
        setTotalPrice("");
        setUnitPrice("");
      }
      setHasInvoice(false);
      setInvoiceNumber("");
      setStoreName("");
      setNotes("");
      setPaymentSource("cake");
      setSplitDebtAmount("");
    }
  }, [isOpen, initialItem]);

  if (!isOpen) return null;

  // Handle changing material name
  const handleItemNameChange = (val: string) => {
    setItemName(val);
    const found = inventoryItems.find(
      (i) => i.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (found) {
      setSelectedItemId(found.id);
      if (found.category) setCategory(found.category);
      if (found.unit) setUnit(found.unit);
      if (found.price && Number(found.price) > 0) {
        setUnitPrice(String(found.price));
        if (quantity) {
          setTotalPrice(String(Number(found.price) * Number(quantity)));
        }
      }
    } else {
      setSelectedItemId("");
    }
  };

  // Auto-sync unitPrice and totalPrice
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const q = Number(val) || 0;
    const u = Number(unitPrice) || 0;
    if (q > 0 && u > 0) {
      setTotalPrice(String(Math.round(q * u)));
    }
  };

  const handleTotalPriceChange = (val: string) => {
    setTotalPrice(val);
    const t = Number(val) || 0;
    const q = Number(quantity) || 1;
    if (q > 0) {
      setUnitPrice(String(Math.round(t / q)));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const u = Number(val) || 0;
    const q = Number(quantity) || 0;
    if (q > 0) {
      setTotalPrice(String(Math.round(q * u)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error("يرجى إدخال اسم المادة المشتراة");
      return;
    }
    const qVal = Number(quantity);
    if (isNaN(qVal) || qVal <= 0) {
      toast.error("يرجى إدخال كمية صحيحة أكبر من صفر");
      return;
    }

    setSubmitting(true);
    try {
      const totPrice = Number(totalPrice) || 0;
      const uPrice = Number(unitPrice) || (qVal > 0 ? totPrice / qVal : 0);

      await recordSingleCakePurchase({
        itemId: selectedItemId || undefined,
        itemName: itemName.trim(),
        category,
        quantity: qVal,
        unit,
        unitPrice: Math.round(uPrice),
        totalPrice: Math.round(totPrice),
        purchaseDate: purchaseDate || new Date().toISOString().split("T")[0],
        hasInvoice,
        invoiceNumber: hasInvoice ? invoiceNumber.trim() : "",
        storeName: storeName.trim(),
        paymentSource,
        splitDebtAmount: paymentSource === "split" ? Number(splitDebtAmount) || 0 : 0,
        notes: notes.trim(),
        createIfNotExist: !selectedItemId // if not matched with existing item, create new item in inventory!
      });

      toast.success(
        hasInvoice
          ? `✅ تم تسجيل شراء ${itemName} بفاتورة وتحديث المخزن`
          : `✅ تم تسجيل شراء ${itemName} (بدون فاتورة) وتحديث المخزن`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("حدث خطأ أثناء تسجيل الشراء: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[250] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[28px] sm:rounded-3xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header - Always Fixed & Pinned */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between border-b border-emerald-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ShoppingCart className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">
                تسجيل شراء مواد كيك
              </h3>
              <p className="text-xs text-emerald-200/80">
                تسجيل شراء (بفاتورة أو بدون فاتورة) لمتابعة تاريخ الشراء وتوقع النفاد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body - Scrollable with Pinned Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {/* Invoice or No-Invoice Toggle */}
            <div className="bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-2xl flex gap-1">
              <button
                type="button"
                onClick={() => setHasInvoice(false)}
                className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition ${
                  !hasInvoice
                    ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <span>🛒 بدون فاتورة (شراء مباشر / كاش)</span>
              </button>
              <button
                type="button"
                onClick={() => setHasInvoice(true)}
                className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition ${
                  hasInvoice
                    ? "bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-300 shadow-sm"
                    : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <span>🧾 مرفق فاتورة ورقية</span>
              </button>
            </div>

            {/* Material Name Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                اسم مادة الكيك
              </label>
              <AutocompleteInput
                value={itemName}
                onChange={handleItemNameChange}
                suggestions={existingItemNames}
                placeholder="مثال: طحين فاخر، كريمة فيزون، حشوة توت..."
                required
              />
              {selectedItemId ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> مادة مسجلة مسبقاً في المخزن (سيتم زيادة كميتها وتحديث تاريخ الشراء)
                </p>
              ) : (
                itemName.trim().length > 0 && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                    ✨ مادة جديدة (سيتم إضافتها تلقائياً للمخزن)
                  </p>
                )
              )}
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  التصنيف
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                >
                  {CAKE_INVENTORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  الوحدة
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                >
                  {CAKE_INVENTORY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity & Prices */}
            <div className="grid grid-cols-3 gap-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-2xl">
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  الكمية المشتراة
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 text-sm font-black text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  المفرد (د.ع)
                </label>
                <input
                  type="number"
                  step="any"
                  value={unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 text-sm font-bold text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  السعر الإجمالي
                </label>
                <input
                  type="number"
                  step="any"
                  value={totalPrice}
                  onChange={(e) => handleTotalPriceChange(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-sm font-black text-center text-emerald-700 dark:text-emerald-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Purchase Date & Store Name with Autocomplete */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" /> تاريخ الشراء
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-gray-400" /> اسم المحل / المورد
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">اقتراح تلقائي 💡</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="manual-purchase-store-suggestions"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="السوق / محل مستلزمات..."
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                  />
                  <datalist id="manual-purchase-store-suggestions">
                    {storeSuggestions.map((st, idx) => (
                      <option key={idx} value={st} />
                    ))}
                  </datalist>
                </div>
                {storeSuggestions.length > 0 && !storeName && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                    {storeSuggestions.slice(0, 5).map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStoreName(st)}
                        className="text-[10px] bg-gray-100 hover:bg-emerald-50 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 text-gray-700 dark:text-gray-300 hover:text-emerald-700 px-2 py-0.5 rounded-md border border-gray-200 dark:border-zinc-700 transition"
                      >
                        🏬 {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice number if hasInvoice is true */}
            {hasInvoice && (
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-blue-500" /> رقم الفاتورة (اختياري)
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="رقم الوصل أو الفاتورة"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Payment Source */}
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                مصدر الدفع (تسجيل في المصروفات المالية):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource("cake")}
                  className={`py-2 px-1 rounded-xl font-black text-xs border transition ${
                    paymentSource === "cake"
                      ? "bg-pink-600 text-white border-pink-600 shadow-sm"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  🎂 أموال الكيك
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("salary")}
                  className={`py-2 px-1 rounded-xl font-black text-xs border transition ${
                    paymentSource === "salary"
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  👤 دين من الراتب
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("split")}
                  className={`py-2 px-1 rounded-xl font-black text-xs border transition ${
                    paymentSource === "split"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  ✂️ مقسم
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("none")}
                  className={`py-2 px-1 rounded-xl font-black text-xs border transition ${
                    paymentSource === "none"
                      ? "bg-gray-700 text-white border-gray-700 shadow-sm"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  🚫 بدون تسجيل مصروف
                </button>
              </div>

              {paymentSource === "split" && (
                <div className="mt-3 animate-fade-in">
                  <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">
                    المبلغ المسدد من الراتب (دين)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={splitDebtAmount}
                    onChange={(e) => setSplitDebtAmount(e.target.value)}
                    placeholder="أدخل مبلغ الدين"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer - Pinned at bottom with safe mobile padding */}
          <div className="shrink-0 p-3 sm:p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2 sm:gap-3 pb-8 sm:pb-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  حفظ الشراء وتحديث المخزن
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3.5 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
