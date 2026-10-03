"use client";
import { customConfirm } from '@/lib/customConfirm';
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight, Search, Plus, Loader2, Trash2, Package, AlertTriangle,
  Edit3, Check, X, ChevronDown, RefreshCw, Camera, ShoppingCart,
  Receipt, Clock, Calendar, TrendingDown, Store, Eye, ExternalLink,
  Sparkles, CheckCircle2, AlertCircle, BarChart3, Filter
} from "lucide-react";
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query, updateDoc, increment, onSnapshot, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import EditInventoryModal from "@/components/EditInventoryModal";
import ScanCakeInvoiceModal from "@/components/ScanCakeInvoiceModal";
import ManualCakePurchaseModal from "@/components/ManualCakePurchaseModal";
import CakeMaterialTimelineModal from "@/components/CakeMaterialTimelineModal";
import {
  CakeMaterialPurchase,
  calculateItemConsumption,
  recordSingleCakePurchase
} from "@/lib/cakeMaterialPurchases";

const INVENTORY_UNITS = ["كغم", "غرام", "لتر", "قطعة", "كيس", "سطل", "علبة", "كرتون", "سيت", "ورقة", "رول"];
const INVENTORY_CATEGORIES = [
  "طحين وسكر",
  "كريمات",
  "حشوات",
  "شوكولاتة وكاكاو",
  "ألوان وإضافات",
  "منكهات وعطور",
  "عجينة سكر",
  "فواكه ومكسرات",
  "تغليف وزينة",
  "مستهلكات",
  "قوالب وصواني",
  "أدوات",
  "أخرى"
];

