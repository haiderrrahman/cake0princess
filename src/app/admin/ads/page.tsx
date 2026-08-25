"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, X, ArrowRight } from "lucide-react";
import Link from "next/link";

type Ad = {
  id: string;
  title: string;
  description: string;
  tag: string;
  link: string;
  image: string;
};

export default function AdminAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("إعلان");
  const [link, setLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "ads"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
      setAds(items);
    } catch (error) {
      console.error("Error fetching ads:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTag("إعلان");
    setLink("");
    setImageFile(null);
    setEditingAd(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (ad: Ad) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setDescription(ad.description || "");
    setTag(ad.tag || "إعلان");
    setLink(ad.link || "");
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !link) return;
    if (!editingAd && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingAd?.image || "";

      // 1. Upload image to Firebase Storage
      if (imageFile) {
        const storageRef = ref(storage, `ads/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // 2. Save ad to Firestore
      if (editingAd) {
        await updateDoc(doc(db, "ads", editingAd.id), {
          title,
          description,
          tag,
          link,
          ...(imageFile ? { image: imageUrl } : {})
        });
      } else {
        await addDoc(collection(db, "ads"), {
          title,
          description,
          tag,
          link,
          image: imageUrl,
          createdAt: new Date().toISOString()
        });
      }

      resetForm();
      fetchAds();
    } catch (error) {
      console.error("Error saving ad:", error);
      toast.error("حدث خطأ أثناء الحفظ. تأكد من أنك تملك صلاحية المدير.");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا الإعلان؟"))) return;
    try {
      await deleteDoc(doc(db, "ads", id));
      setAds(ads.filter(p => p.id !== id));
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
              <h1 className="text-xl font-black text-white">الإعلانات</h1>
              <p className="text-xs text-purple-200">إدارة الإعلانات الخارجية</p>
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
        <form onSubmit={handleSaveAd} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
          <h2 className="font-bold mb-4">{editingAd ? "تعديل الإعلان" : "إضافة إعلان جديد"}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">عنوان الإعلان</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: خصم خاص من شريكنا" />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">وصف قصير</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400 min-h-[80px]" placeholder="مثال: احصل على خصم 20% عند استخدام الكود..."></textarea>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">الكلمة الدلالية (التاج)</label>
                <input required value={tag} onChange={e => setTag(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: مساحة إعلانية" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">الرابط الخارجي (URL)</label>
                <input required value={link} onChange={e => setLink(e.target.value)} type="url" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="https://example.com" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">صورة الإعلان {editingAd && "(اختياري)"}</label>
              <input required={!editingAd} type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-pink-600 hover:file:bg-pink-50" />
              {editingAd && editingAd.image && !imageFile && (
                <div className="mt-2 w-32 h-16 rounded-lg overflow-hidden relative border border-gray-100">
                  <img src={editingAd.image} alt="Current Image" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <button disabled={uploading} type="submit" className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-purple-400 text-white font-bold py-3 rounded-xl shadow-md transition mt-4 flex justify-center items-center gap-2">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingAd ? "تحديث الإعلان" : "حفظ الإعلان"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <div className="grid gap-4">
          {ads.map(ad => (
            <div key={ad.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4">
              <div className="w-24 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                {ad.image ? (
                  <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 m-auto mt-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">{ad.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{ad.description}</p>
                <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-zinc-800 px-2 py-1 rounded mt-1 inline-block" dir="ltr">{ad.link}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEditClick(ad)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(ad.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {ads.length === 0 && (
            <div className="text-center text-gray-500 py-10">لا توجد إعلانات بعد</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
