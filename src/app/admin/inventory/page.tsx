"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight, Search, Plus, Loader2, Trash2, Package, AlertTriangle,
  Edit3, Check, X, ChevronDown, RefreshCw
} from "lucide-react";
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query, updateDoc, increment, onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import EditInventoryModal from "@/components/EditInventoryModal";

const INVENTORY_UNITS = ["كغم", "لتر", "قطعة", "كيس", "سطل", "علبة", "ورقة", "رول"];
const INVENTORY_CATEGORIES = ["طحين وسكر", "كريمات", "حشوات", "شوكولاتة وكاكاو", "ألوان وإضافات", "منكهات وعطور", "عجينة سكر", "فواكه ومكسرات", "تغليف وزينة", "مستهلكات", "قوالب وصواني", "أدوات", "أخرى"];

const CAT_COLORS: Record<string, string> = {
  "طحين وسكر": "bg-amber-50 text-amber-700 dark:bg-amber-900/20",
  "كريمات": "bg-pink-50 text-pink-700 dark:bg-pink-900/20",
  "حشوات": "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
  "ألوان وإضافات": "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
  "تغليف وزينة": "bg-teal-50 text-teal-700 dark:bg-teal-900/20",
  "أدوات": "bg-gray-100 text-gray-700 dark:bg-zinc-800",
  "أخرى": "bg-gray-50 text-gray-600 dark:bg-zinc-800",
};