const CAT_COLORS: Record<string, string> = {
  "طحين وسكر": "bg-amber-50 text-amber-700 dark:bg-amber-900/20",
  "كريمات": "bg-pink-50 text-pink-700 dark:bg-pink-900/20",
  "حشوات": "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
  "شوكولاتة وكاكاو": "bg-amber-100 text-amber-900 dark:bg-amber-950/40",
  "ألوان وإضافات": "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
  "منكهات وعطور": "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20",
  "عجينة سكر": "bg-rose-50 text-rose-700 dark:bg-rose-900/20",
  "فواكه ومكسرات": "bg-lime-50 text-lime-800 dark:bg-lime-900/20",
  "تغليف وزينة": "bg-teal-50 text-teal-700 dark:bg-teal-900/20",
  "مستهلكات": "bg-orange-50 text-orange-700 dark:bg-orange-900/20",
  "قوالب وصواني": "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20",
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

  // Purchases & Invoices state
  const [purchases, setPurchases] = useState<CakeMaterialPurchase[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases' | 'cycles'>('inventory');

  // Modals state
  const [isScanInvoiceOpen, setIsScanInvoiceOpen] = useState(false);
  const [isManualPurchaseOpen, setIsManualPurchaseOpen] = useState(false);
  const [manualPurchaseInitialItem, setManualPurchaseInitialItem] = useState<any>(null);
  const [timelineModalItem, setTimelineModalItem] = useState<any>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("الكل");
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState<'all' | 'invoiced' | 'non_invoiced'>('all');
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState("");
  const [cycleFilterStatus, setCycleFilterStatus] = useState<'all' | 'critical' | 'warning' | 'safe'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showEditInventory, setShowEditInventory] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState<any>(null);
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseSource, setPurchaseSource] = useState<'none' | 'cake' | 'salary' | 'split'>('cake');
  const [splitDebtAmount, setSplitDebtAmount] = useState("");
  const [purchaseHasInvoice, setPurchaseHasInvoice] = useState(false);
  const [purchaseStoreName, setPurchaseStoreName] = useState("");

  const [addSource, setAddSource] = useState<'none' | 'cake' | 'salary' | 'split'>('cake');
  const [addSplitDebtAmount, setAddSplitDebtAmount] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("طحين وسكر");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("كغم");
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

    // Listen to cake material purchases real-time
    const qPurchases = query(
      collection(db, "cake_material_purchases"),
      orderBy("purchaseDate", "desc")
    );
    const unsub = onSnapshot(
      qPurchases,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CakeMaterialPurchase));
        setPurchases(data);
      },
      (err) => console.error("Error loading purchases:", err)
    );

    return () => unsub();
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
      const todayStr = new Date().toISOString().split("T")[0];

      const docRef = await addDoc(collection(db, "cake_inventory"), {
        name, category, quantity: parsedQty, unit,
        price: unitPrice, minAlert: alertThresh,
        neededQuantity: parsedQty <= alertThresh ? 1 : 0,
        imageUrl,
        lastPurchasedAt: parsedQty > 0 ? todayStr : null,
        lastPurchasedPrice: unitPrice > 0 ? unitPrice : null,
        lastPurchasedQty: parsedQty > 0 ? parsedQty : null,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });

      // Log purchase record if quantity > 0
      if (parsedQty > 0) {
        await addDoc(collection(db, "cake_material_purchases"), {
          itemId: docRef.id,
          itemName: name,
          category,
          quantity: parsedQty,
          unit,
          unitPrice,
          totalPrice: parsedTotalPrice,
          purchaseDate: todayStr,
          hasInvoice: false,
          paymentSource: addSource,
          splitDebtAmount: addSource === 'split' ? Number(addSplitDebtAmount) || 0 : 0,
          createdAt: serverTimestamp()
        });
      }

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

      setName(""); setCategory("طحين وسكر"); setQuantity(""); setUnit("كغم");
      setPrice(""); setMinAlert("1"); setImageFile(null); setImagePreview(null);
      setAddSource('cake'); setAddSplitDebtAmount("");
      setIsModalOpen(false);
      fetchItems();
      toast.success("✅ تمت إضافة المادة بنجاح");
    } catch (e) {
      toast.error("حدث خطأ أثناء الإضافة");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!(await customConfirm("حذف هذا العنصر نهائياً؟"))) return;
    await deleteDoc(doc(db, "cake_inventory", id));
    setItems(items.filter(i => i.id !== id));
    toast.success("تم الحذف بنجاح");
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!(await customConfirm("هل تريد حذف هذا الشراء من السجل؟"))) return;
    try {
      await deleteDoc(doc(db, "cake_material_purchases", purchaseId));
      // Delete corresponding expenses if linked
      const expQ = query(collection(db, "expenses"), where("purchaseId", "==", purchaseId));
      const expSnap = await getDocs(expQ);
      for (const d of expSnap.docs) {
        await deleteDoc(d.ref);
      }
      toast.success("تم حذف الشراء بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حذف الشراء");
    }
  };

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseModal || !purchaseQty) return;
    
    setSubmitting(true);
    try {
      const qVal = Number(purchaseQty);
      const pVal = Number(purchasePrice) || 0;
      const uVal = qVal > 0 ? pVal / qVal : 0;
      const newNeed = purchaseModal.neededQuantity ? Math.max(0, purchaseModal.neededQuantity - qVal) : 0;
      const todayStr = new Date().toISOString().split("T")[0];

      await recordSingleCakePurchase({
        itemId: purchaseModal.id,
        itemName: purchaseModal.name,
        category: purchaseModal.category || "أخرى",
        quantity: qVal,
        unit: purchaseModal.unit || "كغم",
        unitPrice: Math.round(uVal),
        totalPrice: Math.round(pVal),
        purchaseDate: todayStr,
        hasInvoice: purchaseHasInvoice,
        storeName: purchaseStoreName.trim(),
        paymentSource: purchaseSource,
        splitDebtAmount: purchaseSource === 'split' ? Number(splitDebtAmount) || 0 : 0,
      });

      // Update needed quantity specifically if reduced
      if (newNeed !== purchaseModal.neededQuantity) {
        await updateDoc(doc(db, "cake_inventory", purchaseModal.id), {
          neededQuantity: newNeed
        });
      }
      
      toast.success(`✅ تم تسجيل شراء ${purchaseModal.name}`);
      setPurchaseModal(null);
      setPurchaseHasInvoice(false);
      setPurchaseStoreName("");
      fetchItems();
    } catch (e) {
      toast.error("حدث خطأ أثناء الشراء");
    }
    setSubmitting(false);
  };

  const normalizeArabic = (text: string) => {
    return (text || "").replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ي/g, 'ى');
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

  // Filtered Purchases list for Tab 2
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      // Invoice filter
      if (purchaseInvoiceFilter === "invoiced" && !p.hasInvoice) return false;
      if (purchaseInvoiceFilter === "non_invoiced" && p.hasInvoice) return false;

      // Category filter
      if (filterCat !== "الكل" && p.category !== filterCat) return false;

      // Search query
      if (purchaseSearchQuery.trim()) {
        const queryNorm = normalizeArabic(purchaseSearchQuery.toLowerCase());
        const itemNorm = normalizeArabic(p.itemName.toLowerCase());
        const storeNorm = normalizeArabic((p.storeName || "").toLowerCase());
        if (!itemNorm.includes(queryNorm) && !storeNorm.includes(queryNorm)) {
          return false;
        }
      }

      return true;
    });
  }, [purchases, purchaseInvoiceFilter, filterCat, purchaseSearchQuery]);

  // Purchases stats
  const totalSpentPurchases = purchases.reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);
  const invoicedPurchases = purchases.filter((p) => p.hasInvoice);
  const nonInvoicedPurchases = purchases.filter((p) => !p.hasInvoice);
  const totalInvoicedSpent = invoicedPurchases.reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);
  const totalNonInvoicedSpent = nonInvoicedPurchases.reduce((s, p) => s + (Number(p.totalPrice) || 0), 0);

  // Consumption analysis for all items in Tab 3
  const itemsWithConsumption = useMemo(() => {
    return items.map((it) => {
      const metrics = calculateItemConsumption(it, purchases);
      return { item: it, metrics };
    }).sort((a, b) => {
      // Sort priority: critical first, then warning, then safe
      const order: Record<string, number> = { critical: 0, warning: 1, unknown: 2, safe: 3 };
      const orderA = order[a.metrics.depletionStatus] ?? 2;
      const orderB = order[b.metrics.depletionStatus] ?? 2;
      if (orderA !== orderB) return orderA - orderB;

      // Within same status, sort by estimatedDaysRemaining ascending
      const daysA = a.metrics.estimatedDaysRemaining ?? 999;
      const daysB = b.metrics.estimatedDaysRemaining ?? 999;
      return daysA - daysB;
    });
  }, [items, purchases]);

  const filteredCyclesItems = useMemo(() => {
    return itemsWithConsumption.filter(({ item, metrics }) => {
      if (cycleFilterStatus !== "all" && metrics.depletionStatus !== cycleFilterStatus) return false;
      if (filterCat !== "الكل" && item.category !== filterCat) return false;
      if (searchQuery.trim()) {
        const itemNorm = normalizeArabic(item.name.toLowerCase());
        const search = normalizeArabic(searchQuery.toLowerCase());
        if (!itemNorm.includes(search)) return false;
      }
      return true;
    });
  }, [itemsWithConsumption, cycleFilterStatus, filterCat, searchQuery]);

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
      <div className="bg-gradient-to-l from-blue-900 via-indigo-900 to-slate-950 pt-16 pb-8 px-4 sm:px-6 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition shrink-0">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                مخزن ومشتريات مواد الكيك
                <span className="bg-blue-500/30 text-blue-200 text-xs px-2.5 py-0.5 rounded-full border border-blue-400/20 font-bold hidden sm:inline-block">
                  إدارة ذكية
                </span>
              </h1>
              <p className="text-xs text-blue-200 font-bold mt-0.5">
                تتبع المخزون، تسجيل الفواتير والمشتريات، وحساب دورة الاستهلاك ومعدل النفاد
              </p>
            </div>
          </div>
          
          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* AI Invoice Scanner Button */}
            <button 
              onClick={() => setIsScanInvoiceOpen(true)}
              className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-black shadow-md shadow-amber-500/25 active:scale-95 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-950 animate-pulse" />
              <span>📸 تصوير فاتورة (AI)</span>
            </button>

            {/* Manual Purchase (with or without invoice) */}
            <button 
              onClick={() => {
                setManualPurchaseInitialItem(null);
                setIsManualPurchaseOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-black shadow-md shadow-emerald-600/25 active:scale-95 transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>🛒 شراء بدون فاتورة / يدوي</span>
            </button>

            {/* Add New Material */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl px-3 py-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-black backdrop-blur-md active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مادة</span>
            </button>

            <button 
              onClick={fetchItems} 
              className="w-10 h-10 bg-white/10 rounded-xl backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition shrink-0"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Stats Header */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-6 relative z-10">
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
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">إجمالي المشتريات</p>
            <p className="text-sm md:text-lg font-black text-white">{totalSpentPurchases.toLocaleString()} <span className="text-[9px]">د.ع</span></p>
            <p className="text-[9px] text-blue-200 font-bold mt-0.5">{purchases.length} عملية شراء مسجلة</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-center flex flex-col justify-center col-span-2 sm:col-span-1">
            <p className="text-[10px] md:text-xs font-bold text-blue-200 mb-1">قيمة المخزون الحالي</p>
            <p className="text-sm md:text-lg font-black text-white mb-0.5">{totalInventoryValue.toLocaleString()} <span className="text-[9px]">د.ع</span></p>
            <div className="flex justify-center gap-2 text-[9px] font-bold">
              <span className="text-blue-200">👤 {totalInventoryHaider.toLocaleString()}</span>
              <span className="text-pink-300">🎂 {totalInventoryCake.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ═══════════════ MAIN NAVIGATION TABS ═══════════════ */}
        <div className="mt-6 flex flex-wrap gap-2 relative z-10 border-t border-white/10 pt-4">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition active:scale-95 ${
              activeTab === 'inventory'
                ? "bg-white text-blue-950 shadow-lg shadow-black/20"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>المخزون والاحتياجات</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'inventory' ? "bg-blue-100 text-blue-900" : "bg-white/20 text-white"
            }`}>
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition active:scale-95 ${
              activeTab === 'purchases'
                ? "bg-white text-blue-950 shadow-lg shadow-black/20"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>سجل المشتريات والفواتير</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'purchases' ? "bg-blue-100 text-blue-900" : "bg-white/20 text-white"
            }`}>
              {purchases.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cycles')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition active:scale-95 ${
              activeTab === 'cycles'
                ? "bg-white text-blue-950 shadow-lg shadow-black/20"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>دورة الاستهلاك وتوقع النفاد</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'cycles' ? "bg-amber-200 text-amber-950" : "bg-white/20 text-white"
            }`}>
              {itemsWithConsumption.filter(i => i.metrics.depletionStatus === 'critical' || i.metrics.depletionStatus === 'warning').length > 0
                ? `تنبيه (${itemsWithConsumption.filter(i => i.metrics.depletionStatus === 'critical' || i.metrics.depletionStatus === 'warning').length})`
                : "ذكي"}
            </span>
          </button>
        </div>
      </div>

      {/* ═══════════════ TAB 1: INVENTORY & STOCK ═══════════════ */}
      {activeTab === 'inventory' && (
        <>
          {/* Search & Category Filter Bar */}
          <div className="px-4 sm:px-6 mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="ابحث عن مادة كيك في المخزن..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm text-gray-800 dark:text-white placeholder-gray-400 rounded-2xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
              {["الكل", ...INVENTORY_CATEGORIES].map((cat) => (
                <button key={cat} onClick={() => setFilterCat(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${filterCat === cat ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          <div className="px-4 sm:px-6 space-y-8">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد مواد</h2>
                <p className="text-gray-500 text-sm">أضف مواد الكيك المتوفرة عندك أو قم بمسح فاتورة لتسجيلها تلقائياً.</p>
              </div>
            ) : (
              <>
                {/* Needed items section */}
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                              {catItems.map(item => {
                                const metrics = calculateItemConsumption(item, purchases);
                                return (
                                  <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-200 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col relative">
                                    <button onClick={() => setShowEditInventory(item)} className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="absolute top-2 left-2 z-10 w-7 h-7 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 transition">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <div className="h-32 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-4xl relative overflow-hidden">
                                      {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} onClick={() => window.open(item.imageUrl, '_blank')} className="w-full h-full object-cover cursor-pointer" />
                                      ) : (
                                        <span>{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}</span>
                                      )}
                                      <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                                        مطلوب: {item.neededQuantity} {item.unit}
                                      </span>
                                    </div>

                                    <div className="p-3 flex flex-col gap-2 flex-1">
                                      <div>
                                        <p className="font-black text-gray-900 dark:text-white text-sm line-clamp-1">{item.name}</p>
                                        <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                                          المفرد: <span className="font-black text-gray-800 dark:text-gray-200">{item.price ? Number(item.price).toLocaleString() : 0}</span> د.ع
                                        </p>
                                      </div>

                                      {/* Last Purchase & Cycle Badge */}
                                      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-2 text-[10px] space-y-1">
                                        <p className="text-orange-900 dark:text-orange-200 font-bold flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-orange-600" />
                                          آخر شراء: {metrics.lastPurchaseDate ? `${metrics.lastPurchaseDate} (قبل ${metrics.daysSinceLastPurchase} يوم)` : "غير مسجل"}
                                        </p>
                                        {metrics.averageCycleDays && (
                                          <p className="text-orange-700 dark:text-orange-300 font-bold">
                                            ⏳ تخلص كل ~{metrics.averageCycleDays} يوم
                                          </p>
                                        )}
                                      </div>

                                      <div className="mt-auto pt-1 flex gap-1.5">
                                        <button 
                                          onClick={() => {
                                            setPurchaseModal(item);
                                            setPurchaseQty(item.neededQuantity?.toString() || "1");
                                            setPurchasePrice(item.price ? (Number(item.price) * (Number(item.neededQuantity)||1)).toString() : "");
                                          }} 
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 rounded-xl transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                                        >
                                          <Check className="w-3.5 h-3.5" /> شراء الآن
                                        </button>
                                        <button
                                          onClick={() => setTimelineModalItem(item)}
                                          className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center shrink-0 transition"
                                          title="عرض سجل الشراء ومعدل النفاد"
                                        >
                                          <Clock className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available items section */}
                <div>
                  <h2 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    المواد المتوفرة بالمخزن ({filtered.length})
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
                              {catItems.map(item => {
                                const metrics = calculateItemConsumption(item, purchases);
                                return (
                                  <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col relative hover:shadow-md transition">
                                    <button onClick={() => setShowEditInventory(item)} className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="absolute top-2 left-2 z-10 w-7 h-7 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 transition">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <div className="h-32 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-4xl relative overflow-hidden">
                                      {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} onClick={() => window.open(item.imageUrl, '_blank')} className="w-full h-full object-cover cursor-pointer" />
                                      ) : (
                                        <span>{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}</span>
                                      )}
                                      <span className="absolute bottom-2 right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                                        متوفر: {item.quantity} {item.unit}
                                      </span>
                                    </div>

                                    <div className="p-3 flex flex-col gap-2 flex-1">
                                      <div>
                                        <p className="font-black text-gray-900 dark:text-white text-sm line-clamp-1">{item.name}</p>
                                        <p className="text-[11px] text-gray-500 font-bold mt-0.5">
                                          المفرد: <span className="font-black text-gray-800 dark:text-gray-200">{item.price ? Number(item.price).toLocaleString() : 0}</span> د.ع
                                        </p>
                                      </div>

                                      {/* Last Purchase & Cycle Badge */}
                                      <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-2 text-[10px] space-y-1">
                                        <p className="text-blue-900 dark:text-blue-200 font-bold flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-blue-600" />
                                          آخر شراء: {metrics.lastPurchaseDate ? `${metrics.lastPurchaseDate} (قبل ${metrics.daysSinceLastPurchase} يوم)` : "غير مسجل"}
                                        </p>
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                          {metrics.averageCycleDays ? (
                                            <span className="text-indigo-600 dark:text-indigo-400">
                                              ⏳ تخلص كل ~{metrics.averageCycleDays} يوم
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">الدورة قيد الحساب</span>
                                          )}
                                          <span className={metrics.depletionStatus === 'critical' ? 'text-red-500 font-black' : metrics.depletionStatus === 'warning' ? 'text-amber-500 font-black' : 'text-emerald-500 font-black'}>
                                            {metrics.estimatedDaysRemaining !== null ? `~${metrics.estimatedDaysRemaining} يوم` : "كافية"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-auto pt-1 flex gap-1.5">
                                        <button 
                                          onClick={() => {
                                            setPurchaseModal(item);
                                            setPurchaseQty("1");
                                            setPurchasePrice(item.price ? Number(item.price).toString() : "");
                                          }} 
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 rounded-xl transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                                        >
                                          <Plus className="w-3.5 h-3.5" /> شراء
                                        </button>
                                        <button
                                          onClick={() => setTimelineModalItem(item)}
                                          className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center shrink-0 transition"
                                          title="سجل الشراء والاستهلاك لهذه المادة"
                                        >
                                          <Clock className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
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
        </>
      )}

      {/* ═══════════════ TAB 2: PURCHASES & INVOICES LOG ═══════════════ */}
      {activeTab === 'purchases' && (
        <div className="px-4 sm:px-6 space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">إجمالي مشتريات المواد</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">
                    {totalSpentPurchases.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-400">د.ع</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">إجمالي {purchases.length} عملية شراء مسجلة</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-600 mb-1">مشتريات بفواتير رسمية 🧾</p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-300">
                    {totalInvoicedSpent.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-400">د.ع</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-blue-500 font-bold mt-2">{invoicedPurchases.length} فاتورة مسجلة</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-600 mb-1">مشتريات بدون فاتورة 🛒</p>
                  <p className="text-xl font-black text-emerald-900 dark:text-emerald-300">
                    {totalNonInvoicedSpent.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-400">د.ع</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-emerald-500 font-bold mt-2">{nonInvoicedPurchases.length} شراء مباشر / كاش</p>
            </div>
          </div>

          {/* Search & Invoiced Filter */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم المادة أو اسم المتجر..."
                  value={purchaseSearchQuery}
                  onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-sm rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Invoiced vs Non-invoiced toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPurchaseInvoiceFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    purchaseInvoiceFilter === 'all'
                      ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  الكل ({purchases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseInvoiceFilter('invoiced')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    purchaseInvoiceFilter === 'invoiced'
                      ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  بفاتورة ({invoicedPurchases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseInvoiceFilter('non_invoiced')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    purchaseInvoiceFilter === 'non_invoiced'
                      ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  بدون فاتورة ({nonInvoicedPurchases.length})
                </button>
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
              {["الكل", ...INVENTORY_CATEGORIES].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    filterCat === c
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Purchases Table / Cards */}
          {filteredPurchases.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center mx-auto">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="font-black text-lg text-gray-800 dark:text-white">لا توجد مشتريات مطابقة</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                يمكنك تصوير فاتورة بالذكاء الاصطناعي أو تسجيل شراء مواد مباشرة لمتابعة التواريخ ودورة الاستهلاك.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsScanInvoiceOpen(true)}
                  className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs px-4 py-2 rounded-xl transition"
                >
                  📸 مسح فاتورة
                </button>
                <button
                  onClick={() => setIsManualPurchaseOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition"
                >
                  🛒 تسجيل شراء يدوي
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((purchase) => {
                const pDate = new Date(purchase.purchaseDate);
                const daysAgo = Math.floor(
                  (new Date().getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={purchase.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-200 dark:hover:border-blue-800 transition"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          purchase.hasInvoice
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {purchase.hasInvoice ? (
                          <Receipt className="w-5 h-5" />
                        ) : (
                          <ShoppingCart className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-base text-gray-900 dark:text-white">
                            {purchase.itemName}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[purchase.category] || "bg-gray-100 text-gray-600"}`}>
                            {purchase.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              purchase.hasInvoice
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            }`}
                          >
                            {purchase.hasInvoice ? "بفاتورة 🧾" : "بدون فاتورة 🛒"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="font-bold text-gray-700 dark:text-gray-300">
                            الكمية: {purchase.quantity} {purchase.unit}
                          </span>
                          <span>•</span>
                          <span>المفرد: {Number(purchase.unitPrice).toLocaleString()} د.ع</span>
                          {purchase.storeName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
                                <Store className="w-3.5 h-3.5" />
                                {purchase.storeName}
                              </span>
                            </>
                          )}
                          {purchase.invoiceNumber && (
                            <>
                              <span>•</span>
                              <span className="text-gray-400">وصل #{purchase.invoiceNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-right sm:text-left">
                        <p className="text-base font-black text-gray-900 dark:text-white">
                          {Number(purchase.totalPrice).toLocaleString()}{" "}
                          <span className="text-xs font-normal text-gray-400">د.ع</span>
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-gray-500 justify-end">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>{purchase.purchaseDate}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            ({daysAgo === 0 ? "اليوم" : daysAgo === 1 ? "أمس" : `قبل ${daysAgo} يوم`})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {purchase.invoiceImageUrl && (
                          <button
                            type="button"
                            onClick={() => window.open(purchase.invoiceImageUrl, '_blank')}
                            className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition"
                            title="عرض صورة الفاتورة"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(purchase.id!)}
                          className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-red-500 transition"
                          title="حذف هذا الشراء"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB 3: CONSUMPTION & DEPLETION FORECAST ═══════════════ */}
      {activeTab === 'cycles' && (
        <div className="px-4 sm:px-6 space-y-6">
          {/* Intro & Methodology Banner */}
          <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 border border-blue-200/60 dark:border-blue-900/40 rounded-3xl p-5 space-y-2">
            <h3 className="font-black text-base text-blue-950 dark:text-blue-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              دورة الاستهلاك وحساب مدة النفاد الذكية
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              يقوم النظام تلقائياً بدراسة الفترات بين كل عملية شراء لمواد الكيك، وحساب معدل الاستهلاك اليومي، ثم مقارنته مع كميتك المتوفرة حالياً في المخزن، ليعلمك بدقة:
              <strong className="text-blue-700 dark:text-blue-300 font-black"> كل كم يوم تخلص المادة وكم يوماً متبقي حتى تنفد الكمية الحالية</strong> لتخطط للشراء المسبق.
            </p>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCycleFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                cycleFilterStatus === 'all'
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
              }`}
            >
              الكل ({itemsWithConsumption.length})
            </button>
            <button
              onClick={() => setCycleFilterStatus('critical')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                cycleFilterStatus === 'critical'
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40"
              }`}
            >
              <span>🔴 حرجة / شراء عاجل ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === 'critical').length})</span>
            </button>
            <button
              onClick={() => setCycleFilterStatus('warning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                cycleFilterStatus === 'warning'
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40"
              }`}
            >
              <span>🟡 قاربت على النفاد خلال أسبوع ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === 'warning').length})</span>
            </button>
            <button
              onClick={() => setCycleFilterStatus('safe')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                cycleFilterStatus === 'safe'
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40"
              }`}
            >
              <span>🟢 كمية آمنة كافية ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === 'safe').length})</span>
            </button>
          </div>

          {/* Cards arranged by urgency */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCyclesItems.map(({ item, metrics }) => {
              const currentStock = Number(item.quantity) || 0;
              const minAlert = Number(item.minAlert) || 1;

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                    metrics.depletionStatus === 'critical'
                      ? "border-red-200 dark:border-red-900/50"
                      : metrics.depletionStatus === 'warning'
                      ? "border-amber-200 dark:border-amber-900/50"
                      : "border-gray-100 dark:border-zinc-800"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Row: Title, Category, Status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] || "bg-gray-100 text-gray-600"}`}>
                          {item.category}
                        </span>
                        <h4 className="font-black text-base text-gray-900 dark:text-white mt-1">
                          {item.name}
                        </h4>
                      </div>

                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-xl shrink-0 ${
                          metrics.depletionStatus === 'critical'
                            ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50"
                            : metrics.depletionStatus === 'warning'
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                        }`}
                      >
                        {metrics.depletionStatusText}
                      </span>
                    </div>

                    {/* Stock & Consumption Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-2xl text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block">المخزون الحالي</span>
                        <span className="font-black text-sm text-gray-900 dark:text-white">
                          {currentStock} {item.unit}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block">آخر شراء مسجل</span>
                        <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                          {metrics.lastPurchaseDate ? `${metrics.lastPurchaseDate}` : "غير مسجل"}
                        </span>
                        {metrics.daysSinceLastPurchase !== null && (
                          <span className="text-[10px] text-gray-400 block">قبل {metrics.daysSinceLastPurchase} يوم</span>
                        )}
                      </div>

                      <div className="pt-2 border-t border-gray-200 dark:border-zinc-700/60">
                        <span className="text-[10px] text-gray-400 font-bold block">دورة النفاد (كل شكد تخلص)</span>
                        <span className="font-black text-xs text-purple-700 dark:text-purple-300">
                          {metrics.averageCycleDays ? `كل ~${metrics.averageCycleDays} يوم` : "تحت المراقبة"}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-200 dark:border-zinc-700/60">
                        <span className="text-[10px] text-gray-400 font-bold block">معدل الاستهلاك اليومي</span>
                        <span className="font-bold text-xs text-gray-700 dark:text-gray-300">
                          {metrics.dailyConsumptionRate ? `~${metrics.dailyConsumptionRate} ${item.unit}/يوم` : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Depletion Countdown Banner */}
                    <div className={`p-3 rounded-2xl flex items-center justify-between text-xs ${
                      metrics.depletionStatus === 'critical'
                        ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-900/40"
                        : metrics.depletionStatus === 'warning'
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40"
                        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/40"
                    }`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="font-black">
                            {metrics.estimatedDaysRemaining !== null
                              ? `متبقي تقريباً: ~${metrics.estimatedDaysRemaining} يوم`
                              : "الكمية متوفرة بشكل كافٍ"}
                          </p>
                          {metrics.depletionEstimatedDate && (
                            <p className="text-[10px] opacity-80">تاريخ النفاد المتوقع: {metrics.depletionEstimatedDate}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
                    <button
                      onClick={() => {
                        setManualPurchaseInitialItem(item);
                        setIsManualPurchaseOpen(true);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> تسجيل شراء
                    </button>
                    <button
                      onClick={() => setTimelineModalItem(item)}
                      className="py-2 px-3 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 font-bold text-xs transition flex items-center gap-1"
                    >
                      <Receipt className="w-3.5 h-3.5" /> السجل ({metrics.purchaseCount})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* 1. AI Cake Invoice Scanner Modal */}
      <ScanCakeInvoiceModal
        isOpen={isScanInvoiceOpen}
        onClose={() => setIsScanInvoiceOpen(false)}
        inventoryItems={items}
        onSuccess={() => {
          fetchItems();
        }}
      />

      {/* 2. Manual Cake Purchase Modal (with or without invoice) */}
      <ManualCakePurchaseModal
        isOpen={isManualPurchaseOpen}
        onClose={() => {
          setIsManualPurchaseOpen(false);
          setManualPurchaseInitialItem(null);
        }}
        inventoryItems={items}
        initialItem={manualPurchaseInitialItem}
        onSuccess={() => {
          fetchItems();
        }}
      />

      {/* 3. Material Timeline Modal */}
      <CakeMaterialTimelineModal
        isOpen={!!timelineModalItem}
        onClose={() => setTimelineModalItem(null)}
        item={timelineModalItem}
        allPurchases={purchases}
        onOpenPurchaseModal={(it) => {
          setManualPurchaseInitialItem(it);
          setIsManualPurchaseOpen(true);
        }}
        onDeletePurchase={handleDeletePurchase}
      />

      {/* 4. Edit Inventory Item Modal */}
      {showEditInventory && (
        <EditInventoryModal
          isOpen={true}
          onClose={() => setShowEditInventory(null)}
          item={showEditInventory}
          onEditSuccess={() => { fetchItems(); }}
        />
      )}

      {/* 5. Quick Purchase Modal (Existing) */}
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

              {/* Invoice Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-300">مرفق فاتورة / وصل؟</span>
                <button
                  type="button"
                  onClick={() => setPurchaseHasInvoice(!purchaseHasInvoice)}
                  className={`px-3 py-1 rounded-lg font-black transition ${
                    purchaseHasInvoice ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {purchaseHasInvoice ? "🧾 بفاتورة" : "🛒 بدون فاتورة"}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">اسم المحل / المورد (اختياري)</label>
                <input
                  type="text"
                  value={purchaseStoreName}
                  onChange={(e) => setPurchaseStoreName(e.target.value)}
                  placeholder="المعرض / السوق"
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">تم الدفع من</label>
                <div className="grid grid-cols-2 gap-2">
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
                  <button type="button" onClick={() => setPurchaseSource('none')}
                    className={`py-2 rounded-xl font-black text-[10px] border transition ${
                      purchaseSource === 'none' ? 'bg-gray-700 text-white border-gray-700 shadow-sm' : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 border-gray-200 dark:border-zinc-700'
                    }`}>بدون إضافة مصروف</button>
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

      {/* 6. Add Inventory Item Modal */}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
