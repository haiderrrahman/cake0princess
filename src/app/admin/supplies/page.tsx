"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageUtils";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, ArrowRight, Search, CheckCircle, Sparkles, X, UploadCloud } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Supply = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  stockQuantity?: number;
  purchasePrice?: number;
};

export default function AdminSupplies() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      await fetchCategories();
      await fetchSupplies();
    };
    fetchData();
  }, []);

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "supplies_categories"));
      let items = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      if (items.length === 0) {
        // Fallback categories if empty
        items = [
          { id: "c1", name: "قوالب وأدوات" },
          { id: "c2", name: "مطيبات ونكهات" },
          { id: "c3", name: "أدوات تزيين" },
          { id: "c4", name: "مستلزمات أعياد الميلاد" }
        ];
      }
      setCategories(items);
      if (items.length > 0) setCategory(items[0].name);
    } catch (error) {
      console.error("Error fetching supplies categories:", error);
    }
  };

  const fetchSupplies = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "supplies"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supply));
      setSupplies(items);
    } catch (error) {
      console.error("Error fetching supplies:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    if (categories.length > 0) setCategory(categories[0].name);
    setDescription("");
    setStockQuantity("");
    setPurchasePrice("");
    setImageFile(null);
    setEditingSupply(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (supply: Supply) => {
    setEditingSupply(supply);
    setName(supply.name);
    setPrice(supply.price.toString());
    setCategory(supply.category);
    setDescription(supply.description || "");
    setStockQuantity(supply.stockQuantity?.toString() || "0");
    setPurchasePrice(supply.purchasePrice?.toString() || "0");
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    if (!editingSupply && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingSupply?.image || "";

      if (imageFile) {
        const compressed = await compressImage(imageFile);
        const storageRef = ref(storage, `supplies/${Date.now()}_${compressed.name}`);
        await uploadBytes(storageRef, compressed);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (editingSupply) {
        await updateDoc(doc(db, "supplies", editingSupply.id), {
          name,
          price: Number(price),
          category,
          description,
          image: imageUrl,
          stockQuantity: Number(stockQuantity) || 0,
          purchasePrice: Number(purchasePrice) || 0
        });
      } else {
        await addDoc(collection(db, "supplies"), {
          name,
          price: Number(price),
          category,
          description,
          image: imageUrl,
          stockQuantity: Number(stockQuantity) || 0,
          purchasePrice: Number(purchasePrice) || 0
        });
      }
      
      await fetchSupplies();
      resetForm();
    } catch (error) {
      console.error("Error saving supply:", error);
    }
    setUploading(false);
  };

  const handleDeleteSupply = async (supply: Supply) => {
    setDeleteTarget(supply);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    await deleteDoc(doc(db, "supplies", deleteTarget.id));
    await fetchSupplies();
    setDeleteTarget(null);
    setIsDeleting(false);
  };

  const filteredSupplies = supplies.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.category.includes(searchQuery);
    const matchesCat = filterCategory === "all" || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-24">
      <div className="animate-slide-up">
      {/* ═══════════════ LUXURY AMBER/ORANGE HEADER BANNER ═══════════════ */}
      <div className="bg-gradient-to-l from-orange-900 via-amber-900 to-red-950 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">إدارة مواد الكيك والمستلزمات</h1>
              <p className="text-xs text-amber-200 font-bold">أدوات التزيين وقوالب الكيك ومستلزمات الاحتفال</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto relative z-10">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="ابحث عن أداة أو مادة..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-amber-400 backdrop-blur-md transition"
              />
            </div>
            <button 
              onClick={() => { resetForm(); setIsFormOpen(true); }}
              className="bg-white text-orange-950 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black shadow-sm hover:bg-gray-100 transition active:scale-95 flex-shrink-0"
            >
              <Plus className="w-4 h-4 text-orange-600" />
              <span>إضافة مادة</span>
            </button>
          </div>
        </div>

        {/* Stats Header integrated into the luxury header */}
        {(() => {
          const totalSupplies = supplies.length;
          const totalStock = supplies.reduce((sum, s) => sum + (s.stockQuantity || 0), 0);
          const totalValue = supplies.reduce((sum, s) => sum + ((s.stockQuantity || 0) * (s.purchasePrice || 0)), 0);

          return (
            <div className="grid grid-cols-3 gap-2.5 mt-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-amber-200 mb-1">الأنواع المتوفرة</p>
                <p className="text-sm md:text-xl font-black text-white">{totalSupplies}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-amber-200 mb-1">إجمالي القطع</p>
                <p className="text-sm md:text-xl font-black text-white">{totalStock}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-amber-200 mb-1">رأس المال</p>
                <p className="text-sm md:text-xl font-black text-white">{totalValue.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Visible Category Filters (No Horizontal Scroll / Swipe) */}
      <div className="px-5 mb-6">
        <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {[{ id: "all", name: "الكل 📋" }, ...categories].map((c: any) => (
            <button key={c.id || c.name} onClick={() => setFilterCategory(c.name === "الكل 📋" ? "all" : c.name)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${(filterCategory === "all" && c.name === "الكل 📋") || filterCategory === c.name ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Supplies List ── */}
      <div className="px-5 mt-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
          </div>
        ) : filteredSupplies.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
            <div className="text-4xl mb-2 opacity-50">🎉</div>
            <p className="text-gray-500 font-bold text-sm">لا توجد مواد هنا، أضف البعض!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSupplies.map((supply) => (
              <div key={supply.id} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0">
                  {supply.image ? (
                    <Image src={supply.image} alt={supply.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{supply.name}</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{supply.category}</p>
                  <div className="flex flex-wrap gap-2 items-center mt-1.5 mb-1">
                    <span className="text-[10px] bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-bold text-gray-600 dark:text-gray-300">
                      المتوفر: {supply.stockQuantity || 0}
                    </span>
                    <span className="text-[10px] bg-green-100 dark:bg-green-500/10 px-2 py-0.5 rounded-md font-bold text-green-600 dark:text-green-400">
                      الربح: {(supply.price - (supply.purchasePrice || 0)).toLocaleString()} د.ع
                    </span>
                  </div>
                  <p className="text-fuchsia-500 font-black text-xs mt-1">{supply.price.toLocaleString()} د.ع</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleEditClick(supply)} className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 active:scale-90 transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteSupply(supply)} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 active:scale-90 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* ── Form Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in p-4">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-md max-h-[90vh] rounded-3xl p-6 overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">{editingSupply ? "تعديل المادة" : "إضافة مادة جديدة"}</h2>
              <button onClick={resetForm} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500 active:scale-90 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveSupply} className="space-y-4">
              {/* Image Upload Professional Dropzone */}
              <div className="flex flex-col items-center w-full">
                <label className="w-full h-40 bg-gray-50 dark:bg-zinc-900 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-3xl flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:bg-gray-100 dark:hover:bg-zinc-800/80 transition-colors">
                  {imageFile ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                      <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                      </div>
                    </div>
                  ) : editingSupply?.image ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                      <img src={editingSupply.image} alt="Current" className="h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-14 h-14 bg-fuchsia-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-7 h-7 text-fuchsia-500" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-bold mb-1">اضغط أو اسحب الصورة هنا</span>
                      <span className="text-[10px] text-gray-500">سيتم ضغط الصورة تلقائياً للحفاظ على السرعة</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">اسم الأداة / المادة</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none"
                  placeholder="مثال: قوالب سيليكون..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">سعر البيع (د.ع)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none"
                    placeholder="مثال: 5000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none"
                  >
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none"
                    placeholder="مثال: 3000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">الكمية المتوفرة بالمخزن</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none"
                    placeholder="مثال: 100"
                  />
                </div>
              </div>

              {price && purchasePrice && (
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-green-700 dark:text-green-400">الربح المتوقع للقطعة:</span>
                  <span className="text-sm font-black text-green-600 dark:text-green-300">
                    {Math.max(0, Number(price) - Number(purchasePrice)).toLocaleString()} د.ع
                  </span>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">التفاصيل / الوصف</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500 transition-all outline-none min-h-[80px]"
                  placeholder="مثال: مصنوع من مواد صحية وآمنة، مقاس 20 سم..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-fuchsia-500 text-white rounded-xl py-3.5 mt-6 font-black shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {editingSupply ? "حفظ التعديلات" : "إضافة المادة"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 shadow-2xl">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-center mb-2">حذف المادة</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              هل أنت متأكدة من حذف
            </p>
            <p className="text-sm font-bold text-center text-gray-800 dark:text-white mb-6">
              "{deleteTarget.name}"؟
            </p>
            <p className="text-xs text-red-400 text-center mb-6">لا يمكن التراجع عن هذا الإجراء</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 rounded-2xl font-bold text-sm text-gray-700 dark:text-gray-300 active:scale-95 transition"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                حذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
