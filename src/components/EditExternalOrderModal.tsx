import { useState, useRef, useEffect } from "react";
import { X, Check, Loader2, Camera, Upload, Phone, User, Calendar, Tag, Coins, MapPin } from "lucide-react";
import { doc, updateDoc, collection, getDocs, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import "react-datepicker/dist/react-datepicker.css";
import { BISMAYAH_BUILDINGS, BISMAYAH_APARTMENTS } from "./BismayahData";

const PLATFORMS = ["إنستجرام", "واتساب", "فيسبوك", "تيك توك", "هاتف", "أخرى"];

const toDatetimeLocal = (isoString: string) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function EditExternalOrderModal({ isOpen, onClose, order, onEditSuccess }: any) {
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [platform, setPlatform] = useState("واتساب");
  const [address, setAddress] = useState("");
  const [cakeName, setCakeName] = useState("");
  const [price, setPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState<string | number>("");
  const [cost, setCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New location states
  const [deliveryType, setDeliveryType] = useState<"bismayah" | "other" | "door">("other");
  const [bismayahComplex, setBismayahComplex] = useState("A");
  const [bismayahBuilding, setBismayahBuilding] = useState("");
  const [bismayahApt, setBismayahApt] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [manualDeliveryFee, setManualDeliveryFee] = useState("");

  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "customers")).then(snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (order && isOpen) {
      setCustomerName(order.customerName || "");
      setCustomerPhone(order.customerPhone || "");
      setPlatform(order.platform || "واتساب");
      setAddress(order.address || "");
      setCakeName(order.cakeName || "");
      setPrice(order.price || "");
      setPaidAmount(order.paidAmount !== undefined ? order.paidAmount : (order.price || ""));
      setCost(order.cost || "");
      setDeliveryDate(order.deliveryDate || "");
      setImagePreview(order.imageUrl || null);
      
      
      const oldAddress = order.address || "";
      let isDoor = oldAddress === "تسليم باب الشقة بدون توصيل" || order.deliveryType === "door";
      let isBism = order.deliveryType === "bismayah" || order.isBismayah || (oldAddress.startsWith("مجمع") && oldAddress.includes("عمارة") && (oldAddress.includes("شقة") || oldAddress.includes("ارضي")));
      
      if (isDoor) {
        setDeliveryType("door");
      } else if (isBism) {
        setDeliveryType("bismayah");
      } else {
        setDeliveryType("other");
      }

      if (isBism && !order.isBismayah) {
         // Legacy address parsing
         const match = oldAddress.match(/مجمع\s+(.)\s+عمارة\s+(\d+)\s+(.+)/);
         if (match) {
           setBismayahComplex(match[1]);
           setBismayahBuilding(match[2]);
           setBismayahApt(match[3].replace(/^(شقة\s*)+/g, '').trim()); // clean up any "شقة" from legacy DB
         } else {
           setBismayahComplex("A");
           setBismayahBuilding("");
           setBismayahApt("");
         }
      } else {
         setBismayahComplex(order.bismayahComplex || "A");
         setBismayahBuilding(order.bismayahBuilding || "");
         setBismayahApt(order.bismayahApt || "");
      }

      setLocationUrl(order.locationUrl || "");
      setManualDeliveryFee(isBism || isDoor ? "" : (order.deliveryFee || ""));
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImagePreview(URL.createObjectURL(file));
      try {
        const compressed = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1200, useWebWorker: false });
        setImageFile(compressed);
      } catch (err) {
        console.error("Compression error:", err);
        setImageFile(file);
      }
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomerName(name);
    setShowCustomerDropdown(true);
    const existing = customers.find(c => c.name === name);
    if (existing) {
      if (existing.phone) setCustomerPhone(existing.phone);
      if (existing.address) setAddress(existing.address);
      if (existing.platform) setPlatform(existing.platform);
      if (existing.locationUrl) setLocationUrl(existing.locationUrl);
    }
  };

  const selectCustomer = (name: string, phone: string, addr: string, plat: string, locUrl?: string) => {
    setCustomerName(name);
    if (phone) setCustomerPhone(phone);
    if (addr) {
      setAddress(addr);
      if (addr === "تسليم باب الشقة بدون توصيل") {
        setDeliveryType("door");
      } else if (addr.includes("مجمع") && addr.includes("عمارة")) {
        setDeliveryType("bismayah");
      } else {
        setDeliveryType("other");
      }
    }
    if (plat) setPlatform(plat);
    if (locUrl) setLocationUrl(locUrl);
    setShowCustomerDropdown(false);
  };

  const parseIqdInput = (val: string | number) => {
    let num = Number(val) || 0;
    if (num > 0 && num < 1000) num *= 1000;
    return num;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const numPrice = parseIqdInput(price);
      const numCost = parseIqdInput(cost);
      const numPaidAmount = parseIqdInput(paidAmount);
      const isDebtSettled = numPaidAmount === numPrice;

      let tempImageUrl = "";
      if (imageFile) {
        try {
          tempImageUrl = await fileToBase64(imageFile);
        } catch (e) {
          console.error("Base64 error", e);
        }
      }

      const computedDeliveryFee = deliveryType === "bismayah" 
        ? (bismayahComplex === "A" ? 1000 : 2000) 
        : deliveryType === "door" ? 0
        : parseIqdInput(manualDeliveryFee);
        
      const totalPriceWithDelivery = numPrice + computedDeliveryFee;
      
      const aptText = bismayahApt.startsWith("ارضي") ? bismayahApt : (bismayahApt ? `شقة ${bismayahApt.replace(/^(شقة\s*)+/g, '')}` : "");
      let computedAddress = address;
      if (deliveryType === "bismayah") {
        computedAddress = `مجمع ${bismayahComplex} عمارة ${bismayahBuilding} ${aptText}`.trim();
      } else if (deliveryType === "door") {
        computedAddress = "تسليم باب الشقة بدون توصيل";
      }

      let finalLocationUrl = locationUrl;
      
      // Try to extract coordinates from locationUrl first, then from computedAddress
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

      // Instantly update the document so the UI responds without waiting for image
      await updateDoc(doc(db, "external_orders", order.id), {
        customerName,
        customerPhone,
        platform,
        address: computedAddress,
        cakeName,
        price: numPrice,
        paidAmount: numPaidAmount,
        isDebtSettled,
        cost: numCost,
        profit: numCost > 0 ? numPrice - numCost : numPrice,
        isBismayah: deliveryType === "bismayah", bismayahComplex, bismayahBuilding, bismayahApt, deliveryType,
        deliveryFee: computedDeliveryFee, totalPriceWithDelivery, locationUrl: finalLocationUrl,
        deliveryDate,
        ...(tempImageUrl ? { tempImageUrl } : {})
      });

      // Update customer profile
      const existingCustomer = customers.find(c => c.name === customerName);
      if (existingCustomer) {
        await updateDoc(doc(db, "customers", existingCustomer.id), {
          phone: customerPhone || existingCustomer.phone || "",
          address: computedAddress || existingCustomer.address || "",
          platform: platform || existingCustomer.platform || "واتساب",
          ...(finalLocationUrl ? { locationUrl: finalLocationUrl } : {}),
          totalSpent: (existingCustomer.totalSpent || 0) - parseIqdInput(order.price) + numPrice
        });
      } else {
        await addDoc(collection(db, "customers"), {
          name: customerName,
          phone: customerPhone,
          address: computedAddress,
          platform: platform || "واتساب",
          points: Math.floor(numPrice / 1000),
          totalSpent: numPrice
        });
      }

      if (imageFile) {
        if (navigator.onLine) {
          toast.success("جاري رفع الصورة في الخلفية...", { icon: '⏳', duration: 4000 });
          const fileRef = ref(storage, `external_orders/${Date.now()}_${imageFile.name}`);
          uploadBytes(fileRef, imageFile).then(async () => {
            const url = await getDownloadURL(fileRef);
            await updateDoc(doc(db, "external_orders", order.id), { imageUrl: url, tempImageUrl: null });
            window.dispatchEvent(new CustomEvent('backgroundUploadSuccess'));
          }).catch(err => {
            console.error("Image upload error:", err);
            toast.error("تأجل رفع الصورة لعدم وجود إنترنت");
          });
        } else {
          toast.success("تم حفظ الصورة محلياً (أوفلاين)");
        }
      }

      toast.success("تم التعديل بنجاح", {
        style: { background: '#10B981', color: '#fff', borderRadius: '16px' }
      });
      onEditSuccess({
        ...order,
        customerName,
        customerPhone,
        platform,
        address: computedAddress,
        cakeName,
        price: numPrice,
        paidAmount: numPaidAmount,
        isDebtSettled,
        cost: numCost,
        profit: numCost > 0 ? numPrice - numCost : numPrice,
        isBismayah: deliveryType === "bismayah", bismayahComplex, bismayahBuilding, bismayahApt, deliveryType,
        deliveryFee: computedDeliveryFee, totalPriceWithDelivery, locationUrl,
        deliveryDate,
        ...(tempImageUrl ? { tempImageUrl } : {})
      });
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
        
        <div className="relative bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl text-right flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-black text-xl text-gray-900 dark:text-white">تعديل الطلب</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
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
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
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
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الزبون</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" value={customerName} onChange={handleNameChange} required
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="اسم الزبون"
                  />
                </div>
                {showCustomerDropdown && customerName && (
                  <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
                    {customers.filter(c => c.name.includes(customerName)).map(c => (
                      <li 
                        key={c.id} 
                        onClick={() => selectCustomer(c.name, c.phone, c.address, c.platform)}
                        className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer flex justify-between items-center transition"
                      >
                        <span className="font-bold text-gray-900 dark:text-white text-sm">{c.name}</span>
                        {(c.phone || c.platform) && (
                          <span className="text-xs text-gray-400 font-medium">
                            {c.platform} {c.phone ? `- ${c.phone}` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                    {customers.filter(c => c.name.includes(customerName)).length === 0 && (
                      <li className="px-4 py-3 text-sm text-gray-500 font-bold text-center">
                        زبون جديد
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">منصة الطلب</label>
                <div className="relative">
                  <select
                    value={platform}
                    onChange={e => setPlatform(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none font-bold text-gray-700 dark:text-gray-200"
                  >
                    {PLATFORMS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* الصف الثاني: رقم الهاتف */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">رقم الهاتف</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                    placeholder="07..." dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2 border border-gray-200 dark:border-zinc-700 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">العنوان</label>
                <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
                  <button 
                    type="button"
                    onClick={() => setDeliveryType("bismayah")}
                    className={`text-[9px] sm:text-[10px] px-2 py-1 font-bold rounded-md transition flex-1 ${deliveryType === "bismayah" ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    داخل بسماية
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDeliveryType("other")}
                    className={`text-[9px] sm:text-[10px] px-2 py-1 font-bold rounded-md transition flex-1 ${deliveryType === "other" ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    مناطق أخرى
                  </button>
                  <button 
                    type="button"
                    onClick={() => setDeliveryType("door")}
                    className={`text-[9px] sm:text-[10px] px-2 py-1 font-bold rounded-md transition flex-1 ${deliveryType === "door" ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    باب الشقة
                  </button>
                </div>
              </div>
              
              {deliveryType === "bismayah" ? (
                <div className="grid grid-cols-3 gap-2">
                  <select value={bismayahComplex} onChange={e => setBismayahComplex(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold">
                    <option value="A">مجمع A</option>
                    <option value="B">مجمع B</option>
                    <option value="C">مجمع C</option>
                    <option value="D">مجمع D</option>
                    <option value="E">مجمع E</option>
                    {["A","B","C","D","E","F","G","H"].map(c => <option key={c} value={c}>مجمع {c}</option>)}
                  </select>
                  <select value={bismayahBuilding} onChange={e => setBismayahBuilding(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold">
                    <option value="">عمارة</option>
                    {BISMAYAH_BUILDINGS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select value={bismayahApt} onChange={e => setBismayahApt(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold">
                    <option value="">شقة</option>
                    {BISMAYAH_APARTMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              ) : deliveryType === "other" ? (
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="العنوان..." />
                </div>
              ) : null}
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">الرابط الجغرافي</label>
                <input type="text" value={locationUrl} onChange={e => setLocationUrl(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-left" placeholder="لصق الرابط..." dir="ltr" />
              </div>
            </div>

            {/* الصف الثالث: اسم الكيكة */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">اسم الكيكة / المنتج</label>
              <div className="relative">
                <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" value={cakeName} onChange={e => setCakeName(e.target.value)} required
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="مثال: كيكة شوكولاتة"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">سعر البيع</label>
                <div className="relative">
                  <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <FormattedNumberInput
                    required
                    value={price}
                    onChange={setPrice}
                    placeholder="السعر"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">المُستلم</label>
                <div className="relative">
                  <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <FormattedNumberInput
                    required
                    value={paidAmount}
                    onChange={setPaidAmount}
                    placeholder="المُستلم"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">التكلفة</label>
                <div className="relative">
                  <Coins className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <FormattedNumberInput
                    value={cost}
                    onChange={setCost}
                    placeholder="التكلفة"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {deliveryType === "bismayah" ? (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تكلفة التوصيل (تلقائي)</label>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-black text-center text-gray-600 dark:text-gray-300">
                    {bismayahComplex === "A" ? "1,000" : "2,000"} د.ع
                  </div>
                </div>
              ) : deliveryType === "other" ? (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تكلفة التوصيل (يدوي)</label>
                  <FormattedNumberInput
                    value={manualDeliveryFee}
                    onChange={setManualDeliveryFee}
                    placeholder="مبلغ التوصيل"
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-center font-bold"
                  />
                </div>
              ) : (
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">تكلفة التوصيل</label>
                  <div className="w-full bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-black text-center text-gray-600 dark:text-gray-300">
                    بدون توصيل (0 د.ع)
                  </div>
                </div>
              )}
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex justify-between items-center text-sm font-black">
                <span className="text-gray-700 dark:text-gray-300">
                  {(deliveryType === "bismayah" || (Number(manualDeliveryFee.toString().replace(/,/g, '')) || 0) > 0) ? "المبلغ الكلي مع التوصيل:" : "المبلغ الكلي:"}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">
                  {((Number(price.toString().replace(/,/g, '')) || 0) + (deliveryType === "bismayah" ? (bismayahComplex === "A" ? 1000 : 2000) : deliveryType === "door" ? 0 : (Number(manualDeliveryFee.toString().replace(/,/g, '')) || 0))).toLocaleString()} <span className="text-[10px]">د.ع</span>
                </span>
              </div>
            </div>

            <div className="z-20 relative">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">وقت وتاريخ التسليم</label>
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
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm font-black focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right appearance-none"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-l from-emerald-600 to-emerald-500 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-6 shadow-lg shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} حفظ التعديلات
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
