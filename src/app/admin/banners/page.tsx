"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageUtils";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, X, UploadCloud, ArrowRight } from "lucide-react";
import Link from "next/link";

type Banner = {
  id: string;
  title: string;
  tag: string;
  link: string;
  image: string;
};

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [link, setLink] = useState("/shop");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "banners"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(items);
    } catch (error) {
      console.error("Error fetching banners:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setTag("");
    setLink("/shop");
    setImageFile(null);
    setEditingBanner(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (banner: Banner) => {
    setEditingBanner(banner);
    setTitle(banner.title);
    setTag(banner.tag || "");
    setLink(banner.link || "/shop");
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !tag || !link) return;
    if (!editingBanner && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingBanner?.image || "";

      // 1. Upload image to Firebase Storage
      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const storageRef = ref(storage, `banners/${Date.now()}_${compressed.name}`);
        await uploadBytes(storageRef, compressed);
        imageUrl = await getDownloadURL(storageRef);
      }

      // 2. Save banner to Firestore
      if (editingBanner) {
        await updateDoc(doc(db, "banners", editingBanner.id), {
          title,
          tag,
          link,
          ...(imageFile ? { image: imageUrl } : {})
        });
      } else {
        await addDoc(collection(db, "banners"), {
          title,
          tag,
          link,
          image: imageUrl,
          createdAt: new Date().toISOString()
        });
      }

      resetForm();
      fetchBanners();
    } catch (error) {
      console.error("Error saving banner:", error);
      toast.error("حدث خطأ أثناء الحفظ. تأكد من أنك تملك صلاحية المدير.");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا البنر؟"))) return;
    try {
      await deleteDoc(doc(db, "banners", id));
      setBanners(banners.filter(p => p.id !== id));
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
              <h1 className="text-xl font-black text-white">إدارة البنرات</h1>
              <p className="text-xs text-purple-200">تعديل وإضافة بنرات للمتجر</p>
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
        <form onSubmit={handleSaveBanner} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
          <h2 className="font-bold mb-4">{editingBanner ? "تعديل البنر" : "إضافة بنر جديد"}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">العنوان الرئيسي</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: كيكات بنكهة الحلم" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">الكلمة الدلالية (التاج)</label>
                <input required value={tag} onChange={e => setTag(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: عرض خاص" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">رابط التوجيه</label>
                <input required value={link} onChange={e => setLink(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="/shop" />
              </div>
            </div>

            {/* Image Upload Professional Dropzone */}
            <div className="flex flex-col items-center w-full mt-2">
              <label className="text-sm text-gray-500 mb-2 block w-full">صورة البنر (يفضل أن تكون عريضة)</label>
              <label className="w-full h-32 bg-gray-50 dark:bg-zinc-800 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:bg-gray-100 dark:hover:bg-zinc-700/80 transition-colors">
                {imageFile ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                    <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                    </div>
                  </div>
                ) : editingBanner?.image ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                    <img src={editingBanner.image} alt="Current" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-10 h-10 bg-pink-50 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-5 h-5 text-pink-500" />
                    </div>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-bold mb-1">اضغط أو اسحب صورة البنر هنا</span>
                    <span className="text-[10px] text-gray-500">سيتم ضغط الصورة تلقائياً</span>
                  </div>
                )}
                <input type="file" required={!editingBanner} accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
            </div>

            <button disabled={uploading} type="submit" className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-purple-400 text-white font-bold py-3 rounded-xl shadow-md transition mt-4 flex justify-center items-center gap-2">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingBanner ? "تحديث البنر" : "حفظ البنر"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <div className="grid gap-4">
          {banners.map(banner => (
            <div key={banner.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4">
              <div className="w-24 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                {banner.image ? (
                  <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 m-auto mt-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">{banner.title}</h3>
                <p className="text-xs text-gray-500 font-bold mt-1">التاج: {banner.tag}</p>
                <span className="text-[10px] text-pink-500 bg-pink-50 dark:bg-zinc-800 px-2 py-1 rounded mt-1 inline-block" dir="ltr">{banner.link}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEditClick(banner)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(banner.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <div className="text-center text-gray-500 py-10">لا توجد بنرات بعد</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
