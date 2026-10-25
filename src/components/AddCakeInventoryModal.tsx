"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  X, Plus, Trash2, Camera, Image as ImageIcon, Receipt, Sparkles,
  Boxes, Calculator, Tag, Loader2, Check, Store, Calendar, AlertTriangle
} from "lucide-react";
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import ScanCakeInvoiceModal from "@/components/ScanCakeInvoiceModal";
import { CAKE_INVENTORY_CATEGORIES, CAKE_INVENTORY_UNITS } from "@/lib/scanCakeInvoiceClient";
import { recordSingleCakePurchase, recordCakeInvoiceBatch } from "@/lib/cakeMaterialPurchases";
import { customConfirm } from "@/lib/customConfirm";

interface InventoryEntryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  place?: string;
  minAlert?: number;
}

interface AddCakeInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingInventory?: any[];
  defaultStoreName?: string;
}

const DEFAULT_CAKE_SUPPLIERS = [
  "مستلزمات الشورجة",
  "سوق الشورجة للمواد الأولية",
  "معرض الحلواني لوزام كيك",
  "أطياب الكيك والحلويات",
  "تاج الكيك جميلة",
  "مستلزمات الكرادة",
  "مطحنة بغداد المركزية",
  "سوبر ماركت المدينة",
  "مورد الحشوات التركية"
];

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