export default function InventoryAdmin() {
  const [items, setItems] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cache_inventory_page');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('cache_inventory_page', JSON.stringify(items));
  }, [items]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("الكل");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showEditInventory, setShowEditInventory] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editQtyId, setEditQtyId] = useState<string | null>(null);
  const [editQtyVal, setEditQtyVal] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "set">("add");
  const [purchaseModal, setPurchaseModal] = useState<any>(null);
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseSource, setPurchaseSource] = useState<'none' | 'cake' | 'salary' | 'split'>('cake');
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [addSource, setAddSource] = useState<'none' | 'cake' | 'salary' | 'split'>('cake');
  const [addSplitDebtAmount, setAddSplitDebtAmount] = useState("");
  const [name, setName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [minAlert, setMinAlert] = useState("1");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const q1 = query(collection(db, "cake_inventory"), orderBy("createdAt", "desc"));
      const snap1 = await getDocs(q1);
      setItems(snap1.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity || !category || !unit) {
      toast.error("يرجى تعبئة جميع الحقول (الاسم، الكمية، التصنيف، والوحدة)");
      return;
    }
    
    // Prevent Duplicate
    const existing = items.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      toast.error("هذه المادة موجودة مسبقاً في المخزن، قم بتعديل كميتها.");
      return;
    }
    
    setSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const fRef = ref(storage, `inventory/${Date.now()}_${imageFile.name}`);
        await uploadBytes(fRef, imageFile);
        imageUrl = await getDownloadURL(fRef);
      }

      const parsedQty = Number(quantity) || 0;
      const parsedTotalPrice = Number(price) || 0;
      const unitPrice = parsedQty > 0 ? parsedTotalPrice / parsedQty : parsedTotalPrice;

      const alertThresh = Number(minAlert) || 1;
      const docRef = await addDoc(collection(db, "cake_inventory"), {
        name, category, quantity: parsedQty, unit,
        price: unitPrice, minAlert: alertThresh,
        neededQuantity: parsedQty <= alertThresh ? 1 : 0,
        imageUrl, createdAt: serverTimestamp(), lastUpdated: serverTimestamp(),
      });

      if (parsedTotalPrice > 0 && addSource !== 'none') {
        if (addSource === 'split') {
          const debtAmount = Number(addSplitDebtAmount) || 0;
          const paidAmount = parsedTotalPrice - debtAmount;
          if (debtAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: debtAmount,
              category: "مشتريات مخزنية",
              description: `إضافة للمخزن: ${name} (دين من الراتب)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: true
            });
          }
          if (paidAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: paidAmount,
              category: "مشتريات مخزنية",
              description: `إضافة للمخزن: ${name} (مدفوع من أموال الكيك)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: false
            });
          }
        } else {
          await addDoc(collection(db, "expenses"), {
            amount: parsedTotalPrice,
            category: "مشتريات مخزنية",
            description: `إضافة للمخزن: ${name}`,
            month: new Date().getMonth() + 1,
            createdAt: serverTimestamp(),
            isDebt: addSource === 'salary'
          });
        }
      }

      setName(""); setCategory(""); setQuantity(""); setUnit("");
      setPrice(""); setMinAlert("1"); setImageFile(null); setImagePreview(null);
      setAddSource('cake'); setAddSplitDebtAmount("");
      setIsModalOpen(false);
      fetchItems();
    } catch (e) {
      toast.error("حدث خطأ أثناء الإضافة");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("حذف هذا العنصر نهائياً؟"))) return;
    await deleteDoc(doc(db, "cake_inventory", id));
    setItems(items.filter(i => i.id !== id));
  };

  const updateInventoryQuantity = async (id: string, currentQty: number, change: number) => {
    try {
      const newQty = Math.max(0, currentQty + change);
      await updateDoc(doc(db, "cake_inventory", id), { quantity: newQty });
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));
      
      // Auto-add to needs if quantity hits minAlert or below
      const item = items.find(i => i.id === id);
      const alertThreshold = item?.minAlert ? Number(item.minAlert) : 1;
      if (newQty <= alertThreshold) {
        if (item && (!item.neededQuantity || item.neededQuantity === 0)) {
          await updateDoc(doc(db, "cake_inventory", id), { neededQuantity: 1 });
          toast.success(`تم إضافة ${item.name} للاحتياجات التلقائية`);
          fetchItems();
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء تحديث الكمية");
    }
  };

  const handleAdjustQty = async (itemId: string) => {
    const val = Number(editQtyVal);
    if (isNaN(val)) return;
    const docRef = doc(db, "cake_inventory", itemId);
    const item = items.find(i => i.id === itemId);
    
    if (adjustType === "add") {
      await updateDoc(docRef, { quantity: increment(val), lastUpdated: serverTimestamp() });
    } else {
      await updateDoc(docRef, { quantity: val, lastUpdated: serverTimestamp() });
      const alertThreshold = item?.minAlert ? Number(item.minAlert) : 1;
      if (val <= alertThreshold && item) {
        if (!item.neededQuantity || item.neededQuantity === 0) {
          await updateDoc(docRef, { neededQuantity: 1 });
          toast.success(`تم إضافة ${item.name} للاحتياجات التلقائية`);
        }
      }
    }
    setEditQtyId(null);
    setEditQtyVal("");
    fetchItems();
  };

  const normalizeArabic = (text: string) => {
    return text.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ي/g, 'ى');
  };

  const filtered = items.filter(item => {
    const itemName = item.name ? normalizeArabic(item.name.toLowerCase()) : "";
    const search = normalizeArabic(searchQuery.toLowerCase());
    const matchSearch = itemName.includes(search);
    const matchCat = filterCat === "الكل" || item.category === filterCat;
    return matchSearch && matchCat;
  });

  const filteredNeeds = items.filter(item => {
    if (!item.neededQuantity || item.neededQuantity <= 0) return false;
    const itemName = item.name ? normalizeArabic(item.name.toLowerCase()) : "";
    const search = normalizeArabic(searchQuery.toLowerCase());
    const matchSearch = itemName.includes(search);
    const matchCat = filterCat === "الكل" || item.category === filterCat;
    return matchSearch && matchCat;
  });

  const updateNeededQuantity = async (id: string, currentNeed: number, change: number) => {
    try {
      const newNeed = Math.max(0, currentNeed + change);
      await updateDoc(doc(db, "cake_inventory", id), { neededQuantity: newNeed });
      fetchItems();
    } catch (e) {
      toast.error("حدث خطأ أثناء تحديث الكمية المطلوبة");
    }
  };

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseModal || !purchaseQty) return;
    
    setSubmitting(true);
    try {
      const qVal = Number(purchaseQty);
      const pVal = Number(purchasePrice) || 0;
      const newNeed = purchaseModal.neededQuantity ? Math.max(0, purchaseModal.neededQuantity - qVal) : 0;
      
      await updateDoc(doc(db, "cake_inventory", purchaseModal.id), {
        quantity: increment(qVal),
        neededQuantity: newNeed,
        lastUpdated: serverTimestamp()
      });
      
      // Add to expenses
      if (pVal > 0 && purchaseSource !== 'none') {
        if (purchaseSource === 'split') {
          const debtAmount = Number(splitDebtAmount) || 0;
          const paidAmount = pVal - debtAmount;
          if (debtAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: debtAmount,
              category: "مشتريات مخزنية",
              description: `شراء ${qVal} ${purchaseModal.unit} من ${purchaseModal.name} (دين من الراتب)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: true
            });
          }
          if (paidAmount > 0) {
            await addDoc(collection(db, "expenses"), {
              amount: paidAmount,
              category: "مشتريات مخزنية",
              description: `شراء ${qVal} ${purchaseModal.unit} من ${purchaseModal.name} (مدفوع من أموال الكيك)`,
              month: new Date().getMonth() + 1,
              createdAt: serverTimestamp(),
              isDebt: false
            });
          }
        } else {
          await addDoc(collection(db, "expenses"), {
            amount: pVal,
            category: "مشتريات مخزنية",
            description: `شراء ${qVal} ${purchaseModal.unit} من ${purchaseModal.name}`,
            month: new Date().getMonth() + 1,
            createdAt: serverTimestamp(),
            isDebt: purchaseSource === 'salary'
          });
        }
      }
      
      toast.success(`✅ تم شراء ${purchaseModal.name}`);
      
      setPurchaseModal(null);
      fetchItems();
    } catch (e) {
      toast.error("حدث خطأ أثناء الشراء");
    }
    setSubmitting(false);
  };

  const lowStockItems = items.filter(i => Number(i.quantity) <= Number(i.minAlert));
  const totalInventoryValue = items.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 0)), 0);
  const totalInventoryHaider = items.reduce((s, i) => {
    const val = Number(i.price || 0) * Number(i.quantity || 0);
    const pb = i.paidBy || 'haider';
    if (pb === 'haider' || pb === 'salary') return s + val;
    if (pb === 'split') return s + (val * (i.splitRatioHaider || 0.5));
    return s;
  }, 0);
  const totalInventoryCake = items.reduce((s, i) => {
    const val = Number(i.price || 0) * Number(i.quantity || 0);
    const pb = i.paidBy || 'haider';
    if (pb === 'cake') return s + val;
    if (pb === 'split') return s + (val * (1 - (i.splitRatioHaider || 0.5)));
    return s;
  }, 0);
  
  const uniqueFilteredNeedsCategories = Array.from(new Set(filteredNeeds.map(i => i.category))).filter(Boolean);
  const uniqueFilteredCategories = Array.from(new Set(filtered.map(i => i.category))).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-24">
      {/* ═══════════════ LUXURY BLUE HEADER BANNER ═══════════════ */}
      <div className="bg-gradient-to-l from-blue-900 via-indigo-900 to-slate-950 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">مخزن مواد الكيك</h1>
              <p className="text-xs text-blue-200 font-bold">المواد المتوفرة لصنع الكيك وإدارة النواقص</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto relative z-10">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="ابحث عن مادة..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-md transition"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-blue-950 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black shadow-sm hover:bg-gray-100 transition active:scale-95 flex-shrink-0"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>إضافة مادة</span>
            </button>
            <button onClick={fetchItems} className="w-11 h-11 bg-white/10 rounded-xl backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        
        {/* Stats Header integrated into the luxury header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-6 relative z-10">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">إجمالي المواد</p>
            <p className="text-sm md:text-xl font-black text-white">{items.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">المواد المنخفضة</p>
            <p className="text-sm md:text-xl font-black text-red-300">{lowStockItems.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">الاحتياجات الحالية</p>
            <p className="text-sm md:text-xl font-black text-orange-300">{items.filter(i => (i.neededQuantity || 0) > 0).length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center flex flex-col justify-center">
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">قيمة المخزون</p>
            <p className="text-sm md:text-xl font-black text-white mb-1">{totalInventoryValue.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
            <div className="flex justify-center gap-2 mt-1 text-[9px] font-bold">
              <span className="text-blue-200 flex items-center gap-0.5"><span className="text-sm">👤</span> {totalInventoryHaider.toLocaleString()}</span>
              <span className="text-pink-300 flex items-center gap-0.5"><span className="text-sm">🎂</span> {totalInventoryCake.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visible Category Filters (No Horizontal Scroll / Swipe) */}
      <div className="px-5 mb-6">
        <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {["الكل", ...INVENTORY_CATEGORIES].map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${filterCat === cat ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>


      {/* Items Grid */}
      <div className="px-5 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد مواد</h2>
            <p className="text-gray-500 text-sm">أضف مواد الكيك المتوفرة عندك لمتابعة المخزون.</p>
          </div>
        ) : (
          <>
            {/* القسم الأول: المواد التي نحتاجها */}
            <div>
              <h2 className="text-lg font-black text-orange-600 dark:text-orange-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                المواد التي نحتاجها ({filteredNeeds.length})
              </h2>
              {filteredNeeds.length === 0 ? (
                <div className="text-center p-6 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 text-gray-500 mb-8">
                  لا توجد مواد تحتاج لشرائها حالياً
                </div>
              ) : (
                <div className="space-y-6 mb-8">
                  {uniqueFilteredNeedsCategories.map(cat => {
                    const catItems = filteredNeeds.filter(item => item.category === cat);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={"needed-"+cat} className="space-y-3">
                        <h3 className={`text-sm font-black px-3 py-1.5 rounded-full inline-block ${CAT_COLORS[cat] || "bg-gray-100 text-gray-600"}`}>
                          {cat} ({catItems.length})
                        </h3>
                        <div className="flex overflow-x-auto snap-x gap-3 pb-2 custom-scrollbar">
                          {catItems.map(item => (
                            <div key={item.id} className="w-[140px] shrink-0 snap-center bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col relative aspect-square">
                              <button onClick={() => setShowEditInventory(item)} className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="absolute top-1.5 left-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 transition">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              
                              <div className="flex-1 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-4xl relative overflow-hidden">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}</span>
                                )}
                                <span className="absolute bottom-1 right-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">مطلوب: {item.neededQuantity} {item.unit}</span>
                              </div>

                              <div className="p-2 flex flex-col gap-1">
                                <div>
                                  <p className="font-black text-gray-900 dark:text-white text-sm leading-tight line-clamp-1 mb-1">{item.name}</p>
                                  <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">
                                    المفرد: <span className="font-black">{item.price ? Number(item.price).toLocaleString() : 0}</span> د.ع
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 font-black mt-0.5">
                                    الإجمالي: {item.price ? (Number(item.price) * Number(item.neededQuantity || 0)).toLocaleString() : 0} د.ع
                                  </p>
                                </div>
                                <div className="mt-auto">
                                  <button onClick={() => {
                                    setPurchaseModal(item);
                                    setPurchaseQty(item.neededQuantity?.toString() || "1");
                                    setPurchasePrice(item.price ? (Number(item.price) * (Number(item.neededQuantity)||1)).toString() : "");
                                  }} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-1.5 rounded-xl transition flex items-center justify-center gap-1 shadow-sm">
                                    <Check className="w-3 h-3" /> شراء الآن
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* القسم الثاني: المواد المتوفرة */}
            <div>
              <h2 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2 mt-4">
                <Check className="w-5 h-5" />
                المواد المتوفرة ({filtered.length})
              </h2>
              {filtered.length === 0 ? (
                <div className="text-center p-6 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 text-gray-500 mb-8">
                  لا توجد مواد متوفرة حالياً
                </div>
              ) : (
                <div className="space-y-6 mb-8">
                  {uniqueFilteredCategories.map(cat => {
                    const catItems = filtered.filter(item => item.category === cat);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={"avail-"+cat} className="space-y-3">
                        <h3 className={`text-sm font-black px-3 py-1.5 rounded-full inline-block ${CAT_COLORS[cat] || "bg-gray-100 text-gray-600"}`}>
                          {cat} ({catItems.length})
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {catItems.map(item => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col relative aspect-square">
                              <button onClick={() => setShowEditInventory(item)} className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDelete(item.id)} className="absolute top-1.5 left-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 transition">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              
                              <div className="flex-1 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-4xl relative overflow-hidden">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}</span>
                                )}
                                <span className="absolute bottom-1 right-1 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">متوفر: {item.quantity} {item.unit}</span>
                              </div>

                              <div className="p-2 flex flex-col gap-1">
                                <div>
                                  <p className="font-black text-gray-900 dark:text-white text-sm leading-tight line-clamp-1 mb-1">{item.name}</p>
                                  <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">
                                    المفرد: <span className="font-black">{item.price ? Number(item.price).toLocaleString() : 0}</span> د.ع
                                  </p>
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black mt-0.5">
                                    الإجمالي: {item.price ? (Number(item.price) * Number(item.quantity || 0)).toLocaleString() : 0} د.ع
                                  </p>
                                </div>
                                <div className="mt-auto flex gap-1">
                                  <button onClick={() => {
                                    setPurchaseModal(item);
                                    setPurchaseQty("1");
                                    setPurchasePrice(item.price ? Number(item.price).toString() : "");
                                  }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-1.5 rounded-xl transition flex items-center justify-center gap-1 shadow-sm">
                                    <Plus className="w-3 h-3" /> شراء
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Purchase Modal */}
      {purchaseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50 dark:bg-blue-900/10">
              <h3 className="font-black text-lg text-blue-800 dark:text-blue-200">
                تسجيل شراء: {purchaseModal.name}
              </h3>
              <button onClick={() => setPurchaseModal(null)} className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-gray-500 hover:bg-white transition">✕</button>
            </div>
            <form onSubmit={submitPurchase} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">الكمية المشتراة</label>
                  <div className="relative">
                    <input required type="number" step="0.1" min="0.1" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 font-bold focus:border-blue-500 focus:outline-none" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{purchaseModal.unit}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">السعر الإجمالي (د.ع)</label>
                  <input required type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 font-bold focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">تم الدفع من</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button type="button" onClick={() => setPurchaseSource('none')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      purchaseSource === 'none' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>بدون إضافة مصروف</button>
                  <button type="button" onClick={() => setPurchaseSource('cake')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      purchaseSource === 'cake' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>🎂 أموال الكيك</button>
                  <button type="button" onClick={() => setPurchaseSource('salary')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      purchaseSource === 'salary' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>👤 دين من الراتب</button>
                  <button type="button" onClick={() => setPurchaseSource('split')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      purchaseSource === 'split' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>✂️ مقسم</button>
                </div>
                {purchaseSource === 'split' && (
                  <div className="mt-3 animate-fade-in">
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ الذي من الراتب (دين)</label>
                    <input type="number" step="any" value={splitDebtAmount} onChange={e => setSplitDebtAmount(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                      placeholder="أدخل مبلغ الدين" />
                  </div>
                )}
              </div>
              
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-black flex items-center justify-center gap-2 mt-2 hover:bg-blue-700 transition">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> تأكيد الشراء</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showEditInventory && (
        <EditInventoryModal
          isOpen={true}
          onClose={() => setShowEditInventory(null)}
          item={showEditInventory}
          onEditSuccess={() => { fetchItems(); }}
        />
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 pt-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden my-auto">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50 dark:bg-blue-900/10">
              <h3 className="font-bold text-xl text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <Package className="w-5 h-5" /> إضافة مادة للمخزون
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-sm font-bold mb-2">اسم المادة</label>
                  <input required type="text" placeholder="مثال: طحين الفاخر" value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">التصنيف</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none">
                    {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">الكمية الحالية</label>
                  <input required type="number" step="0.1" min="0" value={quantity} onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 text-center font-bold focus:border-blue-500 focus:outline-none"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">الوحدة</label>
                  <select value={unit} onChange={e => setUnit(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none text-sm">
                    {INVENTORY_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1.5">تنبيه عند</label>
                  <input type="number" step="0.1" min="0" value={minAlert} onChange={e => setMinAlert(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5 text-center font-bold focus:border-blue-500 focus:outline-none"
                    placeholder="1" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">سعر الشراء الكلي (د.ع) <span className="text-gray-400 text-xs font-normal">اختياري</span></label>
                <input type="number" min="0" placeholder="لإضافتها للمصروفات مباشرة" value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none mb-3" />

                <label className="block text-xs font-bold text-gray-500 mb-1.5">مصدر الدفع (للكمية المضافة)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button type="button" onClick={() => setAddSource('none')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      addSource === 'none' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>بدون إضافة مصروف</button>
                  <button type="button" onClick={() => setAddSource('cake')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      addSource === 'cake' ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>🎂 أموال الكيك</button>
                  <button type="button" onClick={() => setAddSource('salary')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      addSource === 'salary' ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>👤 دين من الراتب</button>
                  <button type="button" onClick={() => setAddSource('split')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      addSource === 'split' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>✂️ مقسم</button>
                </div>
                {addSource === 'split' && (
                  <div className="mt-3 animate-fade-in">
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ الذي من الراتب (دين)</label>
                    <input type="number" step="any" value={addSplitDebtAmount} onChange={e => setAddSplitDebtAmount(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                      placeholder="أدخل مبلغ الدين" />
                  </div>
                )}
              </div>


              <div onClick={() => fileInputRef.current?.click()}
                className="w-full h-28 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="h-full object-contain rounded-lg" />
                  : (<><Package className="w-8 h-8 text-gray-300" /><span className="text-sm text-gray-400">رفع صورة المادة (اختياري)</span></>)
                }
              </div>
              <input type="file" ref={fileInputRef} onChange={e => { if (e.target.files?.[0]) { setImageFile(e.target.files[0]); setImagePreview(URL.createObjectURL(e.target.files[0])); } }} accept="image/*" className="hidden" />

              <button type="submit" disabled={submitting}
                className="w-full bg-blue-500 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-600 transition shadow-lg disabled:opacity-70 flex justify-center">
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "إضافة للمخزون"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
