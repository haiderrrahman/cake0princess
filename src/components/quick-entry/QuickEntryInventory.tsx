"use client";
import React, { useState, useRef, useEffect } from "react";
import { Boxes, Upload, Camera, Tag, Calculator, Loader2, Receipt, Image as ImageIcon, Sparkles, Zap } from "lucide-react";
import { collection, addDoc, updateDoc, getDocs, serverTimestamp } from "firebase/firestore";
import AutocompleteInput from "@/components/AutocompleteInput";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import { toast } from "sonner";
import ScanCakeInvoiceModal from "@/components/ScanCakeInvoiceModal";

const INVENTORY_UNITS = ["كغم", "لتر", "قطعة", "كيس", "سطل", "علبة", "ورقة", "رول"];
const INVENTORY_CATEGORIES = ["طحين وسكر", "كريمات", "حشوات", "شوكولاتة وكاكاو", "ألوان وإضافات", "منكهات وعطور", "عجينة سكر", "فواكه ومكسرات", "تغليف وزينة", "مستهلكات", "قوالب وصواني", "أدوات", "أخرى"];

export default function QuickEntryInventory({ onSuccess }: { onSuccess: () => void }) {
  const [entryType, setEntryType] = useState<"need" | "available">("need");
  const [submitting, setSubmitting] = useState(false);
  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState("");
  const [invQuantity, setInvQuantity] = useState("");
  const [invUnit, setInvUnit] = useState("");
  const [invPrice, setInvPrice] = useState("");
  const [invMinAlert, setInvMinAlert] = useState("1");
  const [invImageFile, setInvImageFile] = useState<File | null>(null);
  const [invImagePreview, setInvImagePreview] = useState<string | null>(null);
  const invFileRef = useRef<HTMLInputElement>(null);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [fullInventoryItems, setFullInventoryItems] = useState<any[]>([]);
  const [invPaidBy, setInvPaidBy] = useState<"none" | "cake" | "salary" | "split">("cake");
  const [invSplitDebtAmount, setInvSplitDebtAmount] = useState("");

  // Invoice scan modal state
  const [isScanInvoiceOpen, setIsScanInvoiceOpen] = useState(false);
  const [scanAutoTrigger, setScanAutoTrigger] = useState<"camera" | "gallery" | null>(null);

  useEffect(() => {
    getDocs(collection(db, "cake_inventory")).then(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFullInventoryItems(items);
      setExistingNames(items.map((d: any) => d.name || ""));
    });
  }, []);

  const handleInvImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setInvImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: false });
        setInvImageFile(compressed);
      } catch (err) {
        setInvImageFile(file);
      }
    }
  };

  const submitInventory = async () => {
    if (!invName || !invQuantity || !invCategory || !invUnit) {
      toast.error("يرجى تعبئة جميع الحقول الأساسية (الاسم، الكمية، التصنيف، والوحدة)");
      return;
    }
    if (existingNames.some(n => n.trim() === invName.trim())) {
      toast.error("هذه المادة موجودة مسبقاً في المخزن");
      return;
    }
    setSubmitting(true);
    try {
      if (entryType === "need") {
        await addDoc(collection(db, "cake_inventory"), {
          name: invName, category: invCategory,
          quantity: 0, neededQuantity: Number(invQuantity), unit: invUnit,
          price: Number(invPrice || 0), minAlert: Number(invMinAlert || 0),
          imageUrl: "", createdAt: new Date(), updatedAt: new Date()
        });
        toast.success("تم إضافة الاحتياج بنجاح");
      } else {
        const newInvRef = await addDoc(collection(db, "cake_inventory"), {
          name: invName, category: invCategory,
          quantity: Number(invQuantity), neededQuantity: 0, unit: invUnit,
          price: Number(invPrice || 0), minAlert: Number(invMinAlert || 0),
          imageUrl: "", paymentSource: invPaidBy, createdAt: new Date(), updatedAt: new Date()
        });

        const totalCost = Number(invQuantity) * Number(invPrice || 0);
        if (totalCost > 0 && invPaidBy !== 'none') {
          if (invPaidBy === 'split') {
            const debtAmount = Number(invSplitDebtAmount) || 0;
            const paidAmount = totalCost - debtAmount;
            
            if (debtAmount > 0) {
              await addDoc(collection(db, "expenses"), {
                description: `إضافة سريعة للمخزن: ${invName} (جزء دين)`,
                amount: debtAmount,
                category: "مشتريات مخزنية",
                isDebt: true,
                createdAt: serverTimestamp()
              });
            }
            if (paidAmount > 0) {
              await addDoc(collection(db, "expenses"), {
                description: `إضافة سريعة للمخزن: ${invName} (مدفوع من الكيك)`,
                amount: paidAmount,
                category: "مشتريات مخزنية",
                isDebt: false,
                createdAt: serverTimestamp()
              });
            }
          } else {
            await addDoc(collection(db, "expenses"), {
              description: `إضافة سريعة للمخزن: ${invName}`,
              amount: totalCost,
              category: "مشتريات مخزنية",
              isDebt: invPaidBy === 'salary',
              createdAt: serverTimestamp()
            });
          }
        }

        if (invImageFile) {
          toast.success("جاري رفع الصورة...");
          const fileRef = ref(storage, `cake_inventory/${Date.now()}_${invImageFile.name}`);
          uploadBytes(fileRef, invImageFile).then(async () => {
            const url = await getDownloadURL(fileRef);
            await updateDoc(newInvRef, { imageUrl: url });
          });
        }
        
        toast.success("تم إضافة المادة للمخزن");
      }
      
      onSuccess();
    } catch (e) {
      toast.error("فشل الإضافة للمخزن");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Smart AI Invoice Scanner Bar */}
      <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-200/80 dark:border-amber-500/30 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>إضافة فاتورة مواد للمخزن</span>
                <span className="text-[10px] bg-amber-200/60 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-md font-bold">🧠 AI</span>
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                مسح ذكي بالكاميرا أو الاستوديو واستخراج المواد والأسعار تلقائياً
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setScanAutoTrigger("camera");
              setIsScanInvoiceOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition active:scale-95 cursor-pointer"
            title="تصوير الفاتورة بالكاميرا مباشرة"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>مسح كاميرا 📸</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanAutoTrigger("gallery");
              setIsScanInvoiceOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-sm transition active:scale-95 cursor-pointer"
            title="رفع الفاتورة من الاستوديو"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>من الاستوديو 🖼️</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScanAutoTrigger(null);
              setIsScanInvoiceOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-slate-950 font-black shadow-sm transition active:scale-95 cursor-pointer"
            title="فتح نافذة الفاتورة الذكية بالكامل"
          >
            <Receipt className="w-3.5 h-3.5 text-amber-950" />
            <span>فاتورة كاملة 🧾</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setEntryType("need")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            entryType === "need"
              ? "bg-white dark:bg-zinc-700 text-orange-600 dark:text-orange-400 shadow-sm"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          إضافة للاحتياجات
        </button>
        <button
          type="button"
          onClick={() => setEntryType("available")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            entryType === "available"
              ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          إضافة للمتوفر
        </button>
        <button
          type="button"
          onClick={() => {
            setScanAutoTrigger(null);
            setIsScanInvoiceOpen(true);
          }}
          className="flex-1 py-2 text-xs font-bold rounded-lg transition text-amber-600 dark:text-amber-400 hover:bg-white/60 dark:hover:bg-zinc-700/60"
        >
          🧾 مسح فاتورة AI
        </button>
      </div>

      <div className="flex gap-4">
        <div 
          onClick={() => invFileRef.current?.click()}
          className="w-24 h-24 shrink-0 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition relative overflow-hidden group"
        >
          {invImagePreview ? (
            <img src={invImagePreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <span className="text-[10px] text-gray-500 font-bold">صورة</span>
            </div>
          )}
          <input type="file" ref={invFileRef} className="hidden" accept="image/*" onChange={handleInvImageChange} />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <AutocompleteInput
              value={invName}
              onChange={setInvName}
              suggestions={existingNames}
              placeholder="اسم المادة"
              icon={<Boxes className="w-4 h-4" />}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <div className="relative">
              <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                value={invCategory} onChange={e => setInvCategory(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="" disabled>التصنيف</option>
                {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الكمية</label>
          <input 
            type="number" value={invQuantity} onChange={e => setInvQuantity(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left"
            placeholder="0" dir="ltr"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الوحدة</label>
          <select 
            value={invUnit} onChange={e => setInvUnit(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
          >
            <option value="" disabled>اختر الوحدة</option>
            {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex flex-col gap-1">
            <span>{entryType === "need" ? "السعر التقديري للوحدة (د.ع)" : "السعر للوحدة (د.ع)"}</span>
            {invPrice && invQuantity && Number(invQuantity) > 0 ? (
              <span className="text-[10px] text-emerald-600 font-black">
                المجموع: {(Number(invPrice) * Number(invQuantity)).toLocaleString()} د.ع
              </span>
            ) : null}
          </label>
          <div className="relative">
            <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="number" value={invPrice} onChange={e => setInvPrice(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left"
              placeholder="0" dir="ltr"
            />
          </div>
        </div>
        {entryType === "available" && (
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تنبيه النقص عند</label>
            <input 
              type="number" value={invMinAlert} onChange={e => setInvMinAlert(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left border-red-200 focus:ring-red-500"
              placeholder="1" dir="ltr"
            />
          </div>
        )}
      </div>

      {entryType === "available" && (
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تم الدفع من</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setInvPaidBy('none')}
              className={`py-2 rounded-xl font-black text-[10px] border transition ${
                invPaidBy === 'none' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
              }`}>بدون إضافة مصروف</button>
            <button type="button" onClick={() => setInvPaidBy('cake')}
              className={`py-2 rounded-xl font-black text-[10px] border transition ${
                invPaidBy === 'cake' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
              }`}>🎂 أموال الكيك</button>
            <button type="button" onClick={() => setInvPaidBy('salary')}
              className={`py-2 rounded-xl font-black text-[10px] border transition ${
                invPaidBy === 'salary' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
              }`}>👤 دين من الراتب</button>
            <button type="button" onClick={() => setInvPaidBy('split')}
              className={`py-2 rounded-xl font-black text-[10px] border transition ${
                invPaidBy === 'split' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
              }`}>✂️ مقسم</button>
          </div>
          
          {invPaidBy === 'split' && (
            <div className="mt-3 animate-fade-in">
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ الذي من الراتب (دين)</label>
              <input type="number" step="any" value={invSplitDebtAmount} onChange={e => setInvSplitDebtAmount(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                placeholder="أدخل مبلغ الدين" />
            </div>
          )}
        </div>
      )}

      <button
        onClick={submitInventory} disabled={submitting}
        className={`w-full text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition ${
          entryType === "need" 
            ? "bg-gradient-to-l from-orange-500 to-orange-700"
            : "bg-gradient-to-l from-emerald-500 to-emerald-700"
        }`}
      >
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (entryType === "need" ? "إضافة للاحتياجات" : "إضافة للمخزن")}
      </button>

      {/* Full AI Invoice Scanner Modal */}
      <ScanCakeInvoiceModal
        isOpen={isScanInvoiceOpen}
        onClose={() => {
          setIsScanInvoiceOpen(false);
          setScanAutoTrigger(null);
        }}
        onSuccess={() => {
          setIsScanInvoiceOpen(false);
          setScanAutoTrigger(null);
          toast.success("تم تسجيل فاتورة المواد بنجاح في المخزن والمشتريات 🎉");
          onSuccess();
        }}
        inventoryItems={fullInventoryItems}
        autoTrigger={scanAutoTrigger}
      />
    </div>
  );
}
