"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, Percent, X, ArrowRight } from "lucide-react";
import Link from "next/link";

type Offer = {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  discountPrice: number;
  image: string;
};

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "offers"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
      setOffers(items);
    } catch (error) {
      console.error("Error fetching offers:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOriginalPrice("");
    setDiscountPrice("");
    setImageFile(null);
    setEditingOffer(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (offer: Offer) => {
    setEditingOffer(offer);
    setTitle(offer.title);
    setDescription(offer.description || "");
    setOriginalPrice(offer.originalPrice.toString());
    setDiscountPrice(offer.discountPrice.toString());
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !originalPrice || !discountPrice) return;
    if (!editingOffer && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingOffer?.image || "";

      // 1. Upload image to Firebase Storage
      if (imageFile) {
        const storageRef = ref(storage, `offers/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // 2. Save to Firestore
      if (editingOffer) {
        await updateDoc(doc(db, "offers", editingOffer.id), {
          title,
          description,
          originalPrice: Number(originalPrice),
          discountPrice: Number(discountPrice),
          ...(imageFile ? { image: imageUrl } : {})
        });
      } else {
        await addDoc(collection(db, "offers"), {
          title,
          description,
          originalPrice: Number(originalPrice),
          discountPrice: Number(discountPrice),
          image: imageUrl,
          createdAt: new Date().toISOString()
        });
      }

      resetForm();
      fetchOffers();
    } catch (error) {
      console.error("Error saving offer:", error);
      toast.error("حدث خطأ أثناء الحفظ. تأكد من أنك تملك صلاحية المدير.");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا العرض؟"))) return;
    try {
      await deleteDoc(doc(db, "offers", id));
      setOffers(offers.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
            {/* ═══════════════ HEADER ═══════════════ */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">إدارة العروض الخاصة</h1>
              <p className="text-xs text-purple-200">تعديل وإضافة عروض للمتجر</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (isFormOpen) resetForm();
              else setIsFormOpen(true);
            }}
            className={`${isFormOpen ? 'bg-white/15 text-white border border-white/20 hover:bg-white/20' : 'bg-[#FF3366] hover:bg-[#e62e5c] text-white'} px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2 text-sm font-bold shadow-sm transition-colors`}
          >
            {isFormOpen ? <><X className="w-4 h-4" /> إلغاء</> : <><Plus className="w-4 h-4" /> إضافة</>}
          </button>
        </div>
      </div>

      <div className="px-5">

      {isFormOpen && (
        <form onSubmit={handleSaveOffer} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
          <h2 className="font-bold mb-4">{editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">عنوان العرض</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: باكدج كيكة + باقة ورد" />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">الوصف والتفاصيل</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400 min-h-[80px]" placeholder="مثال: احصل على كيكة تكفي 10 أشخاص مع..."></textarea>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">السعر الأصلي (د.ع)</label>
                <input required value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} type="number" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثلاً: 50000" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">السعر بعد الخصم (د.ع)</label>
                <input required value={discountPrice} onChange={e => setDiscountPrice(e.target.value)} type="number" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثلاً: 35000" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">صورة العرض {editingOffer && "(اختياري)"}</label>
              <input required={!editingOffer} type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-pink-600 hover:file:bg-pink-50" />
              {editingOffer && editingOffer.image && !imageFile && (
                <div className="mt-2 w-32 h-16 rounded-lg overflow-hidden relative border border-gray-100">
                  <img src={editingOffer.image} alt="Current Image" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <button disabled={uploading} type="submit" className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-purple-400 text-white font-bold py-3 rounded-xl shadow-md transition mt-4 flex justify-center items-center gap-2">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingOffer ? "تحديث العرض" : "حفظ العرض"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <div className="grid gap-4">
          {offers.map(offer => {
            const discountPercent = Math.round(((offer.originalPrice - offer.discountPrice) / offer.originalPrice) * 100);
            
            return (
              <div key={offer.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                  {offer.image ? (
                    <img src={offer.image} alt={offer.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 m-auto mt-5 text-gray-400" />
                  )}
                  {discountPercent > 0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-0.5">
                      <Percent className="w-3 h-3" /> {discountPercent}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">{offer.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-2">{offer.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#e8456b]">{offer.discountPrice.toLocaleString()} د.ع</span>
                    <span className="text-[10px] text-gray-400 line-through">{offer.originalPrice.toLocaleString()} د.ع</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditClick(offer)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(offer.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {offers.length === 0 && (
            <div className="text-center text-gray-500 py-10">لا توجد عروض بعد</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
