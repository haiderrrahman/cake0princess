"use client";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ChevronLeft, Upload, Loader2, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function CustomDesign() {
  const { user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [size, setSize] = useState("يكفي 5 أشخاص");
  const [filling, setFilling] = useState("شوكولاتة");
  const [dough, setDough] = useState("فانيلا");
  const [notes, setNotes] = useState("");

  const SIZES = ["يكفي 5 أشخاص", "يكفي 10 أشخاص", "يكفي 20 شخص", "طابقين (30 شخص)", "ثلاث طوابق وأكثر"];
  const FILLINGS = ["شوكولاتة", "فراولة", "توت بري", "كراميل", "كريمة ليمون", "مكسرات", "لوتس"];
  const DOUGHS = ["فانيلا", "شوكولاتة", "ريد فيلفيت", "قهوة", "جزر"];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("يرجى تسجيل الدخول أولاً لتقديم طلب تصميم خاص.");
      router.push("/login?redirect=/custom-design");
      return;
    }

    if (!imageFile) {
      toast.error("الرجاء رفع صورة للتصميم المطلوب");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload image
      const storageRef = ref(storage, `custom_orders/${user.uid}_${Date.now()}_${imageFile.name}`);
      await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(storageRef);

      // 2. Save to Firestore
      await addDoc(collection(db, "custom_orders"), {
        userId: user.uid,
        userName: user.displayName || "زبون",
        userEmail: user.email,
        imageUrl,
        size,
        filling,
        dough,
        notes,
        status: "pending", // pending, accepted, rejected, completed
        createdAt: new Date().toISOString()
      });

      setSuccess(true);
    } catch (error) {
      console.error("Error submitting custom order:", error);
      toast.error("حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
    }
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center animate-slide-up">
        <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-3">تم إرسال طلبك بنجاح!</h1>
        <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">سنقوم بمراجعة تصميمك والتواصل معك قريباً لتأكيد السعر وموعد الاستلام.</p>
        <Link href="/" className="bg-[#e8456b] text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg hover:bg-[#d4394f] transition">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24">
      <header className="bg-white dark:bg-zinc-900 px-5 py-4 pt-4 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-full">
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-black text-gray-900 dark:text-white">تصميم كيكة خاصة</h1>
      </header>

      <div className="p-5">
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-4 rounded-2xl flex gap-3 mb-6 items-start text-sm leading-relaxed">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>ارفع صورة لأي تصميم يعجبك، وسنقوم بتنفيذه لك بكل حب! سيتم تحديد السعر لاحقاً بعد معاينة التصميم.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">صورة التصميم المطلوب <span className="text-red-500">*</span></label>
            <div className="relative w-full h-48 bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-3xl overflow-hidden flex flex-col items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-800 transition cursor-pointer">
              {imagePreview ? (
                <>
                  <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <span className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-xl">تغيير الصورة</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-pink-50 dark:bg-pink-500/10 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">اضغط لرفع صورة التصميم</span>
                  <p className="text-[10px] text-gray-400 mt-1">PNG, JPG, JPEG</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
            </div>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">القياس / الحجم</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#e8456b]/30 outline-none">
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Dough */}
          <div className="space-y-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">نكهة العجين</label>
            <div className="flex flex-wrap gap-2">
              {DOUGHS.map(d => (
                <button 
                  key={d} type="button" 
                  onClick={() => setDough(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${dough === d ? "bg-[#e8456b] text-white border-[#e8456b]" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Fillings */}
          <div className="space-y-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">نوع الحشوة</label>
            <div className="flex flex-wrap gap-2">
              {FILLINGS.map(f => (
                <button 
                  key={f} type="button" 
                  onClick={() => setFilling(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${filling === f ? "bg-[#d4a853] text-white border-[#d4a853]" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-zinc-700"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">ملاحظات إضافية (اختياري)</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="اكتب أي تفاصيل أخرى، مثل عبارة تُكتب على الكيكة..." 
              className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 text-sm min-h-[100px] focus:ring-2 focus:ring-[#e8456b]/30 outline-none"
            ></textarea>
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            disabled={submitting || !imageFile}
            className="w-full bg-[#e8456b] hover:bg-[#d4394f] disabled:bg-[#e8456b]/50 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إرسال طلب التصميم"}
          </button>
          
        </form>
      </div>
    </div>
  );
}
