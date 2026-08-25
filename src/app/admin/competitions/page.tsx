"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, Gift, X, ArrowRight } from "lucide-react";
import Link from "next/link";

type Competition = {
  id: string;
  title: string;
  description: string;
  prize: string;
  endDate: string;
  image: string;
  isActive: boolean;
};

export default function AdminCompetitions() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  
  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "competitions"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
      setCompetitions(items);
    } catch (error) {
      console.error("Error fetching competitions:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPrize("");
    setEndDate("");
    setImageFile(null);
    setEditingCompetition(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (comp: Competition) => {
    setEditingCompetition(comp);
    setTitle(comp.title);
    setDescription(comp.description);
    setPrize(comp.prize);
    setEndDate(comp.endDate || "");
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !prize || !endDate) return;
    if (!editingCompetition && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingCompetition?.image || "";

      // 1. Upload image to Firebase Storage
      if (imageFile) {
        const storageRef = ref(storage, `competitions/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // 2. Save to Firestore
      if (editingCompetition) {
        await updateDoc(doc(db, "competitions", editingCompetition.id), {
          title,
          description,
          prize,
          endDate,
          ...(imageFile ? { image: imageUrl } : {})
        });
      } else {
        await addDoc(collection(db, "competitions"), {
          title,
          description,
          prize,
          endDate,
          image: imageUrl,
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }

      resetForm();
      fetchCompetitions();
    } catch (error) {
      console.error("Error saving competition:", error);
      toast.error("حدث خطأ أثناء الحفظ. تأكد من أنك تملك صلاحية المدير.");
    }
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذه المسابقة؟"))) return;
    try {
      await deleteDoc(doc(db, "competitions", id));
      setCompetitions(competitions.filter(p => p.id !== id));
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
              <h1 className="text-xl font-black text-white">إدارة المسابقات</h1>
              <p className="text-xs text-purple-200">تعديل وإضافة مسابقات جديدة</p>
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
        <form onSubmit={handleSaveCompetition} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-8">
          <h2 className="font-bold mb-4">{editingCompetition ? "تعديل المسابقة" : "إضافة مسابقة جديدة"}</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">عنوان المسابقة</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: مسابقة أجمل تصميم كيك" />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">التفاصيل والشروط</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400 min-h-[80px]" placeholder="مثال: شاركنا صورة كيكتك واحصل على فرصة لربح..."></textarea>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">الجائزة</label>
                <input required value={prize} onChange={e => setPrize(e.target.value)} type="text" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" placeholder="مثال: كيكة مجانية + خصم 50%" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">تاريخ الإنتهاء</label>
                <input required value={endDate} onChange={e => setEndDate(e.target.value)} type="date" className="w-full bg-gray-50 dark:bg-zinc-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-pink-400" />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">صورة المسابقة {editingCompetition && "(اختياري)"}</label>
              <input required={!editingCompetition} type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-pink-600 hover:file:bg-pink-50" />
              {editingCompetition && editingCompetition.image && !imageFile && (
                <div className="mt-2 w-32 h-16 rounded-lg overflow-hidden relative border border-gray-100">
                  <img src={editingCompetition.image} alt="Current Image" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <button disabled={uploading} type="submit" className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-purple-400 text-white font-bold py-3 rounded-xl shadow-md transition mt-4 flex justify-center items-center gap-2">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingCompetition ? "تحديث المسابقة" : "حفظ المسابقة"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <div className="grid gap-4">
          {competitions.map(comp => (
            <div key={comp.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4">
              <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                {comp.image ? (
                  <img src={comp.image} alt={comp.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 m-auto mt-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-[#e8456b] mb-1">{comp.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{comp.description}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] flex items-center gap-1 font-bold text-yellow-600 bg-yellow-50 dark:bg-zinc-800 px-2 py-1 rounded">
                    <Gift className="w-3 h-3" /> {comp.prize}
                  </span>
                  <span className="text-[10px] text-gray-500">ينتهي في: {comp.endDate}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEditClick(comp)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(comp.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {competitions.length === 0 && (
            <div className="text-center text-gray-500 py-10">لا توجد مسابقات بعد</div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
