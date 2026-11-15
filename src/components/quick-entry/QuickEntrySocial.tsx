"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Phone, User, Calendar, Tag, Coins, Loader2, MapPin, Calculator, Sparkles, ChefHat } from "lucide-react";
import { collection, addDoc, updateDoc, serverTimestamp, getDocs, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale/ar";
import { BISMAYAH_BUILDINGS, BISMAYAH_APARTMENTS } from "../BismayahData";
import CakeCostBreakdownModal from "@/components/CakeCostBreakdownModal";
import { CakeCostBreakdown } from "@/lib/cakeCostCalculator";
import CustomerNameInput from "@/components/CustomerNameInput";
import {
  CustomerSuggestion,
  describeFirebaseError,
  imageFieldsFor,
  prepareOrderImage,
  saveFullOrderImage,
  parseIqdInput,
  saveCustomerFromOrder,
  useCustomerDirectory,
  withSoftTimeout,
} from "@/lib/socialOrders";

const PLATFORMS = ["إنستجرام", "واتساب", "فيسبوك", "تيك توك", "هاتف", "أخرى"];

const toDatetimeLocal = (isoString: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function QuickEntrySocial({ onSuccess }: { onSuccess: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [platform, setPlatform] = useState("واتساب");
  const [address, setAddress] = useState("");
  const [cakeName, setCakeName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [costBreakdown, setCostBreakdown] = useState<CakeCostBreakdown | null>(null);
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString());

  // New location states
  const [deliveryType, setDeliveryType] = useState<"bismayah" | "other" | "door">("other");
  const [bismayahComplex, setBismayahComplex] = useState("A");
  const [bismayahBuilding, setBismayahBuilding] = useState("");
  const [bismayahApt, setBismayahApt] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [manualDeliveryFee, setManualDeliveryFee] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // دليل الزبائن: من الطلبات السابقة + مجموعة customers (انظر lib/socialOrders)
  const { directory } = useCustomerDirectory();

  useEffect(() => {
    if (typeof navigator !== "undefined") setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

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

  // تعبئة بيانات الزبون المختار (الدليل يحمل أحدث هاتف/عنوان/موقع من طلباته السابقة)
  const applyCustomer = (c: CustomerSuggestion) => {
    if (c.phone) setCustomerPhone(c.phone);
    if (c.address) {
      setAddress(c.address);
      if (c.address === "تسليم باب الشقة بدون توصيل") {
        setDeliveryType("door");
      } else if (c.address.includes("مجمع") && c.address.includes("عمارة")) {
        setDeliveryType("bismayah");
      } else {
        setDeliveryType("other");
      }
    }
    if (c.platform) setPlatform(c.platform);
    if (c.locationUrl) setLocationUrl(c.locationUrl);
  };

  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name);
  };

  const submitSale = async () => {
    if (!customerName || !cakeName || !price || !deliveryDate) {
      toast.error("يرجى تعبئة الحقول الأساسية وتاريخ التسليم");
      return;
    }
    setSubmitting(true);

    // لا يوجد تخزين دائم للكتابات المعلّقة، فالحفظ بدون إنترنت كان يضيع عند إغلاق الصفحة.
    // الأصدق أن نمنع الحفظ ونُبقي البيانات في النموذج حتى يعود الاتصال.
    if (typeof window !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت — لم يُحفظ الطلب. بياناتك باقية في النموذج، أعد المحاولة عند رجوع الاتصال.", { duration: 6000 });
      setSubmitting(false);
      return;
    }

    try {
      const numPrice = parseIqdInput(price);
      const numCost = cost ? parseIqdInput(cost) : 0;
      
      const computedDeliveryFee = deliveryType === "bismayah" 
        ? (bismayahComplex === "A" ? 1000 : 2000) 
        : deliveryType === "door" ? 0 
        : parseIqdInput(manualDeliveryFee);
        
      const totalPriceWithDelivery = numPrice + computedDeliveryFee;
      const profit = numCost > 0 ? numPrice - numCost : numPrice;

      let computedAddress = address;
      const aptText = bismayahApt ? `شقة ${bismayahApt}` : "";
      if (deliveryType === "bismayah") {
        computedAddress = `مجمع ${bismayahComplex} عمارة ${bismayahBuilding} ${aptText}`.trim();
      } else if (deliveryType === "door") {
        computedAddress = "تسليم باب الشقة بدون توصيل";
      }

      let finalLocationUrl = deliveryType === "door" ? "" : locationUrl;
      const extractCoords = (text: string) => {
        if (!text) return null;
        const match = text.match(/[(]?\s*([+-]?\d{1,2}\.\d+)[,\s]+([+-]?\d{1,3}\.\d+)\s*[)]?/);
        if (match) {
          return `https://www.google.com/maps/search/?api=1&query=${match[1]},${match[2]}`;
        }
        return null;
      };

      const extractedFromLoc = extractCoords(locationUrl);
      const extractedFromAddr = extractCoords(computedAddress);
      
      if (extractedFromLoc) {
        finalLocationUrl = extractedFromLoc;
      } else if (extractedFromAddr) {
        finalLocationUrl = extractedFromAddr;
      }

      const cleanName = customerName.replace(/\s+/g, " ").trim();
      const customerId = (await withSoftTimeout(
        saveCustomerFromOrder(
          directory,
          { name: cleanName, phone: customerPhone, address: computedAddress, platform, locationUrl: finalLocationUrl },
          { orderAmount: numPrice }
        ),
        2500
      )) || null;

      // مصغّرة خفيفة داخل الطلب؛ الصورة الكاملة في مستند منفصل (external_order_images)
      const prepared = imageFile ? await prepareOrderImage(imageFile) : null;

      const newOrderRef = await addDoc(collection(db, "external_orders"), {
        customerId, customerName: cleanName, customerPhone, address: computedAddress, platform, cakeName,
        price: numPrice, cost: numCost,
        costBreakdown: costBreakdown ? JSON.parse(JSON.stringify(costBreakdown)) : null,
        profit,
        status: "pending",
        isBismayah: deliveryType === "bismayah", bismayahComplex, bismayahBuilding, bismayahApt, deliveryType,
        deliveryFee: computedDeliveryFee, totalPriceWithDelivery, locationUrl: finalLocationUrl,
        deliveryDate,      // حقل موحد مع باقي التطبيق
        deliveryTime: deliveryDate, // توافق مع السجلات القديمة
        imageUrl: "",
        ...imageFieldsFor(prepared),
        createdAt: serverTimestamp(),
      });

      if (prepared) {
        saveFullOrderImage(newOrderRef.id, prepared.full).then((res) => {
          if (!res.ok) toast.error(`حُفظ الطلب لكن تعذر حفظ الصورة الكاملة (تبقى المصغّرة): ${res.reason}`, { duration: 7000 });
        });
      }

      toast.success("تم تسجيل الطلب بنجاح");
      onSuccess();
    } catch (e) {
      console.error("QuickEntrySocial save error:", e);
      toast.error(`تعذر تسجيل الطلب: ${describeFirebaseError(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-gray-900 dark:text-slate-100">
      {/* Upload Image */}
      <div>
        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">صورة الطلب / الكيكة</label>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer bg-gray-50/70 dark:bg-zinc-900/50 hover:bg-gray-100 dark:hover:bg-zinc-800/50 transition relative overflow-hidden group"
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
              <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-gray-900 dark:text-gray-100">التقط صورة للطلب</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">اضغط لفتح الكاميرا أو المعرض</p>
              </div>
            </>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">اسم الزبون</label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
            <CustomerNameInput
              value={customerName}
              onChange={handleCustomerNameChange}
              onPick={applyCustomer}
              directory={directory}
              inputClassName="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 pr-10 text-sm font-bold focus:ring-2 focus:ring-pink-500 outline-none shadow-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">منصة الطلب</label>
          <div className="relative">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none appearance-none font-bold shadow-sm"
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
        <div className="col-span-2">
          <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">رقم الهاتف</label>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 pr-10 text-sm font-bold focus:ring-2 focus:ring-pink-500 outline-none text-left shadow-sm"
              placeholder="07..." dir="ltr"
            />
          </div>
        </div>
      </div>

      <div className="col-span-2 border border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/30 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-gray-800 dark:text-slate-200">العنوان</label>
          <div className="flex gap-1 bg-gray-200/80 dark:bg-zinc-800 p-1 rounded-xl border border-gray-200 dark:border-zinc-700">
            <button 
              type="button"
              onClick={() => setDeliveryType("bismayah")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 font-bold rounded-lg transition flex-1 ${deliveryType === "bismayah" ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              داخل بسماية
            </button>
            <button 
              type="button"
              onClick={() => setDeliveryType("other")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 font-bold rounded-lg transition flex-1 ${deliveryType === "other" ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              مناطق أخرى
            </button>
            <button 
              type="button"
              onClick={() => setDeliveryType("door")}
              className={`text-[10px] sm:text-xs px-2.5 py-1 font-bold rounded-lg transition flex-1 ${deliveryType === "door" ? 'bg-pink-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              باب الشقة
            </button>
          </div>
        </div>
        
        {deliveryType === "bismayah" ? (
          <div className="grid grid-cols-3 gap-2">
            <select value={bismayahComplex} onChange={e => setBismayahComplex(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none font-bold shadow-sm">
              <option value="A">مجمع A</option>
              <option value="B">مجمع B</option>
              <option value="C">مجمع C</option>
              <option value="D">مجمع D</option>
              <option value="E">مجمع E</option>
              <option value="F">مجمع F</option>
              <option value="G">مجمع G</option>
              <option value="H">مجمع H</option>
            </select>
            <select value={bismayahBuilding} onChange={e => setBismayahBuilding(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-center font-bold shadow-sm">
              <option value="">عمارة</option>
              {BISMAYAH_BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={bismayahApt} onChange={e => setBismayahApt(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-center font-bold shadow-sm">
              <option value="">شقة</option>
              {BISMAYAH_APARTMENTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        ) : deliveryType === "other" ? (
          <div className="relative">
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 pr-10 text-sm font-bold focus:ring-2 focus:ring-pink-500 outline-none shadow-sm"
              placeholder="المنطقة، الشارع، أقرب دالة..."
            />
          </div>
        ) : null}
        
        {deliveryType !== "door" && (
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">الرابط الجغرافي (Google Maps / Waze)</label>
            <input 
              type="text" value={locationUrl} onChange={e => setLocationUrl(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-left shadow-sm"
              placeholder="لصق الرابط هنا..." dir="ltr"
            />
          </div>
        )}
      </div>

      {/* الصف الثالث: اسم الكيكة */}
      <div>
        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">اسم الكيكة / المنتج</label>
        <div className="relative">
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" value={cakeName} onChange={e => setCakeName(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 pr-10 text-sm font-bold focus:ring-2 focus:ring-pink-500 outline-none shadow-sm"
            placeholder="مثال: كيكة شوكولاتة"
          />
        </div>
      </div>

      {/* بطاقة تكلفة الكيكة بالمقادير والأوزان والمصاريف التشغيلية */}
      <div className="border border-pink-200 dark:border-pink-900/60 bg-gradient-to-br from-pink-50/80 via-white to-purple-50/60 dark:from-pink-950/20 dark:via-zinc-900 dark:to-purple-950/20 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 rounded-xl">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-gray-900 dark:text-white block">تكلفة الكيكة (المقادير ومصاريف الصنع)</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">حساب مفصل بالغرام والسعر + تعب يد + كهرباء وطباعة</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCostCalculator(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{costBreakdown ? "تعديل تفاصيل المقادير" : "حساب المقادير والتكلفة"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">إجمالي التكلفة (د.ع)</label>
            <FormattedNumberInput
              value={cost}
              onChange={(val) => {
                setCost(val);
                if (!val) setCostBreakdown(null);
              }}
              placeholder="0"
              className="w-full bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-900/60 rounded-xl px-3 py-2 text-xs font-black text-pink-700 dark:text-pink-300 outline-none focus:ring-2 focus:ring-pink-500 shadow-sm text-left"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">الربح الصافي التقديري</label>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-between shadow-sm min-h-[34px]">
              <span>{((Number(price.replace(/,/g, '')) || 0) - (Number(cost.replace(/,/g, '')) || 0)).toLocaleString()} د.ع</span>
              {Number(price.replace(/,/g, '')) > 0 && Number(cost.replace(/,/g, '')) > 0 && (
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-black">
                  {Math.round((((Number(price.replace(/,/g, '')) || 0) - (Number(cost.replace(/,/g, '')) || 0)) / (Number(price.replace(/,/g, '')) || 1)) * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {costBreakdown && (
          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-pink-100 dark:border-pink-950/40 text-[10px] font-bold text-gray-600 dark:text-gray-400">
            <span className="bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-md font-black">
              ✓ تم تفصيل {costBreakdown.ingredients.length} مادة
            </span>
            <span>مواد: {costBreakdown.totalIngredientsCost.toLocaleString()} د.ع</span>
            <span>+</span>
            <span>تشغيل وتعب: {costBreakdown.totalOverheadCost.toLocaleString()} د.ع</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">سعر البيع</label>
          <div className="relative">
            <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <FormattedNumberInput
              value={price}
              onChange={setPrice}
              placeholder="السعر"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-left font-black text-pink-600 dark:text-pink-400 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm"
            />
          </div>
        </div>
        
        {deliveryType === "bismayah" ? (
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">تكلفة التوصيل (تلقائي)</label>
            <div className="w-full bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-black text-center text-gray-700 dark:text-gray-300 shadow-sm">
              {bismayahComplex === "A" ? "1,000" : "2,000"} د.ع
            </div>
          </div>
        ) : deliveryType === "other" ? (
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">تكلفة التوصيل (يدوي)</label>
            <FormattedNumberInput
              value={manualDeliveryFee}
              onChange={setManualDeliveryFee}
              placeholder="مبلغ التوصيل"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 outline-none text-center font-bold placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">تكلفة التوصيل</label>
            <div className="w-full bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-black text-center text-gray-700 dark:text-gray-300 shadow-sm">
              بدون توصيل (0 د.ع)
            </div>
          </div>
        )}
      </div>

      <div className="bg-pink-50 dark:bg-pink-950/40 p-4 rounded-2xl border border-pink-200 dark:border-pink-800/40 shadow-sm">
        <div className="flex justify-between items-center text-sm font-black">
          <span className="text-gray-800 dark:text-slate-200">
            {(deliveryType === "bismayah" || (Number(manualDeliveryFee.replace(/,/g, '')) || 0) > 0) ? "المبلغ الكلي مع التوصيل:" : "المبلغ الكلي:"}
          </span>
          <span className="text-pink-600 dark:text-pink-400 text-lg font-black">
            {((Number(price.replace(/,/g, '')) || 0) + (deliveryType === "bismayah" ? (bismayahComplex === "A" ? 1000 : 2000) : deliveryType === "door" ? 0 : (Number(manualDeliveryFee.replace(/,/g, '')) || 0))).toLocaleString()} <span className="text-[10px]">د.ع</span>
          </span>
        </div>
      </div>

      <div className="z-20 relative">
        <label className="block text-xs font-bold text-gray-800 dark:text-slate-200 mb-2">وقت وتاريخ التسليم</label>
        <div className="relative">
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <input
            type="datetime-local"
            value={toDatetimeLocal(deliveryDate)}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setDeliveryDate(d.toISOString());
              } else {
                setDeliveryDate("");
              }
            }}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl px-4 py-3 pr-10 text-sm font-black focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-right appearance-none shadow-sm"
            required
          />
        </div>
      </div>

      <button
        onClick={submitSale}
        disabled={submitting || isOffline}
        className="w-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-3.5 sm:py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 mt-4 shadow-xl shadow-pink-500/25 active:scale-95 transition disabled:opacity-50"
      >
        {isOffline ? "الإضافة معطلة (مقطوع الانترنت)" : submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الطلب"}
      </button>

      {/* مودال تفصيل المقادير وتكلفة الكيكة */}
      <CakeCostBreakdownModal
        isOpen={showCostCalculator}
        onClose={() => setShowCostCalculator(false)}
        cakeName={cakeName}
        initialSellingPrice={parseIqdInput(price)}
        initialBreakdown={costBreakdown}
        onApplyCost={(totalCost, breakdown) => {
          setCost(totalCost.toString());
          setCostBreakdown(breakdown);
        }}
      />
    </div>
  );
}
