"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Phone, User, Calendar, Tag, Coins, Loader2, MapPin } from "lucide-react";
import { collection, addDoc, updateDoc, serverTimestamp, getDocs, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale/ar";

const PLATFORMS = ["إنستجرام", "واتساب", "فيسبوك", "تيك توك", "هاتف", "أخرى"];

export default function QuickEntrySocial({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [platform, setPlatform] = useState("واتساب");
  const [address, setAddress] = useState("");
  const [cakeName, setCakeName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString());
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (typeof navigator !== "undefined") setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    getDocs(collection(db, "customers")).then(snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: false });
        setImageFile(compressed);
      } catch (err) {
        setImageFile(file);
      }
    }
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomerName(name);
    setShowCustomerDropdown(true);
    const existing = customers.find(c => c.name === name);
    if (existing) {
      if (existing.phone) setCustomerPhone(existing.phone);
      if (existing.address) setAddress(existing.address);
      if (existing.platform) setPlatform(existing.platform);
    }
  };

  const selectCustomer = (name: string, phone: string, customerAddress: string, customerPlatform: string) => {
    setCustomerName(name);
    if (phone) setCustomerPhone(phone);
    if (customerAddress) setAddress(customerAddress);
    if (customerPlatform) setPlatform(customerPlatform);
    setShowCustomerDropdown(false);
  };

  const parseIqdInput = (val: string | number) => {
    let num = Number(val) || 0;
    if (num > 0 && num < 1000) num *= 1000;
    return num;
  };

  const submitSale = async () => {
    if (!customerName || !cakeName || !price || !deliveryDate) {
      toast.error("يرجى تعبئة الحقول الأساسية وتاريخ التسليم");
      return;
    }
    setSubmitting(true);

    if (typeof window !== "undefined" && !navigator.onLine) {
      if (imageFile) {
        toast.error("لا يمكن إرفاق صور الطلبات أثناء انقطاع الإنترنت. يرجى إزالة الصورة أو الاتصال أولاً.", { duration: 5000 });
        setSubmitting(false);
        return;
      } else {
        toast.success("مقطوع الإنترنت لديك.. سيتم حفظ الطلب نصياً في الجهاز ورفعه لاحقاً.", { duration: 5000 });
      }
    }
    
    try {
      const numPrice = parseIqdInput(price);
      const numCost = cost ? parseIqdInput(cost) : 0;
      const profit = numCost > 0 ? numPrice - numCost : numPrice;

      const existingCustomer = customers.find(c => c.name === customerName);
      let customerId = existingCustomer?.id;
      
      if (!existingCustomer) {
        const custRef = await addDoc(collection(db, "customers"), {
          name: customerName, phone: customerPhone,
          address, platform,
          points: Math.floor(numPrice / 1000), totalSpent: numPrice,
          ordersCount: 1, createdAt: serverTimestamp(),
        });
        customerId = custRef.id;
      } else {
        const docRef = doc(db, "customers", customerId!);
        await updateDoc(docRef, {
          phone: customerPhone || existingCustomer.phone || "",
          address: address || existingCustomer.address || "",
          platform: platform || existingCustomer.platform || "واتساب",
          points: (existingCustomer.points || 0) + Math.floor(numPrice / 1000),
          totalSpent: (existingCustomer.totalSpent || 0) + numPrice,
          ordersCount: (existingCustomer.ordersCount || 0) + 1,
          lastOrder: serverTimestamp()
        });
      }

      let tempImageUrl = "";
      if (imageFile) {
        try {
          tempImageUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });
        } catch (e) {
          console.error("Base64 error", e);
        }
      }

      const newOrderRef = await addDoc(collection(db, "external_orders"), {
        customerId, customerName, customerPhone, address, platform, cakeName,
        price: numPrice, cost: numCost, profit,
        deliveryDate,      // حقل موحد مع باقي التطبيق
        deliveryTime: deliveryDate, // توافق مع السجلات القديمة
        imageUrl: "", tempImageUrl: tempImageUrl, createdAt: serverTimestamp(),
      });

      if (imageFile) {
        if (navigator.onLine) {
          toast.success("جاري رفع الصورة في الخلفية...", { icon: '⏳', duration: 3000 });
          const fileRef = ref(storage, `external_orders/${Date.now()}_${imageFile.name}`);
          uploadBytes(fileRef, imageFile).then(async () => {
            const url = await getDownloadURL(fileRef);
            await updateDoc(newOrderRef, { imageUrl: url, tempImageUrl: null });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('backgroundUploadSuccess'));
            }
          }).catch(() => {
             toast.error("تأجل رفع الصورة لعدم وجود إنترنت");
          });
        } else {
          toast.success("تم حفظ الصورة محلياً (أوفلاين)");
        }
      }

      toast.success("تم تسجيل الطلب بنجاح");
      onSuccess();
    } catch (e) {
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Image */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">صورة الطلب / الكيكة</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition relative overflow-hidden group"
        >
          {imagePreview ? (
            <div className="absolute inset-0 w-full h-full">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 bg-pink-50 dark:bg-pink-900/20 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-gray-800 dark:text-gray-200">التقط صورة للطلب</p>
                <p className="text-xs text-gray-500 mt-1">اضغط لفتح الكاميرا أو المعرض</p>
              </div>
            </>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>
      </div>

      {/* الصف الأول: اسم الزبون والمنصة */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الزبون</label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" value={customerName} onChange={handleCustomerNameChange}
              onFocus={() => setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="اسم الزبون"
            />
            {showCustomerDropdown && customerName && (
              <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
                {customers.filter(c => c.name.includes(customerName)).map(c => (
                  <li 
                    key={c.id} 
                    onClick={() => selectCustomer(c.name, c.phone, c.address, c.platform)}
                    className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-gray-800 dark:text-gray-200 border-b border-gray-50 dark:border-zinc-700/50 last:border-0 flex justify-between items-center"
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] text-gray-400">{c.platform || "واتساب"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">منصة الطلب</label>
          <div className="relative">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none appearance-none font-bold text-gray-700 dark:text-gray-200"
            >
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* الصف الثاني: رقم الهاتف والعنوان */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">رقم الهاتف</label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left"
              placeholder="07..." dir="ltr"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">العنوان</label>
          <div className="relative">
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
              placeholder="مثال: مجمع A بلوك 5 عمارة 508 شقة 511"
            />
          </div>
        </div>
      </div>

      {/* الصف الثالث: اسم الكيكة */}
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الكيكة / المنتج</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={cakeName} onChange={e => setCakeName(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
            placeholder="مثال: كيكة شوكولاتة"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">سعر البيع</label>
          <div className="relative">
            <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <FormattedNumberInput
              value={price}
              onChange={setPrice}
              placeholder="السعر"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التكلفة (اختياري)</label>
          <div className="relative">
            <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <FormattedNumberInput
              value={cost}
              onChange={setCost}
              placeholder="التكلفة"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left"
            />
          </div>
        </div>
      </div>

      <div className="z-20 relative">
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">وقت وتاريخ التسليم</label>
        <div className="relative">
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <DatePicker
            selected={deliveryDate ? new Date(deliveryDate) : null}
            onChange={(date: Date | null) => setDeliveryDate(date ? date.toISOString() : new Date().toISOString())}
            locale={ar}
            showTimeSelect
            timeFormat="h:mm aa"
            timeIntervals={30}
            timeCaption="الوقت"
            dateFormat="yyyy/MM/dd h:mm aa"
            placeholderText="اختر التاريخ والوقت"
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:border-emerald-400 focus:outline-none text-right"
            withPortal
            required
          >
            <div className="p-2 border-t border-gray-200 dark:border-zinc-700 mt-2 flex justify-end">
              <button type="button" className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm" onClick={() => {
                document.querySelector('.react-datepicker__portal')?.remove();
                document.body.classList.remove('react-datepicker-portal-open');
                const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                document.dispatchEvent(escapeEvent);
              }}>تم ✔</button>
            </div>
          </DatePicker>
        </div>
      </div>


      <button
        onClick={submitSale}
        disabled={submitting || isOffline}
        className="w-full bg-gradient-to-l from-[#0D0A1A] to-[#1a0d2e] text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95 transition disabled:opacity-50"
      >
        {isOffline ? "الإضافة معطلة (مقطوع الانترنت)" : submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الطلب"}
      </button>
    </div>
  );
}
