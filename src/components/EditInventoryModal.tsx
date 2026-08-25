"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toast } from "sonner";

const INVENTORY_UNITS = ["كغم", "لتر", "قطعة", "كيس", "سطل", "علبة", "ورقة", "رول"];
const INVENTORY_CATEGORIES = ["طحين وسكر", "كريمات", "حشوات", "شوكولاتة وكاكاو", "ألوان وإضافات", "منكهات وعطور", "عجينة سكر", "فواكه ومكسرات", "تغليف وزينة", "مستهلكات", "قوالب وصواني", "أدوات", "أخرى"];

export default function EditInventoryModal({ isOpen, onClose, item, onEditSuccess }: any) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("طحين وسكر");
  const [quantity, setQuantity] = useState("");
  const [neededQuantity, setNeededQuantity] = useState("0");
  const [unit, setUnit] = useState("كغم");
  const [price, setPrice] = useState("");
  const [minAlert, setMinAlert] = useState("1");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [invPaidBy, setInvPaidBy] = useState<"none" | "cake" | "salary" | "split">("none");
  const [splitDebtAmount, setSplitDebtAmount] = useState("");

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || "");
      setCategory(item.category || "طحين وسكر");
      setQuantity(item.quantity?.toString() || "");
      setNeededQuantity(item.neededQuantity?.toString() || "0");
      setUnit(item.unit || "كغم");
      setPrice(item.price ? item.price.toString() : "");
      setMinAlert(item.minAlert?.toString() || "1");
      setImagePreview(item.imageUrl || item.tempImageUrl || null);
      setInvPaidBy(item.paymentSource || "none");
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity) return;
    
    setLoading(true);
    try {
      const newQty = Number(quantity);
      let newNeeded = Number(neededQuantity) || 0;
      const minAlertVal = Number(minAlert) || 1;
      
      // Auto-set needed if quantity drops below threshold and needed wasn't explicitly set higher
      if (newQty <= minAlertVal && newNeeded === 0) {
        newNeeded = 1;
      } else if (newQty > minAlertVal && newNeeded === Number(item?.neededQuantity || 0)) {
        newNeeded = 0;
      }

      const updateData: any = {
        name,
        category,
        quantity: newQty,
        neededQuantity: newNeeded,
        unit,
        price: Number(price) || 0,
        minAlert: minAlertVal,
        paymentSource: invPaidBy,
        lastUpdated: serverTimestamp()
      };

      if (imageFile) {
        const fRef = ref(storage, `inventory/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fRef, imageFile);
        updateData.imageUrl = await getDownloadURL(fRef);
      }

      await updateDoc(doc(db, "cake_inventory", item.id), updateData);
      
      // newQty is already defined above

      const oldQty = Number(item.quantity || 0);
      const diff = newQty - oldQty;
      const itemPrice = Number(price) || 0;

      if (diff > 0 && invPaidBy !== "none" && itemPrice > 0) {
        const cost = diff * itemPrice;
        const addDoc = (await import("firebase/firestore")).addDoc;
        const collection = (await import("firebase/firestore")).collection;
        
        if (invPaidBy === 'split') {
          const debtAmount = Number(splitDebtAmount) || 0;
          const paidAmount = cost - debtAmount;
          if (debtAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              title: `شراء للمخزن (تعديل): ${name} (دين من الراتب)`,
              amount: debtAmount,
              category: "مشتريات مخزنية",
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: true
            });
          }
          if (paidAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              title: `شراء للمخزن (تعديل): ${name} (مدفوع من أموال الكيك)`,
              amount: paidAmount,
              category: "مشتريات مخزنية",
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: false
            });
          }
        } else {
          await addDoc(collection(db, "expenses"), {
            title: `شراء للمخزن (تعديل): ${name}`,
            amount: cost,
            category: "مشتريات مخزنية",
            month: new Date().getMonth() + 1,
            createdAt: serverTimestamp(),
            isDebt: invPaidBy === 'salary'
          });
        }
      }

      toast.success("تم التعديل بنجاح", {
        style: {
          background: '#10B981',
          color: '#fff',
          borderRadius: '16px',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      if (onEditSuccess) onEditSuccess({ ...item, ...updateData });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء التعديل");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-right flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-black text-xl">تعديل المادة</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">اسم المادة</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">التصنيف</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none">
                  {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">المتوفر</label>
                <input required type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاحتياج (لشراء)</label>
                <input type="number" step="any" value={neededQuantity} onChange={e => setNeededQuantity(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">وحدة القياس</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none">
                  {INVENTORY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 flex flex-col gap-1">
                  <span>السعر للوحدة (د.ع)</span>
                  <div className="flex gap-2 text-[10px]">
                    {price && quantity && Number(quantity) > 0 ? <span className="text-emerald-600 font-black">إجمالي المتوفر: {(Number(price) * Number(quantity)).toLocaleString()}</span> : null}
                    {price && neededQuantity && Number(neededQuantity) > 0 ? <span className="text-blue-600 font-black">إجمالي الاحتياج: {(Number(price) * Number(neededQuantity)).toLocaleString()}</span> : null}
                  </div>
                </label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">تنبيه عند وصول لـ</label>
                <input type="number" step="any" value={minAlert} onChange={e => setMinAlert(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">صورة المادة</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-400/50 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-100 transition"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-20 object-contain rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700">تغيير الصورة</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">مصدر الدفع (للكمية المضافة)</label>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={() => setInvPaidBy('none')}
                  className={`py-2 rounded-xl font-black text-[10px] border transition ${
                    invPaidBy === 'none' ? 'bg-gray-600 text-white border-gray-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
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
                  <input type="number" step="any" value={splitDebtAmount} onChange={e => setSplitDebtAmount(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                    placeholder="أدخل مبلغ الدين" />
                </div>
              )}
            </div>

            <button disabled={loading} type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3.5 font-bold flex justify-center items-center gap-2 mt-4 transition">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> حفظ التعديلات</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
