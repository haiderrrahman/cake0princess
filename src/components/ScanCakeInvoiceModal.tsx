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
  Tag,
  Zap,
  Edit,
  Eye,
  ImageIcon,
  FileText
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
import { uploadImageResiliently } from "@/lib/hfImageStore";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ScanCakeInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems?: any[];
  onSuccess: () => void;
  initialMode?: "scan" | "manual";
}

export default function ScanCakeInvoiceModal({
  isOpen,
  onClose,
  inventoryItems = [],
  onSuccess,
  initialMode = "scan"
}: ScanCakeInvoiceModalProps) {
  const safeInventory = Array.isArray(inventoryItems) ? inventoryItems.filter(i => i && typeof i === "object") : [];

  // Attached Images / Files
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
  const [previewZoomUrl, setPreviewZoomUrl] = useState<string | null>(null);

  // Scanning & AI state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Flow State
  const [hasScanned, setHasScanned] = useState(false);
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState("");

  // Invoice Fields
  const [storeName, setStoreName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<ScannedCakeItem[]>([]);
  const [paymentSource, setPaymentSource] = useState<"none" | "cake" | "salary" | "split">("cake");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [storeSuggestions, setStoreSuggestions] = useState<string[]>([]);

  // Input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachPhotoInputRef = useRef<HTMLInputElement>(null);
  const attachCameraInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes & load store suggestions
  useEffect(() => {
    if (!isOpen) {
      setSelectedImageFile(null);
      setAttachedImagePreview(null);
      setPreviewZoomUrl(null);
      setIsScanning(false);
      setScanStatus("");
      setHasScanned(false);
      setItems([]);
      setStoreName("");
      setInvoiceDate("");
      setInvoiceNumber("");
      setPaymentSource("cake");
      setSplitDebtAmount("");
      setShowQuickPasteModal(false);
      setQuickPasteText("");
    } else {
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      if (initialMode === "manual") {
        setHasScanned(true);
        setItems([
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
      }

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
  }, [isOpen, initialMode]);

  const totalCalculated = items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);

  // Auto-fill split debt default to 50%
  useEffect(() => {
    if (isOpen && paymentSource === "split" && (!splitDebtAmount || Number(splitDebtAmount) === 0) && totalCalculated > 0) {
      setSplitDebtAmount(String(Math.round(totalCalculated / 2)));
    }
  }, [isOpen, paymentSource, totalCalculated]);

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

  // Triggered when user selects a photo for AI Scanning
  const handleScanFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const primaryFile = files[0];
    setSelectedImageFile(primaryFile);
    const localUrl = URL.createObjectURL(primaryFile);
    setAttachedImagePreview(localUrl);

    await startScan(files);
  };

  // Triggered when user attaches/replaces photo without scanning
  const handleAttachPhotoSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setAttachedImagePreview(localUrl);
    toast.success("📸 تم إرفاق صورة الفاتورة بنجاح");
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
        const directMatch = safeInventory.find((inv) => {
          if (!inv || !inv.name) return false;
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
      // Still allow manual entry even if AI scan failed
      setHasScanned(true);
      if (items.length === 0) {
        handleAddItem();
      }
    } finally {
      setIsScanning(false);
      setScanStatus("");
    }
  };

  const handleStartManualEntry = () => {
    setHasScanned(true);
    if (items.length === 0) {
      handleAddItem();
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

  // Quick Paste parsing logic (matches Home Finance format)
  const handleApplyQuickPaste = () => {
    if (!quickPasteText.trim()) return;

    const lines = quickPasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedItems: ScannedCakeItem[] = [];

    lines.forEach((line) => {
      // Look for price or numbers: e.g. "طحين 25 كغم 35000" or "فانيلا 5000"
      const tokens = line.split(/[\s,،-]+/);
      let name = "";
      let quantity = 1;
      let unit = "كغم";
      let totalPrice = 0;

      // Extract numbers
      const numbers: number[] = [];
      const wordTokens: string[] = [];

      tokens.forEach((t) => {
        const cleaned = t.replace(/[^\d.]/g, "");
        if (cleaned && !isNaN(Number(cleaned))) {
          numbers.push(Number(cleaned));
        } else if (t.trim()) {
          // Check if unit
          if (["كغم", "كيلو", "غرام", "غم", "لتر", "علبة", "باكيت", "قطعة", "كرتون"].includes(t.trim())) {
            unit = t.trim() === "كيلو" ? "كغم" : t.trim() === "غم" ? "غرام" : t.trim();
          } else {
            wordTokens.push(t.trim());
          }
        }
      });

      name = wordTokens.join(" ");

      if (numbers.length >= 2) {
        // e.g. quantity and total price
        quantity = numbers[0];
        totalPrice = numbers[1];
      } else if (numbers.length === 1) {
        totalPrice = numbers[0];
        quantity = 1;
      }

      if (!name) name = line;

      // Match inventory
      const normName = normalizeArabicText(name);
      const directMatch = safeInventory.find((inv) => {
        if (!inv || !inv.name) return false;
        const invNorm = normalizeArabicText(inv.name);
        return invNorm === normName || invNorm.includes(normName) || normName.includes(invNorm);
      });

      parsedItems.push({
        id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: directMatch?.name || name,
        quantity: quantity || 1,
        unit: directMatch?.unit || unit || "كغم",
        unitPrice: quantity > 0 && totalPrice > 0 ? Math.round(totalPrice / quantity) : totalPrice,
        totalPrice: totalPrice,
        category: directMatch?.category || "طحين وسكر",
        matchedInventoryId: directMatch?.id,
        isNewItem: !directMatch
      });
    });

    if (parsedItems.length > 0) {
      setItems((prev) => [...prev.filter((i) => i.name.trim() !== ""), ...parsedItems]);
      setHasScanned(true);
      setShowQuickPasteModal(false);
      setQuickPasteText("");
      toast.success(`⚡ تم استيراد ${parsedItems.length} مواد من النص الملصق!`);
    } else {
      toast.error("لم يتم العثور على أسطر صالحة");
    }
  };

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
      // Upload image if attached
      let finalImageUrl = "";
      if (selectedImageFile) {
        setScanStatus("جاري رفع وحفظ صورة الفاتورة بأمان 🔒...");
        try {
          finalImageUrl = await uploadImageResiliently(
            "receipts",
            `cake_inv_${Date.now()}`,
            selectedImageFile
          );
        } catch (imgErr) {
          console.warn("Could not upload receipt image, continuing without it:", imgErr);
        }
      }

      await recordCakeInvoiceBatch({
        storeName: storeName.trim() || "معرض مستلزمات الكيك",
        invoiceDate: invoiceDate || new Date().toISOString().split("T")[0],
        invoiceNumber: invoiceNumber.trim(),
        totalAmount: totalCalculated,
        imageUrl: finalImageUrl,
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

      toast.success("✅ تم حفظ الفاتورة وتحديث المخزن والمالية بنجاح!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving invoice:", err);
      toast.error("حدث خطأ أثناء حفظ الفاتورة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSubmitting(false);
      setScanStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border-0 sm:border border-gray-100 dark:border-zinc-800 sm:rounded-3xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[92vh] overflow-hidden shadow-2xl flex flex-col my-auto custom-scrollbar">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Receipt className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                تسجيل فاتورة مواد الكيك بالمخزن
                <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                  ذكي ⚡
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                إضافة بصورة (AI)، أو يدوياً، أو إرفاق صورة مع تحديد مصدر الحساب المالي
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

        {/* Action Switcher Bar (Like Home Finance) */}
        <div className="p-3 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:opacity-95 active:scale-95 transition"
              title="تصوير الفاتورة مباشرة بالكاميرا"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>مسح كاميرا 📸</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:opacity-95 active:scale-95 transition"
              title="رفع وقراءة صورة الفاتورة من الاستوديو"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>من الاستوديو 🖼️</span>
            </button>

            <button
              type="button"
              onClick={handleStartManualEntry}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black border transition active:scale-95 ${
                hasScanned
                  ? "bg-white dark:bg-zinc-900 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
              }`}
            >
              <Edit className="w-3.5 h-3.5 text-blue-600" />
              <span>إدخال يدوي ✍️</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickPasteModal(true)}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 transition active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>لصق سريعة ⚡</span>
            </button>
          </div>
        </div>

        {/* Hidden inputs for AI Scanning */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && handleScanFilesSelected(Array.from(e.target.files))}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleScanFilesSelected(Array.from(e.target.files))}
        />

        {/* Hidden inputs for Attaching Photo without re-scanning */}
        <input
          type="file"
          ref={attachCameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files && handleAttachPhotoSelected(Array.from(e.target.files))}
        />
        <input
          type="file"
          ref={attachPhotoInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && handleAttachPhotoSelected(Array.from(e.target.files))}
        />

        {/* Modal Body */}
        {!hasScanned ? (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0 custom-scrollbar">
            {/* Scanning Progress Banner */}
            {isScanning && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-6 text-center space-y-3 animate-pulse">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                <p className="font-black text-sm text-blue-900 dark:text-blue-200">
                  {scanStatus || "جاري استخراج بيانات الفاتورة بالذكاء الاصطناعي..."}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  نقوم بقراءة الأسماء، الكميات، أسعار المفرد والإجمالي ومطابقتها مع مواد المخزن
                </p>
              </div>
            )}

            {/* Initial Choices Area */}
            {!isScanning && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-5 border-2 border-dashed border-blue-300 dark:border-blue-800/60 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition flex flex-col items-center justify-center gap-2.5 text-center group active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-blue-950 dark:text-blue-100">
                        تصوير بكاميرا الهاتف 📸
                      </p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                        مسح ذكي واستخراج فوري
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-5 border-2 border-dashed border-purple-300 dark:border-purple-800/60 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition flex flex-col items-center justify-center gap-2.5 text-center group active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-purple-950 dark:text-purple-100">
                        رفع صورة من المعرض 🖼️
                      </p>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                        اختيار صورة وصل محفوظة
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartManualEntry}
                    className="p-5 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800 transition flex flex-col items-center justify-center gap-2.5 text-center group active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gray-700 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                      <Edit className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-gray-800 dark:text-gray-100">
                        إدخال يدوي مباشر ✍️
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        كتابة بنود الفاتورة بدون مسح
                      </p>
                    </div>
                  </button>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                  <div className="text-xs leading-relaxed space-y-1">
                    <p className="font-bold">خيارات الحساب المالي للفاتورة:</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      يمكنك احتساب تكلفة الفاتورة من <strong>فلوس الكيك</strong>، أو <strong>فلوس الراتب (دين)</strong>، أو <strong>بالنصف</strong>، أو <strong>بدون حساب الفلوس</strong> (مخزن فقط).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0 custom-scrollbar pb-6">
              {/* Attached Receipt Image Section (Photo Attached or Can Attach) */}
              <div className="bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📸</span>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                      صورة الفاتورة / الوصل (مرفقة)
                    </span>
                    {attachedImagePreview && (
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                        مرفقة ✅
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => attachCameraInputRef.current?.click()}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition"
                    >
                      <Camera className="w-3.5 h-3.5" /> كاميرا
                    </button>
                    <button
                      type="button"
                      onClick={() => attachPhotoInputRef.current?.click()}
                      className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 transition"
                    >
                      <Upload className="w-3.5 h-3.5" /> استوديو
                    </button>
                  </div>
                </div>

                {attachedImagePreview ? (
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3">
                      <img
                        src={attachedImagePreview}
                        alt="Receipt"
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-zinc-700 cursor-pointer hover:scale-105 transition shadow-xs"
                        onClick={() => setPreviewZoomUrl(attachedImagePreview)}
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          تم إرفاق صورة الوصل بنجاح
                        </p>
                        <p className="text-[10px] text-gray-400 font-normal">
                          سيتم حفظ الصورة مع الفاتورة للرجوع إليها مستقبلاً
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewZoomUrl(attachedImagePreview)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-zinc-800 transition"
                        title="معاينة الصورة مكبرة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImageFile(null);
                          setAttachedImagePreview(null);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-800 transition"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 font-bold">
                    يمكنك إرفاق صورة الوصل الورقي لتبقى محفوظة في سجل الفواتير والمشتريات (اختياري).
                  </p>
                )}
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
                      placeholder="مثال: معرض البركة، سوق الشورجة..."
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
                    <span>قائمة مواد الفاتورة ({items.length})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickPasteModal(true)}
                      className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 transition"
                    >
                      <Zap className="w-3 h-3 text-amber-500" /> لصق سريع
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition"
                    >
                      <Plus className="w-3 h-3" /> إضافة مادة
                    </button>
                  </div>
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
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateItem(idx, { name: val });
                            // Auto check inventory match
                            const norm = normalizeArabicText(val);
                            const found = safeInventory.find((inv) => inv && inv.name && normalizeArabicText(inv.name) === norm);
                            if (found) {
                              handleUpdateItem(idx, {
                                matchedInventoryId: found.id,
                                matchedInventoryName: found.name,
                                category: found.category || item.category,
                                unit: found.unit || item.unit,
                                isNewItem: false
                              });
                            }
                          }}
                          placeholder="اسم المادة (مثال: طحين صفر، كاكاو، كريمة شانتيه...)"
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
                              const found = safeInventory.find((inv) => inv && inv.id === val);
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
                          {safeInventory.map((inv) => (
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
                            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-center text-emerald-600 dark:text-emerald-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & 4 Payment Source Options */}
              <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-zinc-800/80 dark:to-zinc-800/40 border border-blue-100 dark:border-zinc-700 rounded-2xl p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-100 dark:border-zinc-700 pb-3">
                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300">
                    مجموع الفاتورة الكلي:
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-blue-950 dark:text-white">
                    {totalCalculated.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-500">د.ع</span>
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                      💰 الحساب المالي (مصدر صرف أموال الفاتورة):
                    </label>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                      اختر طريقة التسجيل المالي
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Option 1: فلوس الكيك */}
                    <button
                      type="button"
                      onClick={() => setPaymentSource("cake")}
                      className={`p-3 rounded-2xl text-right border transition flex flex-col justify-between gap-1 ${
                        paymentSource === "cake"
                          ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
                          : "bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs">🎂 من فلوس الكيك</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          paymentSource === "cake" ? "bg-white/20 text-white" : "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                        }`}>
                          مصروف تشغيلي
                        </span>
                      </div>
                      <p className={`text-[10px] leading-tight ${paymentSource === "cake" ? "text-purple-100" : "text-gray-500 dark:text-gray-400"}`}>
                        يُخصم من إيرادات وأرباح الكيك مباشرة.
                      </p>
                    </button>

                    {/* Option 2: فلوس الراتب */}
                    <button
                      type="button"
                      onClick={() => setPaymentSource("salary")}
                      className={`p-3 rounded-2xl text-right border transition flex flex-col justify-between gap-1 ${
                        paymentSource === "salary"
                          ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                          : "bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs">👤 من فلوس الراتب</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          paymentSource === "salary" ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                        }`}>
                          دين مستحق
                        </span>
                      </div>
                      <p className={`text-[10px] leading-tight ${paymentSource === "salary" ? "text-amber-100" : "text-gray-500 dark:text-gray-400"}`}>
                        دُفع من الراتب الشخصي ويُسجل كدين مستحق استرداده لكِ.
                      </p>
                    </button>

                    {/* Option 3: بالنصف */}
                    <button
                      type="button"
                      onClick={() => setPaymentSource("split")}
                      className={`p-3 rounded-2xl text-right border transition flex flex-col justify-between gap-1 ${
                        paymentSource === "split"
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                          : "bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs">✂️ بالنصف (كيك وراتب)</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          paymentSource === "split" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                        }`}>
                          مقسم 50/50
                        </span>
                      </div>
                      <p className={`text-[10px] leading-tight ${paymentSource === "split" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
                        نصف المبلغ مصروف كيك ونصفه دين مستحق للراتب.
                      </p>
                    </button>

                    {/* Option 4: بدون حساب الفلوس */}
                    <button
                      type="button"
                      onClick={() => setPaymentSource("none")}
                      className={`p-3 rounded-2xl text-right border transition flex flex-col justify-between gap-1 ${
                        paymentSource === "none"
                          ? "bg-gray-800 text-white border-gray-800 shadow-md"
                          : "bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs">🚫 بدون حساب الفلوس</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          paymentSource === "none" ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300"
                        }`}>
                          مخزني فقط
                        </span>
                      </div>
                      <p className={`text-[10px] leading-tight ${paymentSource === "none" ? "text-gray-300" : "text-gray-500 dark:text-gray-400"}`}>
                        تحديث كميات المخزن فقط دون تسجيل أي مصروف أو دين.
                      </p>
                    </button>
                  </div>

                  {paymentSource === "split" && (
                    <div className="mt-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-blue-200 dark:border-zinc-700 animate-fade-in space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-gray-700 dark:text-gray-300">
                          مبلغ الدين المسدد من الراتب (د.ع):
                        </label>
                        <span className="text-[10px] text-gray-400 font-mono">
                          الباقي للكيك: {Math.max(0, totalCalculated - (Number(splitDebtAmount) || 0)).toLocaleString()} د.ع
                        </span>
                      </div>
                      <input
                        type="number"
                        step="any"
                        required
                        value={splitDebtAmount}
                        onChange={(e) => setSplitDebtAmount(e.target.value)}
                        placeholder="أدخل مبلغ الدين"
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-black focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Actions Bar */}
            <div className="shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-200 dark:border-zinc-800 p-3 sm:p-4 flex items-center gap-3 z-30 shadow-[0_-8px_25px_rgba(0,0,0,0.12)]">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{scanStatus || "جاري حفظ الفاتورة وتحديث المخزن..."}</span>
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

      {/* ─── QUICK PASTE MODAL (Matches Home Finance) ─── */}
      {showQuickPasteModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 animate-scale-in space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white text-base">لصق قائمة سريعة</h4>
                  <p className="text-[11px] text-gray-500 font-bold">تحويل نص القائمة تلقائياً إلى بنود في الفاتورة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickPasteModal(false)}
                className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              الصق النص من الواتساب أو الملاحظات، مثل:
              <br />
              <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] text-blue-600 block mt-1 font-mono">
                طحين 25 كغم 35000
                <br />
                سكر أبيض 10 كغم 15000
                <br />
                فانيلا سائلة 1 علبة 8000
              </code>
            </p>

            <textarea
              rows={6}
              value={quickPasteText}
              onChange={(e) => setQuickPasteText(e.target.value)}
              placeholder="الصق نص المواد والأسعار هنا..."
              className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl p-3 text-xs font-bold focus:outline-none focus:border-blue-500 custom-scrollbar"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleApplyQuickPaste}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>تحويل وإضافة للفاتورة</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuickPasteModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FULL IMAGE LIGHTBOX MODAL ─── */}
      {previewZoomUrl && (
        <div
          className="fixed inset-0 z-[100001] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewZoomUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewZoomUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white bg-white/20 hover:bg-white/30 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewZoomUrl}
              alt="Receipt Large"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
