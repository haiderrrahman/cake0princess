"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  Store,
  Calendar,
  Receipt,
  Loader2,
  Trash2,
  Plus,
  AlertCircle,
  Banknote,
  DollarSign,
  Camera,
  Upload,
  Eye,
  Image as ImageIcon
} from "lucide-react";
import { collection, getDocs, updateDoc, deleteDoc, addDoc, doc, query, where, limit, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { CakeMaterialPurchase } from "@/lib/cakeMaterialPurchases";
import { uploadImageResiliently } from "@/lib/hfImageStore";

interface EditCakeInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceId?: string;
    invoiceNumber?: string;
    storeName: string;
    date: string;
    hasInvoice?: boolean;
    paymentSource?: "none" | "cake" | "salary" | "split";
    splitDebtAmount?: number;
    totalAmount: number;
    imageUrl?: string;
    items: CakeMaterialPurchase[];
  } | null;
  onSuccess: () => void;
}

export default function EditCakeInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onSuccess
}: EditCakeInvoiceModalProps) {
  const [storeName, setStoreName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");
  const [paymentSource, setPaymentSource] = useState<"none" | "cake" | "salary" | "split">("cake");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [items, setItems] = useState<CakeMaterialPurchase[]>([]);
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (invoice && isOpen) {
      setStoreName(invoice.storeName || "");
      setInvoiceNumber(invoice.invoiceNumber || "");
      setDate(invoice.date || new Date().toISOString().split("T")[0]);
      setPaymentSource(invoice.paymentSource || "cake");
      setSplitDebtAmount(invoice.splitDebtAmount ? String(invoice.splitDebtAmount) : "");
      setItems(invoice.items ? JSON.parse(JSON.stringify(invoice.items)) : []);
      setImageUrl(invoice.imageUrl || invoice.items?.[0]?.invoiceImageUrl || "");

      // Load store suggestions
      const fetchStores = async () => {
        try {
          const qSnap = await getDocs(query(collection(db, "cake_material_purchases"), limit(120)));
          const setNames = new Set<string>();
          qSnap.docs.forEach((d) => {
            const s = d.data().storeName;
            if (s && typeof s === "string" && s.trim()) setNames.add(s.trim());
          });
          setStoreSuggestions(Array.from(setNames));
        } catch (e) {
          console.warn("Could not load store suggestions:", e);
        }
      };
      fetchStores();
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  // Calculate current dynamic total from items
  const currentTotal = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);

  const handleItemChange = (index: number, field: keyof CakeMaterialPurchase, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const cur = { ...copy[index], [field]: value };

      if (field === "quantity" || field === "unitPrice") {
        const q = Number(field === "quantity" ? value : cur.quantity) || 0;
        const u = Number(field === "unitPrice" ? value : cur.unitPrice) || 0;
        cur.totalPrice = Math.round(q * u);
      } else if (field === "totalPrice") {
        const t = Number(value) || 0;
        const q = Number(cur.quantity) || 1;
        if (q > 0) cur.unitPrice = Math.round(t / q);
      }
      copy[index] = cur;
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("لا يمكن حذف جميع المواد. لحذف الفاتورة بالكامل استخدم زر الحذف الأحمر في البطاقة.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const toastId = toast.loading("جاري رفع صورة الوصل وحفظها بأمان...");
    try {
      const url = await uploadImageResiliently("receipts", `edit_${Date.now()}`, file);
      setImageUrl(url);
      toast.success("تم إرفاق صورة الوصل بنجاح 📸", { id: toastId });
    } catch (err) {
      toast.error("فشل رفع صورة الوصل", { id: toastId });
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      toast.error("يرجى إدخال اسم المحل أو المتجر");
      return;
    }

    setSubmitting(true);
    try {
      const debtAmountNum = paymentSource === "split" ? Number(splitDebtAmount) || 0 : 0;
      const effectiveTotal = currentTotal > 0 ? currentTotal : invoice.totalAmount;

      // 1. Update all items in cake_material_purchases
      for (const item of items) {
        if (item.id) {
          await updateDoc(doc(db, "cake_material_purchases", item.id), {
            storeName: storeName.trim(),
            invoiceNumber: invoiceNumber.trim(),
            purchaseDate: date,
            paymentSource,
            splitDebtAmount: debtAmountNum,
            invoiceImageUrl: imageUrl || "",
            itemName: item.itemName,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0,
            lastUpdated: serverTimestamp()
          });
        }
      }

      // Check if any items were removed from this invoice
      const remainingIds = new Set(items.map((i) => i.id).filter(Boolean));
      for (const origItem of invoice.items) {
        if (origItem.id && !remainingIds.has(origItem.id)) {
          await deleteDoc(doc(db, "cake_material_purchases", origItem.id));
        }
      }

      // 2. Update cake_invoices doc if exists
      if (invoice.invoiceId) {
        try {
          await updateDoc(doc(db, "cake_invoices", invoice.invoiceId), {
            storeName: storeName.trim(),
            invoiceNumber: invoiceNumber.trim(),
            date,
            paymentSource,
            splitDebtAmount: debtAmountNum,
            imageUrl: imageUrl || "",
            totalAmount: effectiveTotal,
            lastUpdated: serverTimestamp()
          });
        } catch (e) {
          console.warn("cake_invoices update notice:", e);
        }
      }

      // 3. Sync or Revert Expenses in `expenses` collection
      // Find all expenses related to this invoice (by invoiceId or purchaseId)
      const linkedExpenseDocs: any[] = [];
      if (invoice.invoiceId) {
        const qExp = await getDocs(query(collection(db, "expenses"), where("invoiceId", "==", invoice.invoiceId)));
        qExp.docs.forEach((d) => linkedExpenseDocs.push({ id: d.id, ...d.data() }));
      }
      for (const origItem of invoice.items) {
        if (origItem.id) {
          const qP = await getDocs(query(collection(db, "expenses"), where("purchaseId", "==", origItem.id)));
          qP.docs.forEach((d) => {
            if (!linkedExpenseDocs.some((x) => x.id === d.id)) {
              linkedExpenseDocs.push({ id: d.id, ...d.data() });
            }
          });
        }
      }

      const pDate = new Date(date);
      const month = !isNaN(pDate.getTime()) ? pDate.getMonth() + 1 : new Date().getMonth() + 1;
      const itemsSummary = items.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).slice(0, 3).join("، ") + (items.length > 3 ? "..." : "");

      if (paymentSource === "none") {
        // 🔥 WIPE ALL EXPENSES! Zero cash spent from cake money and zero debt registered.
        for (const exp of linkedExpenseDocs) {
          await deleteDoc(doc(db, "expenses", exp.id));
        }
        toast.success(`✅ تم تعيين الفاتورة (بدون تسجيل مصروف)، وحذف أي خصم مالي من أموال الكيك أو الراتب بنجاح!`);
      } else if (paymentSource === "cake") {
        // Delete any extra debt expenses
        for (const exp of linkedExpenseDocs) {
          await deleteDoc(doc(db, "expenses", exp.id));
        }
        // Add single clear expense from cake money
        await addDoc(collection(db, "expenses"), {
          title: `فاتورة: ${storeName.trim()}`,
          amount: effectiveTotal,
          category: "مشتريات مخزنية",
          description: `فاتورة مواد كيك: ${storeName.trim()} [${items.length} مواد: ${itemsSummary}] (أموال الكيك)`,
          month,
          date,
          invoiceId: invoice.invoiceId || invoice.id,
          invoiceNumber: invoiceNumber.trim(),
          storeName: storeName.trim(),
          itemCount: items.length,
          imageUrl: imageUrl || "",
          receiptImages: imageUrl ? [imageUrl] : [],
          isInventoryExpense: true,
          createdAt: serverTimestamp(),
          isDebt: false
        });
        toast.success("✅ تم تحديث الفاتورة وصرفها من أموال الكيك");
      } else if (paymentSource === "salary") {
        // Delete existing and set as Salary Debt
        for (const exp of linkedExpenseDocs) {
          await deleteDoc(doc(db, "expenses", exp.id));
        }
        await addDoc(collection(db, "expenses"), {
          title: `فاتورة: ${storeName.trim()} (دين راتب)`,
          amount: effectiveTotal,
          category: "مشتريات مخزنية",
          description: `فاتورة مواد كيك: ${storeName.trim()} [${items.length} مواد: ${itemsSummary}] (دين من الراتب)`,
          month,
          date,
          invoiceId: invoice.invoiceId || invoice.id,
          invoiceNumber: invoiceNumber.trim(),
          storeName: storeName.trim(),
          itemCount: items.length,
          imageUrl: imageUrl || "",
          receiptImages: imageUrl ? [imageUrl] : [],
          isInventoryExpense: true,
          createdAt: serverTimestamp(),
          isDebt: true
        });
        toast.success("✅ تم تسجيل الفاتورة كدين مستحق للراتب");
      } else if (paymentSource === "split") {
        for (const exp of linkedExpenseDocs) {
          await deleteDoc(doc(db, "expenses", exp.id));
        }
        const cakeAmt = Math.max(0, effectiveTotal - debtAmountNum);
        if (debtAmountNum > 0) {
          await addDoc(collection(db, "expenses"), {
            title: `فاتورة: ${storeName.trim()} (دين راتب)`,
            amount: debtAmountNum,
            category: "مشتريات مخزنية",
            description: `فاتورة مواد كيك: ${storeName.trim()} [دين من الراتب]`,
            month,
            date,
            invoiceId: invoice.invoiceId || invoice.id,
            invoiceNumber: invoiceNumber.trim(),
            storeName: storeName.trim(),
            itemCount: items.length,
            imageUrl: imageUrl || "",
            receiptImages: imageUrl ? [imageUrl] : [],
            isInventoryExpense: true,
            createdAt: serverTimestamp(),
            isDebt: true
          });
        }
        if (cakeAmt > 0) {
          await addDoc(collection(db, "expenses"), {
            title: `فاتورة: ${storeName.trim()} (أموال الكيك)`,
            amount: cakeAmt,
            category: "مشتريات مخزنية",
            description: `فاتورة مواد كيك: ${storeName.trim()} [أموال الكيك]`,
            month,
            date,
            invoiceId: invoice.invoiceId || invoice.id,
            invoiceNumber: invoiceNumber.trim(),
            storeName: storeName.trim(),
            itemCount: items.length,
            imageUrl: imageUrl || "",
            receiptImages: imageUrl ? [imageUrl] : [],
            isInventoryExpense: true,
            createdAt: serverTimestamp(),
            isDebt: false
          });
        }
        toast.success("✅ تم تحديث الفاتورة وتقسيمها بين أموال الكيك ودين الراتب");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error editing invoice:", err);
      toast.error("حدث خطأ أثناء تعديل الفاتورة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[260] flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[28px] sm:rounded-3xl w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header - Fixed & Pinned */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white flex items-center justify-between border-b border-purple-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Receipt className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">تعديل الفاتورة ومصدر الصرف 📑</h3>
              <p className="text-xs text-purple-200/80">
                تعديل اسم المحل، تاريخ الفاتورة، أو إلغاء خصم المبلغ من أموال الكيك
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

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {/* Payment Source Switcher - Prominent Box */}
            <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  مصدر الدفع والخصم المالي:
                </label>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-300">
                  {paymentSource === "none"
                    ? "🚫 مخزن فقط (بدون صرف)"
                    : paymentSource === "cake"
                    ? "🎂 من أموال الكيك"
                    : paymentSource === "salary"
                    ? "👤 دين من الراتب"
                    : "🔀 مقسم"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource("none")}
                  className={`p-2.5 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 border transition ${
                    paymentSource === "none"
                      ? "bg-gray-800 text-white border-gray-800 shadow-md ring-2 ring-gray-400/40"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm">🚫</span>
                  <span className="text-center leading-tight">بدون تسجيل مصروف</span>
                  <span className="text-[9px] opacity-75 font-normal">(مخزن فقط)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("cake")}
                  className={`p-2.5 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 border transition ${
                    paymentSource === "cake"
                      ? "bg-pink-600 text-white border-pink-600 shadow-md ring-2 ring-pink-400/40"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm">🎂</span>
                  <span className="text-center leading-tight">أموال الكيك</span>
                  <span className="text-[9px] opacity-75 font-normal">(خصم من الصندوق)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("salary")}
                  className={`p-2.5 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 border transition ${
                    paymentSource === "salary"
                      ? "bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-400/40"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm">👤</span>
                  <span className="text-center leading-tight">دين من الراتب</span>
                  <span className="text-[9px] opacity-75 font-normal">(مستحق لك)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource("split")}
                  className={`p-2.5 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 border transition ${
                    paymentSource === "split"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/40"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm">✂️</span>
                  <span className="text-center leading-tight">مقسم</span>
                  <span className="text-[9px] opacity-75 font-normal">(جزء كيك وجزء دين)</span>
                </button>
              </div>

              {paymentSource === "none" && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-fade-in">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    ممتاز! سيتم تسجيل مواد الفاتورة وتواريخها في المخزن، مع حذف أي خصم مالي من أموال الكيك أو الراتب.
                  </span>
                </div>
              )}

              {paymentSource === "split" && (
                <div className="mt-2 animate-fade-in">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">
                    المبلغ المسدد من الراتب (دين مستحق):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={splitDebtAmount}
                    onChange={(e) => setSplitDebtAmount(e.target.value)}
                    placeholder="أدخل مبلغ الدين"
                    className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Attached Receipt Photo Section */}
            <div className="bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-gray-200 dark:border-zinc-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-500" />
                  صورة الوصل / الفاتورة (مرفق)
                </label>
                {imageUrl && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                    تم إرفاق صورة ✔
                  </span>
                )}
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFilePicked}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFilePicked}
                className="hidden"
              />

              {imageUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700">
                  <div 
                    onClick={() => setIsPhotoZoomed(true)}
                    className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 cursor-pointer group shrink-0"
                  >
                    <img src={imageUrl} alt="صورة الفاتورة" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">صورة الوصل محفوظة</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">انقر على المصغّر لتكبير الصورة</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsPhotoZoomed(true)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> تكبير
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> تغيير الصورة
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> حذف الصورة
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="flex-1 py-2 px-3 bg-white dark:bg-zinc-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-blue-500" />}
                    <span>التقاط بالكاميرا</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="flex-1 py-2 px-3 bg-white dark:bg-zinc-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    {isUploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-purple-500" />}
                    <span>اختيار من الاستوديو</span>
                  </button>
                </div>
              )}
            </div>

            {/* Store & Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-gray-400" /> اسم المحل / المورد
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">اقتراح تلقائي 💡</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="edit-invoice-store-suggestions"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="اسم المحل أو المعرض..."
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-purple-500 focus:outline-none"
                  />
                  <datalist id="edit-invoice-store-suggestions">
                    {storeSuggestions.map((st, idx) => (
                      <option key={idx} value={st} />
                    ))}
                  </datalist>
                </div>
                {storeSuggestions.length > 0 && !storeName && (
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-14 overflow-y-auto">
                    {storeSuggestions.slice(0, 5).map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStoreName(st)}
                        className="text-[10px] bg-gray-100 hover:bg-purple-50 dark:bg-zinc-800 dark:hover:bg-purple-950/40 text-gray-700 dark:text-gray-300 hover:text-purple-700 px-2 py-0.5 rounded-md border border-gray-200 dark:border-zinc-700 transition"
                      >
                        🏬 {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" /> تاريخ الفاتورة
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-blue-500" /> رقم الفاتورة (اختياري)
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="رقم الوصل أو الفاتورة"
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Items Management */}
            <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                  مواد الفاتورة ({items.length} مواد)
                </label>
                <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                  الإجمالي: {currentTotal.toLocaleString()} د.ع
                </span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="bg-gray-50 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                        className="w-full bg-transparent font-black text-xs text-gray-900 dark:text-white border-b border-transparent focus:border-purple-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          الكمية:
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-14 bg-white dark:bg-zinc-700 rounded px-1 text-center font-bold text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-600"
                          />
                          {item.unit}
                        </span>
                        <span className="flex items-center gap-1">
                          المفرد:
                          <input
                            type="number"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                            className="w-16 bg-white dark:bg-zinc-700 rounded px-1 text-center font-bold text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-zinc-600"
                          />
                        </span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <p className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">
                        {Number(item.totalPrice || 0).toLocaleString()} د.ع
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-gray-400 hover:text-red-500 p-1 transition mt-0.5"
                        title="حذف المادة من الفاتورة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer - Fixed Pinned at Bottom */}
          <div className="shrink-0 p-3 sm:p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 flex items-center gap-2 sm:gap-3 pb-8 sm:pb-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 active:scale-95 transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  حفظ التعديلات وتحديث المصروف
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

      {/* Fullscreen Photo Lightbox Modal */}
      {isPhotoZoomed && imageUrl && (
        <div 
          className="fixed inset-0 z-[280] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setIsPhotoZoomed(false)}
        >
          <div 
            className="relative max-w-2xl w-full max-h-[90vh] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90 text-white">
              <span className="font-bold text-xs truncate">صورة الوصل: {storeName || "فاتورة مواد"}</span>
              <div className="flex items-center gap-2">
                <a 
                  href={imageUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-lg text-zinc-200 font-bold transition"
                >
                  فتح ↗
                </a>
                <button 
                  type="button" 
                  onClick={() => setIsPhotoZoomed(false)}
                  className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40">
              <img 
                src={imageUrl} 
                alt="معاينة الوصل" 
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