export default function AddCakeInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  existingInventory = [],
  defaultStoreName = ""
}: AddCakeInventoryModalProps) {
  // Mode: multi-item list (like Home Finance expense receipts) or single item quick entry
  const [mode, setMode] = useState<"list" | "single">("list");
  // Target: add to in-stock inventory OR add to needed shortages list
  const [targetType, setTargetType] = useState<"available" | "need">("available");
  
  // Single Item States
  const [singleName, setSingleName] = useState("");
  const [singleCategory, setSingleCategory] = useState("طحين وسكر");
  const [singleQuantity, setSingleQuantity] = useState("1");
  const [singleUnit, setSingleUnit] = useState("كغم");
  const [singlePrice, setSinglePrice] = useState("");
  const [singleMinAlert, setSingleMinAlert] = useState("1");
  const [singleStore, setSingleStore] = useState(defaultStoreName || "");
  const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
  const [singleImagePreview, setSingleImagePreview] = useState<string | null>(null);
  const singleFileRef = useRef<HTMLInputElement>(null);

  // Multi-Item List States (Mirroring Home Finance Expense Receipts)
  const [invoiceStoreName, setInvoiceStoreName] = useState(defaultStoreName || "");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<InventoryEntryItem[]>([
    {
      id: `it-${Date.now()}-1`,
      name: "",
      category: "طحين وسكر",
      quantity: 1,
      unit: "كغم",
      unitPrice: 0,
      place: defaultStoreName || ""
    }
  ]);

  // Payment Source (when adding to stock)
  const [paidBy, setPaidBy] = useState<"cake" | "salary" | "split" | "none">("cake");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Store/Place suggestions state
  const [focusedPlaceIndex, setFocusedPlaceIndex] = useState<number | null>(null);
  const [isStoreFocused, setIsStoreFocused] = useState(false);

  // AI Invoice Scanner
  const [isScanInvoiceOpen, setIsScanInvoiceOpen] = useState(false);
  const [scanTrigger, setScanTrigger] = useState<"camera" | "gallery" | null>(null);

  // Gather unique previous store names
  const uniqueStoreNames = React.useMemo(() => {
    const list = new Set<string>();
    existingInventory.forEach((i: any) => {
      if (i.lastStoreName?.trim()) list.add(i.lastStoreName.trim());
    });
    DEFAULT_CAKE_SUPPLIERS.forEach(s => list.add(s));
    return Array.from(list);
  }, [existingInventory]);

  // Auto-detect category from item name
  const detectCategoryFromName = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("طحين") || n.includes("سكر") || n.includes("دقيق") || n.includes("نشا")) return "طحين وسكر";
    if (n.includes("كريمة") || n.includes("شانتيه") || n.includes("دريم ويب") || n.includes("قشطة") || n.includes("زبدة")) return "كريمات";
    if (n.includes("نوتيلا") || n.includes("لوتس") || n.includes("بستاشيو") || n.includes("فستق") || n.includes("كراميل") || n.includes("حشوة") || n.includes("توفي")) return "حشوات";
    if (n.includes("شوكولاته") || n.includes("شوكولا") || n.includes("كاكاو") || n.includes("حبيبات")) return "شوكولاتة وكاكاو";
    if (n.includes("لون") || n.includes("ألوان") || n.includes("جل") || n.includes("لمعة") || n.includes("داست")) return "ألوان وإضافات";
    if (n.includes("فانيلا") || n.includes("نكهة") || n.includes("عطر") || n.includes("مركز") || n.includes("هيل")) return "منكهات وعطور";
    if (n.includes("عجينة سكر") || n.includes("فوندان") || n.includes("مارزيبان")) return "عجينة سكر";
    if (n.includes("فراولة") || n.includes("توت") || n.includes("جوز") || n.includes("لوز") || n.includes("بندق") || n.includes("كرز")) return "فواكه ومكسرات";
    if (n.includes("كرتون") || n.includes("علبة") || n.includes("شريط") || n.includes("تغليف") || n.includes("قاعدة") || n.includes("بورد")) return "تغليف وزينة";
    if (n.includes("كيس حلواني") || n.includes("قفاز") || n.includes("ورق زبدة") || n.includes("نايلون")) return "مستهلكات";
    if (n.includes("قالب") || n.includes("صينية") || n.includes("رينج") || n.includes("سليكون")) return "قوالب وصواني";
    if (n.includes("سباتولا") || n.includes("سكين") || n.includes("ميزان") || n.includes("خفاقة") || n.includes("مكشطة")) return "أدوات";
    return "أخرى";
  };

  // Add Row in List Mode
  const handleAddRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: "",
        category: "طحين وسكر",
        quantity: 1,
        unit: "كغم",
        unitPrice: 0,
        place: invoiceStoreName || ""
      }
    ]);
  };

  // Update Item in List Mode
  const updateItem = (id: string, updates: Partial<InventoryEntryItem>) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, ...updates };
        if (updates.name && (!it.category || it.category === "طحين وسكر" || it.category === "أخرى")) {
          const predicted = detectCategoryFromName(updates.name);
          if (predicted) updated.category = predicted;
        }
        return updated;
      })
    );
  };

  // Remove Item
  const handleRemoveRow = async (id: string) => {
    if (items.length <= 1) {
      setItems([{
        id: `it-${Date.now()}-1`,
        name: "",
        category: "طحين وسكر",
        quantity: 1,
        unit: "كغم",
        unitPrice: 0,
        place: invoiceStoreName || ""
      }]);
      return;
    }
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Compute Total Cost
  const totalCost = React.useMemo(() => {
    if (mode === "single") {
      return (Number(singleQuantity) || 0) * (Number(singlePrice) || 0);
    }
    return items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  }, [mode, singleQuantity, singlePrice, items]);

  // Image Upload Handler
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSingleImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: false });
        setSingleImageFile(compressed);
      } catch {
        setSingleImageFile(file);
      }
    }
  };

  // Submit Logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === "single") {
      if (!singleName.trim()) {
        toast.error("يرجى إدخال اسم المادة");
        return;
      }
      const qty = Number(singleQuantity) || 0;
      if (qty <= 0) {
        toast.error("يرجى إدخال كمية صحيحة أكبر من صفر");
        return;
      }

      setSubmitting(true);
      try {
        const uPrice = Number(singlePrice) || 0;
        const matchedItem = existingInventory.find(
          i => i.name?.trim().toLowerCase() === singleName.trim().toLowerCase()
        );

        let finalImageUrl = matchedItem?.imageUrl || "";
        if (singleImageFile) {
          const fRef = ref(storage, `cake_inventory/${Date.now()}_${singleImageFile.name}`);
          await uploadBytes(fRef, singleImageFile);
          finalImageUrl = await getDownloadURL(fRef);
        }

        if (targetType === "need") {
          // Add to shortages / needs
          if (matchedItem) {
            await updateDoc(doc(db, "cake_inventory", matchedItem.id), {
              neededQuantity: increment(qty),
              price: uPrice > 0 ? uPrice : matchedItem.price || 0,
              lastUpdated: serverTimestamp()
            });
          } else {
            await addDoc(collection(db, "cake_inventory"), {
              name: singleName.trim(),
              category: singleCategory,
              quantity: 0,
              neededQuantity: qty,
              unit: singleUnit,
              price: uPrice,
              minAlert: Number(singleMinAlert) || 1,
              imageUrl: finalImageUrl,
              lastStoreName: singleStore.trim(),
              createdAt: serverTimestamp(),
              lastUpdated: serverTimestamp()
            });
          }
          toast.success(`تمت إضافة "${singleName}" إلى قائمة النواقص بنجاح ✨`);
        } else {
          // Add to available stock and log purchase
          await recordSingleCakePurchase({
            itemId: matchedItem?.id,
            itemName: singleName.trim(),
            category: singleCategory,
            quantity: qty,
            unit: singleUnit,
            unitPrice: uPrice,
            totalPrice: qty * uPrice,
            purchaseDate: invoiceDate,
            hasInvoice: false,
            storeName: singleStore.trim(),
            paymentSource: paidBy,
            splitDebtAmount: paidBy === "split" ? Number(splitDebtAmount) || 0 : 0,
            createIfNotExist: true,
            invoiceImageUrl: finalImageUrl
          });
          toast.success(`تمت إضافة "${singleName}" إلى المخزن وتوثيق الحركة بنجاح 🎉`);
        }

        onSuccess();
        onClose();
      } catch (err) {
        console.error(err);
        toast.error("حدث خطأ أثناء حفظ المادة");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Multi-Item List Mode
      const validItems = items.filter(it => it.name.trim().length > 0 && Number(it.quantity) > 0);
      if (validItems.length === 0) {
        toast.error("يرجى إدخال مادة واحدة على الأقل بالاسم والكمية");
        return;
      }

      setSubmitting(true);
      try {
        if (targetType === "need") {
          // Add list to shortages / needed items
          for (const it of validItems) {
            const matched = existingInventory.find(
              i => i.name?.trim().toLowerCase() === it.name.trim().toLowerCase()
            );
            const qty = Number(it.quantity) || 1;
            const uPrice = Number(it.unitPrice) || 0;
            if (matched) {
              await updateDoc(doc(db, "cake_inventory", matched.id), {
                neededQuantity: increment(qty),
                price: uPrice > 0 ? uPrice : matched.price || 0,
                lastUpdated: serverTimestamp()
              });
            } else {
              await addDoc(collection(db, "cake_inventory"), {
                name: it.name.trim(),
                category: it.category || "أخرى",
                quantity: 0,
                neededQuantity: qty,
                unit: it.unit || "كغم",
                price: uPrice,
                minAlert: 1,
                imageUrl: "",
                lastStoreName: it.place?.trim() || invoiceStoreName.trim(),
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
              });
            }
          }
          toast.success(`تمت إضافة ${validItems.length} مواد إلى قائمة النواقص بنجاح ✨`);
        } else {
          // Record full invoice with items
          const itemsPayload = validItems.map(it => {
            const matched = existingInventory.find(
              i => i.name?.trim().toLowerCase() === it.name.trim().toLowerCase()
            );
            const qty = Number(it.quantity) || 0;
            const uPrice = Number(it.unitPrice) || 0;
            return {
              name: it.name.trim(),
              quantity: qty,
              unit: it.unit || "كغم",
              unitPrice: uPrice,
              totalPrice: qty * uPrice,
              category: it.category || "أخرى",
              matchedInventoryId: matched?.id
            };
          });

          await recordCakeInvoiceBatch({
            storeName: invoiceStoreName.trim() || "معرض مستلزمات الكيك",
            invoiceDate,
            invoiceNumber,
            totalAmount: totalCost,
            items: itemsPayload,
            paymentSource: paidBy,
            splitDebtAmount: paidBy === "split" ? Number(splitDebtAmount) || 0 : 0
          });
          toast.success(`تم حفظ الفاتورة وإضافة ${validItems.length} مواد للمخزن بنجاح ⚡🎉`);
        }

        onSuccess();
        onClose();
      } catch (err) {
        console.error(err);
        toast.error("حدث خطأ أثناء حفظ قائمة المواد");
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div
        className="relative z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 w-full max-w-3xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-right"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        {/* Luxury Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50/80 dark:from-blue-950/40 dark:via-zinc-900 dark:to-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-gray-900 dark:text-white">
                  إضافة مواد ومشتريات للمخزن
                </h3>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30">
                  مقر القيادة المركزية
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                إدخال سريع للمواد الخام، الفواتير، ونواقص الكيك بنظام القوائم الذكية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center transition active:scale-95 border border-gray-200 dark:border-zinc-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Quick Scanner Banner */}
        <div className="px-4 pt-3 pb-1 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border-b border-amber-200/60 dark:border-amber-900/30">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📸</span>
              <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                المسح الذكي لفواتير مستلزمات الكيك:
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScanTrigger("camera");
                  setIsScanInvoiceOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs hover:opacity-95 active:scale-95 flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>كاميرا 📸</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanTrigger("gallery");
                  setIsScanInvoiceOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xs hover:opacity-95 active:scale-95 flex items-center gap-1"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>استوديو 🖼️</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanTrigger(null);
                  setIsScanInvoiceOpen(true);
                }}
                className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs active:scale-95 flex items-center gap-1"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-950" />
                <span>فاتورة كاملة 🧾</span>
              </button>
            </div>
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Target & Mode Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Target Type */}
            <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-2xl border border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setTargetType("available")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  targetType === "available"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>إضافة للمتوفر بالمخزن</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("need")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  targetType === "need"
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>إضافة لقائمة النواقص</span>
              </button>
            </div>

            {/* Entry Mode */}
            <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-2xl border border-gray-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  mode === "list"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>قائمة مواد متعددة ({items.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  mode === "single"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>مادة مفردة سريعة</span>
              </button>
            </div>
          </div>

          {/* Store / Supplier Name (Suggestions ONLY when typing >= 1 character) */}
          <div className="bg-gray-50/80 dark:bg-zinc-800/50 p-3 rounded-2xl border border-gray-200 dark:border-zinc-700 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Store Name Input */}
              <div className="sm:col-span-2 relative">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-blue-500" />
                  <span>المحل / المورد (اقتراحات عند كتابة الحرف الأول)</span>
                </label>
                <input
                  type="text"
                  list={(mode === "single" ? singleStore : invoiceStoreName).trim().length >= 1 ? "cake-store-datalist" : undefined}
                  placeholder="مثال: مستلزمات الشورجة، معرض الحلواني..."
                  value={mode === "single" ? singleStore : invoiceStoreName}
                  onChange={e => {
                    const val = e.target.value;
                    if (mode === "single") setSingleStore(val);
                    else setInvoiceStoreName(val);
                    if (val.trim().length >= 1) setIsStoreFocused(true);
                    else setIsStoreFocused(false);
                  }}
                  onFocus={() => {
                    const val = mode === "single" ? singleStore : invoiceStoreName;
                    if (val.trim().length >= 1) setIsStoreFocused(true);
                    else setIsStoreFocused(false);
                  }}
                  onBlur={() => setTimeout(() => setIsStoreFocused(false), 250)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />

                {/* Suggestions Datalist (Only populated when length >= 1) */}
                {(mode === "single" ? singleStore : invoiceStoreName).trim().length >= 1 && (
                  <datalist id="cake-store-datalist">
                    {uniqueStoreNames
                      .filter(s => s.toLowerCase().includes((mode === "single" ? singleStore : invoiceStoreName).toLowerCase().trim()))
                      .map((s, idx) => (
                        <option key={idx} value={s} />
                      ))}
                  </datalist>
                )}

                {/* Custom Floating Store Suggestions (Only when typing >= 1 character) */}
                {isStoreFocused && (mode === "single" ? singleStore : invoiceStoreName).trim().length >= 1 && (() => {
                  const query = (mode === "single" ? singleStore : invoiceStoreName).trim().toLowerCase();
                  const matched = uniqueStoreNames.filter(s => s.toLowerCase().includes(query)).slice(0, 8);
                  if (matched.length === 0) return null;
                  return (
                    <div className="absolute z-30 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[9px] font-black text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                        <span>🔍 محلات وموردين سابقين مطابقة:</span>
                      </div>
                      {matched.map((sName, sIdx) => (
                        <div
                          key={sIdx}
                          onMouseDown={e => {
                            e.preventDefault();
                            if (mode === "single") setSingleStore(sName);
                            else setInvoiceStoreName(sName);
                            setIsStoreFocused(false);
                          }}
                          className="px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-zinc-700 cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5"
                        >
                          <span>🏪</span>
                          <span>{sName}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Invoice Date */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>تاريخ الشراء / الفاتورة</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* ═════════ MODE 1: MULTI-ITEM LIST (LIKE HOME FINANCE EXPENSES) ═════════ */}
          {mode === "list" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-500" />
                  <span>قائمة المواد المراد إضافتها ({items.length} مادة):</span>
                </span>
                <div className="flex items-center gap-2">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (await customConfirm("هل تريد مسح جميع المواد من القائمة؟")) {
                          setItems([{
                            id: `it-${Date.now()}-1`,
                            name: "",
                            category: "طحين وسكر",
                            quantity: 1,
                            unit: "كغم",
                            unitPrice: 0,
                            place: invoiceStoreName || ""
                          }]);
                        }
                      }}
                      className="text-[11px] text-red-500 font-bold hover:underline"
                    >
                      مسح الكل
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ مادة أخرى</span>
                  </button>
                </div>
              </div>

              {/* Items List Rows */}
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const itTotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                  return (
                    <div
                      key={it.id}
                      className="bg-gray-50 dark:bg-zinc-800/80 p-2.5 sm:p-3 rounded-2xl border border-gray-200 dark:border-zinc-700/80 space-y-2 transition hover:border-indigo-300 dark:hover:border-indigo-600"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        {/* Index & Name */}
                        <div className="sm:col-span-4 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="اسم مادة الكيك (طحين، كريمة، نوتيلا...)"
                            value={it.name}
                            onChange={e => updateItem(it.id, { name: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                          />
                        </div>

                        {/* Category */}
                        <div className="sm:col-span-3">
                          <select
                            value={it.category}
                            onChange={e => updateItem(it.id, { category: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                          >
                            {CAKE_INVENTORY_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>
                                {CAT_ICONS[cat] || "📦"} {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity & Unit */}
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            placeholder="الكمية"
                            value={it.quantity || ""}
                            onChange={e => updateItem(it.id, { quantity: Number(e.target.value) })}
                            className="w-16 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-1.5 py-1.5 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <select
                            value={it.unit}
                            onChange={e => updateItem(it.id, { unit: e.target.value })}
                            className="w-14 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-1 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {CAKE_INVENTORY_UNITS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2">
                          <input
                            type="number"
                            placeholder="السعر المفرد"
                            value={it.unitPrice || ""}
                            onChange={e => updateItem(it.id, { unitPrice: Number(e.target.value) })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-1.5 text-xs font-bold text-left outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        {/* Row Total & Delete */}
                        <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-1.5">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 sm:hidden">
                            المجموع: {itTotal.toLocaleString()} د.ع
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(it.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-700 transition"
                            title="حذف المادة من القائمة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Store for individual item if different */}
                      <div className="flex flex-wrap items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-200/50 dark:border-zinc-700/50">
                        <div className="flex items-center gap-1.5">
                          <span>المحل:</span>
                          <input
                            type="text"
                            placeholder={invoiceStoreName || "المحل/المورد"}
                            value={it.place || ""}
                            onChange={e => updateItem(it.id, { place: e.target.value })}
                            className="bg-transparent border-b border-dashed border-gray-300 dark:border-zinc-600 text-[10px] font-bold outline-none px-1"
                          />
                        </div>
                        <div className="font-black text-gray-700 dark:text-gray-300">
                          الإجمالي: <span className="text-emerald-600 dark:text-emerald-400">{itTotal.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add More Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-2.5 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مادة أخرى للقائمة</span>
              </button>
            </div>
          )}

          {/* ═════════ MODE 2: SINGLE ITEM QUICK ENTRY ═════════ */}
          {mode === "single" && (
            <div className="space-y-3 bg-gray-50/60 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-200 dark:border-zinc-700">
              <div className="flex gap-3">
                {/* Photo Upload Box */}
                <div
                  onClick={() => singleFileRef.current?.click()}
                  className="w-24 h-24 shrink-0 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition relative overflow-hidden"
                >
                  {singleImagePreview ? (
                    <img src={singleImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-1">
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <span className="text-[9px] text-gray-500 font-bold block">إرفاق صورة</span>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={singleFileRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </div>

                {/* Name & Category */}
                <div className="flex-1 space-y-2.5">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                      اسم المادة الخام
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: طحين الصفر، كريمة شانتيه، نوتيلا..."
                      value={singleName}
                      onChange={e => {
                        const val = e.target.value;
                        setSingleName(val);
                        const pred = detectCategoryFromName(val);
                        if (pred) setSingleCategory(pred);
                      }}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                      التصنيف
                    </label>
                    <select
                      value={singleCategory}
                      onChange={e => setSingleCategory(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    >
                      {CAKE_INVENTORY_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {CAT_ICONS[cat] || "📦"} {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quantity, Unit & Unit Price */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                    الكمية
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={singleQuantity}
                    onChange={e => setSingleQuantity(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                    الوحدة
                  </label>
                  <select
                    value={singleUnit}
                    onChange={e => setSingleUnit(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CAKE_INVENTORY_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                    سعر المفرد (د.ع)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={singlePrice}
                    onChange={e => setSinglePrice(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-left outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Min Alert (for in-stock) */}
              {targetType === "available" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                      تنبيه النقص عندما يقل عن:
                    </label>
                    <input
                      type="number"
                      value={singleMinAlert}
                      onChange={e => setSingleMinAlert(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      القيمة الإجمالية: {totalCost.toLocaleString()} د.ع
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Source (When adding to available stock) */}
          {targetType === "available" && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-gray-200 dark:border-zinc-700 space-y-2">
              <label className="text-xs font-black text-gray-800 dark:text-white block">
                طريقة ومصدر تسديد المبلغ (توثيق الحسابات):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaidBy("cake")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black border transition ${
                    paidBy === "cake"
                      ? "bg-pink-600 text-white border-pink-600 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-pink-400"
                  }`}
                >
                  🎂 أموال الكيك
                </button>
                <button
                  type="button"
                  onClick={() => setPaidBy("salary")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black border transition ${
                    paidBy === "salary"
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-orange-400"
                  }`}
                >
                  👤 دين من الراتب
                </button>
                <button
                  type="button"
                  onClick={() => setPaidBy("split")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black border transition ${
                    paidBy === "split"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-blue-400"
                  }`}
                >
                  ✂️ مقسم
                </button>
                <button
                  type="button"
                  onClick={() => setPaidBy("none")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-black border transition ${
                    paidBy === "none"
                      ? "bg-gray-600 text-white border-gray-600 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:border-gray-400"
                  }`}
                >
                  بدون مصروف (جرد)
                </button>
              </div>

              {paidBy === "split" && (
                <div className="pt-2 animate-in fade-in">
                  <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1 block">
                    المبلغ الذي تم دفعه من الراتب (دين مستحق الاسترداد):
                  </label>
                  <input
                    type="number"
                    placeholder="أدخل مبلغ الدين د.ع"
                    value={splitDebtAmount}
                    onChange={e => setSplitDebtAmount(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-blue-300 dark:border-blue-700 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Running Subtotal Bar */}
          <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-500 font-bold block">إجمالي تكلفة المواد:</span>
              <span className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300">
                {totalCost.toLocaleString()} <span className="text-xs font-normal">د.ع</span>
              </span>
            </div>
            <div className="text-left">
              <span className="text-[10px] text-gray-500 font-bold block">العدد الإجمالي:</span>
              <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                {mode === "single" ? "1 مادة" : `${items.filter(it => it.name.trim()).length} مادة`}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition ${
              targetType === "need"
                ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 shadow-orange-500/25"
                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-700 shadow-indigo-600/25"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري الحفظ والمزامنة...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>
                  {targetType === "need"
                    ? "إضافة إلى قائمة النواقص"
                    : mode === "list"
                    ? `حفظ وتوثيق الفاتورة بالمخزن (${totalCost.toLocaleString()} د.ع)`
                    : "حفظ المادة في المخزن"}
                </span>
              </>
            )}
          </button>
        </form>

        {/* AI Scanner Modal Integration */}
        <ScanCakeInvoiceModal
          isOpen={isScanInvoiceOpen}
          onClose={() => {
            setIsScanInvoiceOpen(false);
            setScanTrigger(null);
          }}
          onSuccess={() => {
            setIsScanInvoiceOpen(false);
            setScanTrigger(null);
            toast.success("تم مسح الفاتورة وإدراجها بنجاح 🎉");
            onSuccess();
            onClose();
          }}
          inventoryItems={existingInventory}
          autoTrigger={scanTrigger}
        />
      </div>
    </div>
  );
}
