import { useState, useRef, useEffect } from "react";
import { X, Check, Loader2, Plus, ImageIcon } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import imageCompression from 'browser-image-compression';
import FormattedNumberInput from "@/components/FormattedNumberInput";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import { format } from "date-fns";
import { ar } from "date-fns/locale/ar";

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
  const [cakeName, setCakeName] = useState("");
  const [price, setPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState<string | number>("");
  const [cost, setCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (order && isOpen) {
      setCustomerName(order.customerName || "");
      setCustomerPhone(order.customerPhone || "");
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
        cakeName,
        price: numPrice,
        paidAmount: numPaidAmount,
        isDebtSettled,
        cost: numCost,
        profit: numCost > 0 ? numPrice - numCost : numPrice,
        deliveryDate,
        ...(tempImageUrl ? { tempImageUrl } : {})
      });

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
        style: { background: '#10B981', color: '#fff', borderRadius: '16px' },
        iconTheme: { primary: '#fff', secondary: '#10B981' },
      });
      onEditSuccess({
        ...order,
        customerName,
        customerPhone,
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
        
        <div className="relative bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-right flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-black text-xl">تعديل الطلب</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">اسم الزبون</label>
                <input required type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">رقم الموبايل (اختياري)</label>
                <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none text-right"
                  dir="ltr" placeholder="07..." />
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">وصف الطلب</label>
              <textarea required value={cakeName} onChange={e => setCakeName(e.target.value)} rows={2}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">تاريخ ووقت التسليم</label>
              <DatePicker
                selected={deliveryDate ? new Date(deliveryDate) : null}
                onChange={(date: Date | null) => setDeliveryDate(date ? date.toISOString() : '')}
                locale={ar}
                showTimeSelect
                timeFormat="h:mm aa"
                timeIntervals={30}
                timeCaption="الوقت"
                dateFormat="yyyy/MM/dd h:mm aa"
                placeholderText="اختر التاريخ والوقت..."
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
                wrapperClassName="w-full"
                withPortal
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">السعر (د.ع)</label>
                <FormattedNumberInput required value={price} onChange={val => setPrice(val)}
                  className="w-full border dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e8456b] text-sm" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">المُستلم (د.ع)</label>
                <FormattedNumberInput required value={paidAmount} onChange={val => setPaidAmount(val)}
                  className="w-full border dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">الكلفة (د.ع)</label>
                <FormattedNumberInput required value={cost} onChange={val => setCost(val)}
                  className="w-full border dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#e8456b] text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">صورة الكيكة</label>
              <div onClick={() => fileInputRef.current?.click()}
                className={`w-full h-24 border-2 border-dashed ${!imagePreview ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-zinc-700'} rounded-xl flex items-center justify-center gap-3 cursor-pointer transition relative overflow-hidden`}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                ) : null}
                <div className="relative z-10 flex items-center gap-2">
                  <ImageIcon className={`w-5 h-5 ${!imagePreview ? 'text-emerald-500' : 'text-gray-900 dark:text-white drop-shadow-md'}`} />
                  <span className={`text-sm font-bold ${!imagePreview ? 'text-emerald-600' : 'text-gray-900 dark:text-white drop-shadow-md'}`}>تغيير الصورة</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:bg-emerald-600 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} حفظ التعديلات
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
