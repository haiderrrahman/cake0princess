"use client";
import { customConfirm } from '@/lib/customConfirm';
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { compressImage } from "@/lib/imageUtils";
import { Plus, Trash2, Edit2, Image as ImageIcon, Loader2, ChevronLeft, Search, CheckCircle, Package, X, UploadCloud, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      await fetchCategories();
      await fetchProducts();
    };
    fetchData();
  }, []);

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "categories"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setCategories(items);
      if (items.length > 0) setCategory(items[0].name);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(items);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    if (categories.length > 0) setCategory(categories[0].name);
    setImageFile(null);
    setEditingProduct(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price.toString());
    setCategory(product.category);
    setImageFile(null);
    setIsFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    if (!editingProduct && !imageFile) return;

    setUploading(true);
    try {
      let imageUrl = editingProduct?.image || "";

      if (imageFile) {
        // Compress the image before uploading
        const compressed = await compressImage(imageFile);
        const storageRef = ref(storage, `products/${Date.now()}_${compressed.name}`);
        await uploadBytes(storageRef, compressed);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), {
          name,
          price: Number(price),
          category,
          image: imageUrl
        });
      } else {
        await addDoc(collection(db, "products"), {
          name,
          price: Number(price),
          category,
          image: imageUrl
        });
      }
      
      await fetchProducts();
      resetForm();
    } catch (error) {
      console.error("Error saving product:", error);
    }
    setUploading(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (await customConfirm("هل أنت متأكد من حذف هذه الكيكة؟")) {
      await deleteDoc(doc(db, "products", id));
      await fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-zinc-950 pb-24">
      <div className="animate-slide-up">
      {/* ── Header ── */}
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
              <h1 className="text-xl font-black text-white">إدارة الكيك</h1>
              <p className="text-xs text-purple-200">تعديل أو إضافة كيك جديد للمتجر</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-[#FF3366] hover:bg-[#e62e5c] text-white rounded-xl backdrop-blur-md px-4 py-2 flex items-center gap-2 text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>
      </div>



      {/* ── Products List ── */}
      <div className="px-5 mt-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF3366]" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
            <div className="text-4xl mb-2 opacity-50">🎂</div>
            <p className="text-gray-500 font-bold text-sm">لا يوجد كيك هنا، أضف البعض!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0">
                  {product.image ? (
                    <Image src={product.image} alt={product.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{product.name}</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{product.category}</p>
                  <p className="text-[#FF3366] font-black text-xs mt-1">{product.price.toLocaleString()} د.ع</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleEditClick(product)} className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 active:scale-90 transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)} className="p-2 bg-red-50 dark:bg-red-500/10 rounded-lg text-red-500 active:scale-90 transition-all">
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
              <h2 className="text-xl font-black">{editingProduct ? "تعديل الكيكة" : "إضافة كيكة جديدة"}</h2>
              <button onClick={resetForm} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500 active:scale-90 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="space-y-4">
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
                  ) : editingProduct?.image ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                      <img src={editingProduct.image} alt="Current" className="h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold flex items-center gap-2"><Edit2 className="w-4 h-4"/> تغيير الصورة</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-14 h-14 bg-pink-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-7 h-7 text-[#FF3366]" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-bold mb-1">اضغط أو اسحب الصورة هنا</span>
                      <span className="text-[10px] text-gray-500">سيتم ضغط الصورة تلقائياً للحفاظ على السرعة</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">اسم الكيكة</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none"
                  placeholder="مثال: كيكة الفراولة..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">السعر (د.ع)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none"
                    placeholder="مثال: 45000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none"
                  >
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-[#FF3366] text-white rounded-xl py-3.5 mt-6 font-black shadow-lg shadow-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {editingProduct ? "حفظ التعديلات" : "إضافة الكيكة"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
