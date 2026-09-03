import { useState, useRef, useEffect } from "react";
import { X, Check, Loader2, Camera, Upload, Phone, User, Calendar, Tag, Coins, MapPin } from "lucide-react";
import { doc, updateDoc, collection, getDocs, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import { ar } from "date-fns/locale/ar";
import "react-datepicker/dist/react-datepicker.css";

const PLATFORMS = ["إنستجرام", "واتساب", "فيسبوك", "تيك توك", "هاتف", "أخرى"];

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
    }
  };

  const selectCustomer = (name: string, phone: string, addr: string, plat: string) => {
    setCustomerName(name);
    if (phone) setCustomerPhone(phone);
    if (addr) setAddress(addr);
    if (plat) setPlatform(plat);
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

      // Instantly update the document so the UI responds without waiting for image
      await updateDoc(doc(db, "external_orders", order.id), {
        customerName,
        customerPhone,
        platform,
        address,
        cakeName,
        price: numPrice,
        paidAmount: numPaidAmount,
        isDebtSettled,
        cost: numCost,
        profit: numCost > 0 ? numPrice - numCost : numPrice,
        deliveryDate,
        ...(tempImageUrl ? { tempImageUrl } : {})
      });

      // Update customer profile
      const existingCustomer = customers.find(c => c.name === customerName);
      if (existingCustomer) {
        await updateDoc(doc(db, "customers", existingCustomer.id), {
          phone: customerPhone || existingCustomer.phone || "",
          address: address || existingCustomer.address || "",
          platform: platform || existingCustomer.platform || "واتساب",
          totalSpent: (existingCustomer.totalSpent || 0) - parseIqdInput(order.price) + numPrice
        });
      } else {
        await addDoc(collection(db, "customers"), {
          name: customerName,
          phone: customerPhone,
          address,
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
        address,
        cakeName,
        price: numPrice,
        paidAmount: numPaidAmount,
        isDebtSettled,
        cost: numCost,
        profit: numCost > 0 ? numPrice - numCost : numPrice,
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

            {/* الصف الثاني: رقم الهاتف والعنوان */}
            <div className="grid grid-cols-2 gap-3">
              <div>
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
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">العنوان</label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" value={address} onChange={e => setAddress(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="مثال: مجمع A..."
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

            <div className="z-20 relative">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">وقت وتاريخ التسليم</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                <DatePicker
                  selected={deliveryDate ? new Date(deliveryDate) : null}
                  onChange={(date: Date | null) => setDeliveryDate(date ? date.toISOString() : '')}
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
