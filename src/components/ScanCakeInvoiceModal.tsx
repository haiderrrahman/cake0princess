"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Upload,
  Receipt,
  Check,
  X,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Calendar,
  Store,
  DollarSign,
  AlertCircle,
  Tag
} from "lucide-react";
import { toast } from "sonner";
import {
  scanCakeInvoiceWithGemini,
  ScannedCakeItem,
  CAKE_INVENTORY_CATEGORIES,
  CAKE_INVENTORY_UNITS
} from "@/lib/scanCakeInvoiceClient";
import {
  recordCakeInvoiceBatch,
  normalizeArabicText
} from "@/lib/cakeMaterialPurchases";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScanCakeInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: any[];
  onSuccess: () => void;
}

export default function ScanCakeInvoiceModal({
  isOpen,
  onClose,
  inventoryItems,
  onSuccess
}: ScanCakeInvoiceModalProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Scanned / Review State
  const [hasScanned, setHasScanned] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<ScannedCakeItem[]>([]);
  const [paymentSource, setPaymentSource] = useState<"none" | "cake" | "salary" | "split">("cake");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes & load store suggestions
  useEffect(() => {
    if (!isOpen) {
      setSelectedImages([]);
      setPreviewUrls([]);
      setIsScanning(false);
      setScanStatus("");
      setHasScanned(false);
      setItems([]);
      setStoreName("");
      setInvoiceDate("");
      setInvoiceNumber("");
      setPaymentSource("cake");
      setSplitDebtAmount("");
    } else {
      setInvoiceDate(new Date().toISOString().split("T")[0]);
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

  if (!isOpen) return null;

  // Fast client-side image compression for Gemini AI
  const compressImage = (file: File, maxDim = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    setSelectedImages(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);

    // Auto-trigger scan
    await startScan(files);
  };

  const startScan = async (files: File[]) => {
    try {
      setIsScanning(true);
      setScanStatus("جاري تجهيز صورة الفاتورة بدقة عالية...");

      const base64List = await Promise.all(files.map((f) => compressImage(f, 1300, 0.82)));

      const extracted = await scanCakeInvoiceWithGemini(base64List, (status) => {
        setScanStatus(status);
      });

      setStoreName(extracted.storeName || "معرض مستلزمات الكيك");
      setInvoiceDate(extracted.date || new Date().toISOString().split("T")[0]);
      setInvoiceNumber(extracted.invoiceNumber || "");

      // Match extracted items with existing inventory
      const matched = extracted.items.map((item) => {
        const normName = normalizeArabicText(item.name);
        const directMatch = inventoryItems.find((inv) => {
          const invNorm = normalizeArabicText(inv.name);
          return invNorm === normName || invNorm.includes(normName) || normName.includes(invNorm);
        });

        if (directMatch) {
          return {
            ...item,
            matchedInventoryId: directMatch.id,
            matchedInventoryName: directMatch.name,
            category: directMatch.category || item.category,
            unit: directMatch.unit || item.unit,
            isNewItem: false
          };
        }

        return {
          ...item,
          matchedInventoryId: undefined,
          isNewItem: true
        };
      });

      setItems(matched);
      setHasScanned(true);
      toast.success(`✨ تم استخراج ${matched.length} مادة من الفاتورة بنجاح!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "حدث خطأ أثناء مسح الفاتورة");
    } finally {
      setIsScanning(false);
      setScanStatus("");
    }
  };

  const handleUpdateItem = (index: number, updates: Partial<ScannedCakeItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], ...updates };
      if ("quantity" in updates || "unitPrice" in updates) {
        target.totalPrice = Math.round(Number(target.quantity || 0) * Number(target.unitPrice || 0));
      } else if ("totalPrice" in updates) {
        const qty = Number(target.quantity) || 1;
        target.unitPrice = qty > 0 ? Math.round(Number(target.totalPrice || 0) / qty) : 0;
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-cake-${Date.now()}`,
        name: "",
        quantity: 1,
        unit: "كغم",
        unitPrice: 0,
        totalPrice: 0,
        category: "طحين وسكر",
        isNewItem: true
      }
    ]);
  };

  const totalCalculated = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("لا توجد مواد في الفاتورة لحفظها");
      return;
    }

    const invalid = items.find((i) => !i.name.trim() || Number(i.quantity) <= 0);
    if (invalid) {
      toast.error("يرجى التأكد من اسم وكمية كل مادة");
      return;
    }

    setSubmitting(true);
    try {
      // User requested: Do NOT attach or upload invoice image, only take its data
      await recordCakeInvoiceBatch({
        storeName: storeName.trim() || "معرض مستلزمات الكيك",
        invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
        invoiceNumber: invoiceNumber.trim(),
        totalAmount: totalCalculated,
        imageUrl: "", // Data only, no invoice image stored
        paymentSource,
        splitDebtAmount: paymentSource === "split" ? Number(splitDebtAmount) || 0 : 0,
        items: items.map((i) => ({
          name: i.name.trim(),
          quantity: Number(i.quantity),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          category: i.category,
          matchedInventoryId: i.matchedInventoryId,
          isNewItem: i.isNewItem
        }))
      });

      toast.success("✅ تم حفظ الفاتورة وتحديث كميات المخزن وتاريخ الشراء بنجاح!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving invoice:", err);
      toast.error("حدث خطأ أثناء حفظ الفاتورة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 border-0 sm:border border-gray-100 dark:border-zinc-800 sm:rounded-3xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden shadow-2xl flex flex-col my-auto animate-fade-in">
        {/* Header (Always pinned at top) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Camera className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                مسح وتصوير فاتورة مواد الكيك
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                  ذكاء اصطناعي ⚡
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                قراءة أسماء المواد، الكميات، الأسعار، وتسجيلها بالمخزن وسجل الشراء تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Flow */}
        {!hasScanned ? (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0">
            {/* Scanning Progress Banner */}
            {isScanning && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-6 text-center space-y-3">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <p className="font-black text-sm text-blue-900 dark:text-blue-200">
                  {scanStatus || "جاري استخراج بيانات الفاتورة بالذكاء الاصطناعي..."}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  نقوم بقراءة الأسماء، الكميات، أسعار المفرد والإجمالي ومطابقتها مع مواد المخزن
                </p>
              </div>
            )}

            {/* Initial Upload Area */}
            {!isScanning && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-blue-300 dark:border-blue-800/60 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition flex flex-col items-center justify-center gap-3 text-center group active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-blue-950 dark:text-blue-100">
                        التقاط صورة بكاميرا الهاتف 📸
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        صوّر الفاتورة أو القائمة مباشرة وواضحة
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800 transition flex flex-col items-center justify-center gap-3 text-center group active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gray-700 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-gray-800 dark:text-gray-100">
                        رفع صورة من المعرض أو الجهاز 🖼️
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        اختر ملف صورة للفاتورة أو الوصل
                      </p>
                    </div>
                  </button>
                </div>

                {/* Hidden file inputs */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
                />

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                  <div className="text-xs leading-relaxed space-y-1">
                    <p className="font-bold">نصائح للحصول على أدق قراءة:</p>
                    <ul className="list-disc pr-4 space-y-0.5 text-amber-700 dark:text-amber-300">
                      <li>تأكد من وضوح الإضاءة وعدم وجود ظل يحجب الأسعار أو المواد.</li>
                      <li>المواد المسجلة ستتم مطابقتها تلقائياً مع مواد المخزن وتحديث كمياتها.</li>
                      <li>تُستخرج البيانات رقمياً فقط دون تخزين أو رفع صورة الفاتورة.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scanned Result Review Scrollable Area */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0 pb-6">
              {/* Photo preview pill & re-scan button */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  {previewUrls[0] && (
                    <img
                      src={previewUrls[0]}
                      alt="Receipt"
                      className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-zinc-700 cursor-pointer"
                      onClick={() => window.open(previewUrls[0], "_blank")}
                    />
                  )}
                  <div>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                      صورة الفاتورة الأصلية
                    </span>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      تؤخذ البيانات فقط (لن يتم حفظ صورة الفاتورة)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition"
                >
                  <Camera className="w-3.5 h-3.5" /> إعادة التصوير
                </button>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> اسم المحل / المتجر
                    </span>
                    <span className="text-[10px] text-blue-500 font-normal">اقتراح ذكي 💡</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="scan-purchase-store-suggestions"
                      required
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="مثال: معرض البركة"
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                    />
                    <datalist id="scan-purchase-store-suggestions">
                      {storeSuggestions.map((st, idx) => (
                        <option key={idx} value={st} />
                      ))}
                    </datalist>
                  </div>
                  {storeSuggestions.length > 0 && !storeName && (
                    <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                      {storeSuggestions.slice(0, 4).map((st, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setStoreName(st)}
                          className="text-[9px] bg-gray-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-950/40 text-gray-700 dark:text-gray-300 hover:text-blue-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 transition"
                        >
                          🏬 {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> تاريخ الشراء والفاتورة
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> رقم الفاتورة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="إن وجد"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <span>قائمة المواد المستخرجة ({items.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition"
                  >
                    <Plus className="w-3 h-3" /> إضافة مادة
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700/80 rounded-2xl p-3 space-y-2 relative group"
                    >
                      {/* Top Row: Name + Match Status + Delete */}
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                          placeholder="اسم المادة"
                          className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm font-black focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-gray-400 hover:text-red-500 transition p-1"
                          title="حذف المادة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Matching with inventory indicator & dropdown */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500 font-bold">ربط بالمخزن:</span>
                        <select
                          value={item.matchedInventoryId || "new"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "new") {
                              handleUpdateItem(idx, {
                                matchedInventoryId: undefined,
                                matchedInventoryName: undefined,
                                isNewItem: true
                              });
                            } else {
                              const found = inventoryItems.find((inv) => inv.id === val);
                              handleUpdateItem(idx, {
                                matchedInventoryId: val,
                                matchedInventoryName: found?.name,
                                category: found?.category || item.category,
                                unit: found?.unit || item.unit,
                                isNewItem: false
                              });
                            }
                          }}
                          className={`rounded-lg px-2 py-1 text-xs font-bold border focus:outline-none ${
                            item.matchedInventoryId
                              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                              : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300"
                          }`}
                        >
                          <option value="new">✨ مادة جديدة (ستُضاف للمخزن)</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              📦 {inv.name} (متوفر: {inv.quantity} {inv.unit})
                            </option>
                          ))}
                        </select>

                        {/* Category Selector */}
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(idx, { category: e.target.value })}
                          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 dark:text-gray-300"
                        >
                          {CAKE_INVENTORY_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bottom Row: Quantity, Unit, Price, Total */}
                      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-gray-100 dark:border-zinc-700/50">
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">الكمية</label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            required
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, { quantity: Number(e.target.value) })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">الوحدة</label>
                          <select
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(idx, { unit: e.target.value })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-center"
                          >
                            {CAKE_INVENTORY_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">المفرد (د.ع)</label>
                          <input
                            type="number"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(idx, { unitPrice: Number(e.target.value) })}
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-center"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">الإجمالي (د.ع)</label>
                          <input
                            type="number"
                            step="any"
                            value={item.totalPrice}
                            onChange={(e) => handleUpdateItem(idx, { totalPrice: Number(e.target.value) })}
                            className="w-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1 text-xs font-black text-center text-blue-700 dark:text-blue-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Payment Source */}
              <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-3">
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
                    مجموع الفاتورة الكلي:
                  </span>
                  <span className="text-xl font-black text-blue-950 dark:text-white">
                    {totalCalculated.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-500">د.ع</span>
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">
                    مصدر الدفع (تسجيل في المصروفات المالية):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentSource("cake")}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition ${
                        paymentSource === "cake"
                          ? "bg-pink-600 text-white border-pink-600 shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                      }`}
                    >
                      🎂 أموال الكيك
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentSource("salary")}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition ${
                        paymentSource === "salary"
                          ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                      }`}
                    >
                      👤 دين من الراتب
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentSource("split")}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition ${
                        paymentSource === "split"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                      }`}
                    >
                      ✂️ مقسم
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentSource("none")}
                      className={`py-2 px-2 rounded-xl font-black text-xs border transition ${
                        paymentSource === "none"
                          ? "bg-gray-700 text-white border-gray-700 shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700"
                      }`}
                    >
                      بدون تسجيل مصروف
                    </button>
                  </div>

                  {paymentSource === "split" && (
                    <div className="mt-3 animate-fade-in">
                      <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 block">
                        المبلغ المسدد من الراتب (دين على الكيك)
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={splitDebtAmount}
                        onChange={(e) => setSplitDebtAmount(e.target.value)}
                        placeholder="أدخل مبلغ الدين"
                        className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Sticky Actions Bar: Always pinned at the bottom of the modal, never cut off or covered */}
            <div className="shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 p-3 sm:p-4 flex items-center gap-3 z-30 shadow-[0_-8px_25px_rgba(0,0,0,0.12)]">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري حفظ الفاتورة وتحديث المخزن...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>تأكيد وحفظ الفاتورة وتحديث المخزن</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition shrink-0"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
