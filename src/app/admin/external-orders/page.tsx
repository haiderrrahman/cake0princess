"use client";
import { customConfirm } from '@/lib/customConfirm';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Search, Plus, Loader2, Image as ImageIcon, Trash2, Calendar, Smartphone, DollarSign, Calculator, User, Edit3 } from "lucide-react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, orderBy, query, limit, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import { compressImage } from "@/lib/imageUtils";
import FormattedNumberInput from "@/components/FormattedNumberInput";
import DatePicker from "react-datepicker";
import { format } from "date-fns";
import { ar } from "date-fns/locale/ar";
import "react-datepicker/dist/react-datepicker.css";

export default function ExternalOrdersAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"orders" | "debts">("orders");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settleOrder, setSettleOrder] = useState<any>(null);
  const [settlePaidAmount, setSettlePaidAmount] = useState<string>("");
  const [settleDebtType, setSettleDebtType] = useState<"none" | "customer_owes" | "we_owe">("none");
  const [settleRemainingAmount, setSettleRemainingAmount] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [platform, setPlatform] = useState("إنستجرام");
  const [cakeName, setCakeName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<string>(new Date().toISOString());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrdersAndCustomers = async () => {};

  useEffect(() => {
    // ⚡ Instant load from cache (0ms perceived latency)
    try {
      const cached = localStorage.getItem("cache_external_orders");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    const q = query(collection(db, "external_orders"), orderBy("createdAt", "desc"), limit(150));
    
    // onSnapshot is much faster and gives real-time updates directly from local cache first
    const unsubscribeOrders = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetchedOrders);
      setLoading(false);
      try { localStorage.setItem("cache_external_orders", JSON.stringify(fetchedOrders)); } catch (e) {}
    }, (err) => {
      console.error("Error fetching external orders, falling back to unordered:", err);
      // Fallback if index fails
      getDocs(collection(db, "external_orders")).then(snap => {
        let fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        fetchedOrders.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
        fetchedOrders = fetchedOrders.slice(0, 150);
        setOrders(fetchedOrders);
        setLoading(false);
      });
    });

    const unsubscribeCustomers = onSnapshot(collection(db, "customers"), (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
    };
  }, []);

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomerName(name);
    const existing = customers.find(c => c.name === name);
    if (existing && existing.phone) {
      setCustomerPhone(existing.phone);
    }
  };

  const openEditModal = (order: any) => {
    setIsEditMode(true);
    setEditOrderId(order.id);
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setPlatform(order.platform || "إنستجرام");
    setCakeName(order.cakeName || "");
    setPrice(order.price ? String(order.price) : "");
    setCost(order.cost ? String(order.cost) : "");
    setDeliveryDate(order.deliveryDate || new Date().toISOString());
    setImagePreview(order.imageUrl || null);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !cakeName || !price || !deliveryDate) {
      if (!deliveryDate) toast.error("يرجى تحديد تاريخ التسليم");
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        if (!navigator.onLine) {
          toast.error("أنت غير متصل بالإنترنت. سيتم الحفظ بدون رفع الصورة.");
        } else {
          // Compress image before upload to make it fast
          const compressedFile = await compressImage(imageFile);
          const fileRef = ref(storage, `external_orders/${Date.now()}_${compressedFile.name}`);
          await uploadBytes(fileRef, compressedFile);
          imageUrl = await getDownloadURL(fileRef);
        }
      }

      const parseIqdInput = (val: string | number) => {
        let num = Number(val) || 0;
        if (num > 0 && num < 1000) num *= 1000;
        return num;
      };

      const numPrice = parseIqdInput(price);
      const numCost = cost ? parseIqdInput(cost) : 0;
      const profit = numCost > 0 ? numPrice - numCost : numPrice;

      const existingCustomer = customers.find(c => c.name === customerName);
      let customerId = existingCustomer?.id;
      
      const promisesToRace = [];

      if (!existingCustomer) {
        const custRefPromise = addDoc(collection(db, "customers"), {
          name: customerName,
          phone: customerPhone,
          points: Math.floor(numPrice / 1000), // 1 point per 1000 IQD
          totalSpent: numPrice,
          ordersCount: 1,
          createdAt: serverTimestamp(),
        });
        
        promisesToRace.push(custRefPromise.then(ref => { customerId = ref.id; }));
      } else {
        const docRef = doc(db, "customers", customerId!);
        const updateCustPromise = updateDoc(docRef, {
          phone: customerPhone || existingCustomer.phone, // Update if provided
          points: (existingCustomer.points || 0) + Math.floor(numPrice / 1000),
          totalSpent: (existingCustomer.totalSpent || 0) + numPrice,
          ordersCount: (existingCustomer.ordersCount || 0) + 1,
          lastOrder: serverTimestamp()
        });
        promisesToRace.push(updateCustPromise);
      }

      await Promise.race([
        Promise.all(promisesToRace),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      const orderData = {
        customerId: customerId || "offline-temp-id",
        customerName,
        customerPhone,
        platform,
        cakeName,
        price: numPrice,
        cost: numCost,
        profit,
        deliveryDate,
        ...(imageUrl && { imageUrl }),
        ...(!isEditMode && { createdAt: serverTimestamp() }),
      };

      if (isEditMode && editOrderId) {
        await updateDoc(doc(db, "external_orders", editOrderId), orderData);
        toast.success("تم التحديث بنجاح");
      } else {
        await addDoc(collection(db, "external_orders"), orderData);
        if (!navigator.onLine) {
          toast.success("تم الحفظ محلياً (قيد المزامنة)");
        } else {
          toast.success("تم إضافة الطلب بنجاح");
        }
      }

      // We removed the addOrderPromise Promise.race because we handle it in if-else

      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setCakeName("");
      setPrice("");
      setCost("");
      setDeliveryDate(new Date().toISOString());
      setImageFile(null);
      setImagePreview(null);
      setIsModalOpen(false);
      setIsEditMode(false);
      setEditOrderId(null);
      fetchOrdersAndCustomers();
    } catch (error) {
      console.error("Error adding order:", error);
      toast.error("حدث خطأ أثناء إضافة الطلب");
    }
    setSubmitting(false);
  };


  const handleSettleDebt = async (order: any) => {
    if (await customConfirm("هل تم تسديد هذا الدين بالكامل؟")) {
      try {
        await updateDoc(doc(db, "external_orders", order.id), { 
          paidAmount: order.price,
          isDebtSettled: true 
        });
        toast.success("تم تسديد الدين بنجاح");
        fetchOrdersAndCustomers();
      } catch (e) {
        toast.error("خطأ أثناء التسديد");
      }
    }
  };


  const handleStatusChange = async (order: any, newStatus: string) => {
    if (newStatus === "delivered") {
      setSettleOrder(order);
      setSettleDebtType("none");
      setSettleRemainingAmount("");
    } else {
      await updateDoc(doc(db, "external_orders", order.id), { status: newStatus });
      toast.success("تم تحديث الحالة");
      fetchOrdersAndCustomers();
    }
  };

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder) return;
    
    if (settleDebtType !== "none" && !settleRemainingAmount) {
      toast.error("يرجى إدخال المبلغ الباقي");
      return;
    }

    const parseNumber = (val: any) => {
      if (!val) return 0;
      const str = String(val).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                             .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
                             .replace(/,/g, '');
      return Number(str) || 0;
    };

    let finalPaidAmount = Number(settleOrder.price);
    const remAmt = parseNumber(settleRemainingAmount);
    
    if (settleDebtType === "customer_owes") {
      finalPaidAmount = Number(settleOrder.price) - remAmt; // They paid less
    } else if (settleDebtType === "we_owe") {
      finalPaidAmount = Number(settleOrder.price) + remAmt; // They paid more
    }
    
    try {
      await updateDoc(doc(db, "external_orders", settleOrder.id), { 
        status: "delivered", 
        paidAmount: finalPaidAmount 
      });
      toast.success("تم تحديث الطلب بنجاح");
      setSettleOrder(null);
      fetchOrdersAndCustomers();
    } catch (e) {
      toast.error("حدث خطأ");
    }
  };

  const handleDelete = async (id: string) => {
    if (await customConfirm("هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.")) {
      try {
        await deleteDoc(doc(db, "external_orders", id));
        setOrders(orders.filter(o => o.id !== id));
      } catch (error) {
        console.error("Error deleting order:", error);
      }
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.cakeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || (o.status || "pending") === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const isDeliveredA = a.status === 'delivered' || a.status === 'completed';
    const isDeliveredB = b.status === 'delivered' || b.status === 'completed';
    
    if (isDeliveredA && !isDeliveredB) return 1;
    if (!isDeliveredA && isDeliveredB) return -1;
    
    const parseDate = (d: any) => {
      if (!d) return new Date(8640000000000000); // push to bottom if no date
      if (d.toDate) return d.toDate();
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? new Date(8640000000000000) : parsed;
    };
    
    const dateA = parseDate(a.deliveryDate);
    const dateB = parseDate(b.deliveryDate);
    
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0D0A1A] pb-24">
      {/* ═══════════════ LUXURY EMERALD HEADER BANNER ═══════════════ */}
      <div className="bg-gradient-to-l from-emerald-900 via-teal-900 to-slate-950 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">الطلبات الخارجية (السوشيال)</h1>
              <p className="text-xs text-emerald-200 font-bold">طلبات انستغرام، واتساب، والمكالمات</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto relative z-10">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="بحث بالاسم أو الطلب أو الهاتف..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-400 backdrop-blur-md transition"
              />
            </div>
            <button 
              onClick={() => {
                setIsEditMode(false);
                setEditOrderId(null);
                setCustomerName("");
                setCustomerPhone("");
                setCakeName("");
                setPrice("");
                setCost("");
                setDeliveryDate(new Date().toISOString());
                setImageFile(null);
                setImagePreview(null);
                setIsModalOpen(true);
              }}
              className="bg-white text-emerald-950 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-black shadow-sm hover:bg-gray-100 transition active:scale-95 flex-shrink-0"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>إضافة سوشيال</span>
            </button>
          </div>
        </div>

        {/* Stats Header integrated into the luxury header */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

          let todaySales = 0, weekSales = 0, monthSales = 0;

          orders.forEach(o => {
            if (["rejected", "cancelled"].includes(o.status)) return;
            const amt = Number(o.price) || 0;
            const d = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
            d.setHours(0,0,0,0);
            
            if (d.getTime() === today.getTime()) todaySales += amt;
            if (d >= weekAgo) weekSales += amt;
            if (d >= thirtyDaysAgo) monthSales += amt;
          });

          return (
            <div className="grid grid-cols-3 gap-2.5 mt-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-emerald-200 mb-1">مبيعات اليوم</p>
                <p className="text-sm md:text-xl font-black text-white">{todaySales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-emerald-200 mb-1">مبيعات الأسبوع</p>
                <p className="text-sm md:text-xl font-black text-white">{weekSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-emerald-200 mb-1">مبيعات الشهر</p>
                <p className="text-sm md:text-xl font-black text-white">{monthSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
          );
        })()}
      </div>


      {/* ═══════════════ TABS ═══════════════ */}
      <div className="px-5 mb-4">
        <div className="flex bg-white dark:bg-zinc-900 rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-zinc-800">
          <button 
            onClick={() => setActiveTab("orders")}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === "orders" ? "bg-emerald-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
          >
            سجل الطلبات
          </button>
          <button 
            onClick={() => setActiveTab("debts")}
            className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === "debts" ? "bg-purple-500 text-white shadow-md" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
          >
            الديون والمستحقات
          </button>
        </div>
      </div>

      {activeTab === "orders" && (
        <>
      {/* Visible Filter Grid (No Horizontal Scroll / Swipe) */}
      <div className="px-5 mb-6">
        <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {[
            { key: "all", label: "الكل 📋" },
            { key: "pending", label: "⏳ قيد التحضير" },
            { key: "prepared", label: "✨ تم التحضير" },
            { key: "delivering", label: "🚗 قيد التوصيل" },
            { key: "delivered", label: "✅ تم التسليم" },
          ].map((f: any) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${statusFilter === f.key ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد طلبات خارجية</h2>
          <p className="text-gray-500 text-sm">أضف طلباتك من السوشيال ميديا لحساب الأرباح الكلية.</p>
        </div>
      ) : (
        <div className="space-y-3">
          
          {(() => {
            const debts = filteredOrders.filter(o => o.status === "delivered" && o.paidAmount !== undefined && o.paidAmount !== o.price && !o.isDebtSettled);
            const normals = filteredOrders.filter(o => !(o.status === "delivered" && o.paidAmount !== undefined && o.paidAmount !== o.price && !o.isDebtSettled));
            return (
              <>
                {debts.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <div className="flex flex-col gap-2 mb-4">
                      <h3 className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        سجل الديون (طلبات السوشيال)
                      </h3>
                      {(() => {
                        const sumOweUs = debts.filter(o => o.price > (o.paidAmount || 0)).reduce((s, o) => s + (o.price - (o.paidAmount || 0)), 0);
                        const sumWeOwe = debts.filter(o => o.price < (o.paidAmount || 0)).reduce((s, o) => s + ((o.paidAmount || 0) - o.price), 0);
                        return (
                          <div className="flex gap-3">
                            {sumOweUs > 0 && <span className="bg-rose-100 text-rose-800 text-xs font-black px-3 py-1.5 rounded-lg border border-rose-200">مجموع نطلبهم: {sumOweUs.toLocaleString()} د.ع</span>}
                            {sumWeOwe > 0 && <span className="bg-blue-100 text-blue-800 text-xs font-black px-3 py-1.5 rounded-lg border border-blue-200">مجموع يطلبونا: {sumWeOwe.toLocaleString()} د.ع</span>}
                          </div>
                        );
                      })()}
                    </div>
                    {debts.map(order => {
                      const customerOwesUs = order.price > (order.paidAmount || 0);
                      const diff = Math.abs(order.price - (order.paidAmount || 0));
                      return (
                        <div key={order.id} className={`bg-white dark:bg-zinc-900 rounded-[24px] p-4 border-2 shadow-sm flex flex-col md:flex-row gap-4 relative group hover:shadow-md transition ${customerOwesUs ? 'border-rose-400 dark:border-rose-800/50' : 'border-blue-400 dark:border-blue-800/50'}`}>
                          <div className="w-full md:w-24 h-32 md:h-24 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 relative border border-gray-100 dark:border-zinc-700">
                            {order.imageUrl ? (
                              <Image src={order.imageUrl} alt={order.cakeName} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Smartphone className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <div>
                                  <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight">{order.cakeName}</h3>
                                  <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> {order.customerName}
                                  </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <div className={`px-3 py-1 rounded-lg text-xs font-black ${customerOwesUs ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {customerOwesUs ? 'نطلبه' : 'يطلبنا'}: {diff.toLocaleString()} د.ع
                                  </div>
                                  <button onClick={() => openEditModal(order)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center transition hover:bg-blue-100">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDelete(order.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center transition hover:bg-red-100">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-gray-50 dark:border-zinc-800/50">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold">الإجمالي</span>
                                <span className="text-sm font-black text-gray-700 dark:text-gray-300">{Number(order.price).toLocaleString()} د.ع</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-bold">الواصل</span>
                                <span className="text-sm font-black text-gray-700 dark:text-gray-300">{Number(order.paidAmount || 0).toLocaleString()} د.ع</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-3">
                  {normals.map(order => (
                    <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-4 relative group hover:shadow-md transition">

              {/* Image / Icon */}
              <div className="w-full md:w-24 h-32 md:h-24 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 relative border border-gray-100 dark:border-zinc-700">
                {order.imageUrl ? (
                  <Image src={order.imageUrl} alt={order.cakeName} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Smartphone className="w-8 h-8" />
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight">{order.cakeName}</h3>
                      <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> {order.customerName}
                        <span className="text-gray-300 mx-1">•</span>
                        <Smartphone className="w-3.5 h-3.5" /> {order.platform}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select 
                        value={order.status || 'pending'} 
                        onChange={(e) => handleStatusChange(order, e.target.value)}
                        className="text-xs font-bold bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 outline-none focus:border-emerald-500"
                      >
                        <option value="pending">⏳ قيد التحضير</option>
                        <option value="prepared">✨ تم التحضير</option>
                        <option value="delivering">🚗 قيد التوصيل</option>
                        <option value="delivered">✅ تم التسليم</option>
                        <option value="cancelled">❌ ملغي</option>
                      </select>
                      <button onClick={() => openEditModal(order)} className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-blue-100">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(order.id)} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-gray-50 dark:border-zinc-800/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold">تاريخ التسليم</span>
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-500" />
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("ar-IQ") : 'غير محدد'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold">التكلفة</span>
                    <span className="text-xs font-black text-gray-700 dark:text-gray-300">{Number(order.cost).toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold">الربح الصافي</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{Number(order.profit).toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex flex-col ml-auto text-left">
                    <span className="text-[10px] text-gray-400 font-bold">الإجمالي</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{Number(order.price).toLocaleString()} د.ع</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

        </>
      )}

      {activeTab === "debts" && !loading && (() => {
        // Debts are orders where status is 'delivered' and paidAmount != price and !isDebtSettled
        const debtOrders = orders.filter(o => o.status === "delivered" && o.paidAmount !== undefined && o.paidAmount !== o.price && !o.isDebtSettled);
        const customersOweUs = debtOrders.filter(o => o.paidAmount < o.price);
        const weOweCustomers = debtOrders.filter(o => o.paidAmount > o.price);

        const totalCustomersOweUs = customersOweUs.reduce((s, o) => s + (o.price - o.paidAmount), 0);
        const totalWeOweCustomers = weOweCustomers.reduce((s, o) => s + (o.paidAmount - o.price), 0);

        return (
          <div className="px-5 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/10 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">الديون التي لك (تطلبهم)</p>
                <p className="text-xl font-black text-rose-700 dark:text-rose-300">{totalCustomersOweUs.toLocaleString()} د.ع</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">الديون التي عليك (يطلبونك)</p>
                <p className="text-xl font-black text-amber-700 dark:text-amber-300">{totalWeOweCustomers.toLocaleString()} د.ع</p>
              </div>
            </div>

            {/* Customers Owe Us */}
            <div>
              <h2 className="font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-3">
                <User className="w-5 h-5" />
                جماعة المديون (أنت تطلبهم)
              </h2>
              {customersOweUs.length === 0 ? (
                <p className="text-sm font-bold text-gray-400">لا يوجد ديون لك حالياً.</p>
              ) : (
                <div className="space-y-3">
                  {customersOweUs.map(order => (
                    <div key={order.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <h3 className="font-black text-gray-800 dark:text-white mb-1">{order.customerName} <span className="text-xs font-bold text-gray-400">({order.cakeName})</span></h3>
                        <p className="text-xs font-bold text-gray-500">السعر: {order.price.toLocaleString()} | الواصل: {order.paidAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-black text-rose-600 mb-1">{(order.price - order.paidAmount).toLocaleString()} د.ع</div>
                        <button onClick={() => handleSettleDebt(order)} className="text-xs font-black bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-200">تم التسديد</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* We Owe Customers */}
            <div>
              <h2 className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-3">
                <User className="w-5 h-5" />
                جماعة الدين (هم يطلبونك)
              </h2>
              {weOweCustomers.length === 0 ? (
                <p className="text-sm font-bold text-gray-400">لا توجد مبالغ بذمتك للزبائن.</p>
              ) : (
                <div className="space-y-3">
                  {weOweCustomers.map(order => (
                    <div key={order.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                      <div>
                        <h3 className="font-black text-gray-800 dark:text-white mb-1">{order.customerName} <span className="text-xs font-bold text-gray-400">({order.cakeName})</span></h3>
                        <p className="text-xs font-bold text-gray-500">السعر: {order.price.toLocaleString()} | الواصل: {order.paidAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-left">
                        <div className="text-lg font-black text-amber-600 mb-1">{(order.paidAmount - order.price).toLocaleString()} د.ع</div>
                        <button onClick={() => handleSettleDebt(order)} className="text-xs font-black bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200">تم الإرجاع والتسوية</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      
      {settleOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-lg">تسوية الطلب وتسليمه</h3>
              <button type="button" onClick={() => setSettleOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitSettlement} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">المبلغ الإجمالي للطلب</label>
                <div className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-gray-500 font-black text-center text-lg">
                  {Number(settleOrder.price).toLocaleString()} د.ع
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2 text-emerald-600">حالة الحساب عند التسليم</label>
                <select 
                  value={settleDebtType}
                  onChange={(e) => setSettleDebtType(e.target.value as any)}
                  className="w-full bg-white dark:bg-zinc-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none font-bold"
                >
                  <option value="none">✅ خالص (تم دفع كامل المبلغ)</option>
                  <option value="customer_owes">🔴 الزبون عليه دين (نطلبه باقي)</option>
                  <option value="we_owe">🔵 دين لنا للزبون (يطلبنا باقي)</option>
                </select>
              </div>

              {settleDebtType !== "none" && (
                <div className="animate-fade-in-up">
                  <label className={`block text-sm font-bold mb-2 ${settleDebtType === 'customer_owes' ? 'text-rose-600' : 'text-blue-600'}`}>
                    المبلغ الباقي (د.ع)
                  </label>
                  <input 
                    type="number" 
                    required 
                    value={settleRemainingAmount} 
                    onChange={e => setSettleRemainingAmount(e.target.value)}
                    className={`w-full bg-white dark:bg-zinc-800 border-2 rounded-xl px-4 py-3 focus:outline-none font-black text-lg ${settleDebtType === 'customer_owes' ? 'border-rose-300 focus:border-rose-500 text-rose-600' : 'border-blue-300 focus:border-blue-500 text-blue-600'}`} 
                    placeholder="أدخل المبلغ الباقي فقط..." 
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    {settleDebtType === 'customer_owes' 
                      ? "سيتم تسجيل هذا المبلغ كدين مطلوب من الزبون، وسيظهر الطلب في أعلى القائمة بإشارة حمراء."
                      : "سيتم تسجيل هذا المبلغ كأمانة أو دين للزبون بذمتكم، وسيظهر بإشارة زرقاء."}
                  </p>
                </div>
              )}

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition mt-6 shadow-md shadow-emerald-500/20">
                تأكيد التسليم
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h3 className="font-bold text-xl">{isEditMode ? "تعديل الطلب" : "إضافة طلب خارجي"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleAddOrder} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">اسم الزبون</label>
                  <input required type="text" value={customerName} onChange={handleCustomerNameChange} list="customers-list-external" className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" placeholder="مثال: سارة محمد" />
                  <datalist id="customers-list-external">
                    {customerName.length > 0 && customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 15).map(c => <option key={c.id} value={c.name}>{c.phone ? `(${c.phone})` : ""}</option>)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">رقم الهاتف (اختياري)</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} dir="ltr" className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" placeholder="07XXXXXXXXX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">المنصة</label>
                  <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none">
                    <option value="إنستجرام">إنستجرام</option>
                    <option value="واتساب">واتساب</option>
                    <option value="فيسبوك">فيسبوك</option>
                    <option value="تيك توك">تيك توك</option>
                    <option value="هاتف">اتصال هاتفي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">تاريخ ووقت التسليم</label>
                  <DatePicker
                    selected={deliveryDate ? new Date(deliveryDate) : null}
                    onChange={(date: Date | null) => setDeliveryDate(date ? date.toISOString() : new Date().toISOString())}
                    locale={ar}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={30}
                    timeCaption="الوقت"
                    dateFormat="yyyy/MM/dd h:mm aa"
                    placeholderText="اختر التاريخ والوقت..."
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    wrapperClassName="w-full"
                    withPortal
                  >
                    <div className="p-2 border-t border-gray-200 dark:border-zinc-700 mt-2 flex justify-end">
                      <button type="button" className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm" onClick={() => {
                        document.querySelector('.react-datepicker__portal')?.remove();
                        document.body.classList.remove('react-datepicker-portal-open');
                        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
                        document.dispatchEvent(escapeEvent);
                      }}>تم ✔</button>
                    </div>
                  </DatePicker>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">تفاصيل الطلب (الكيك)</label>
                <textarea required value={cakeName} onChange={e => setCakeName(e.target.value)} className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none min-h-[80px]" placeholder="مثال: كيكة عيد ميلاد طابقين بنكهة الفراولة..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <div>
                  <label className="block text-sm font-bold mb-2 text-emerald-800 dark:text-emerald-200">سعر البيع للزبون (د.ع)</label>
                  <FormattedNumberInput required value={price} onChange={val => setPrice(val)} className="w-full bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" placeholder="مثال: 55" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-emerald-800 dark:text-emerald-200">تكلفة الصنع (د.ع) - اختياري</label>
                  <FormattedNumberInput value={cost} onChange={val => setCost(val)} className="w-full bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" placeholder="مثال: 20" />
                </div>
                
                {price && (
                  <div className="col-span-2 pt-2 flex items-center justify-between text-emerald-700 dark:text-emerald-400 border-t border-emerald-200 dark:border-emerald-800/50 mt-2">
                    <span className="text-sm font-bold flex items-center gap-2"><Calculator className="w-4 h-4"/> الربح الصافي:</span>
                    <span className="font-black text-lg">{(Number(price) - (cost ? Number(cost) : 0)).toLocaleString()} د.ع</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">صورة الكيكة (اختياري)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition relative overflow-hidden"
                >
                  {imagePreview ? (
                    <Image src={imagePreview} alt="Preview" fill className="object-contain" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">اضغط لرفع صورة الكيكة</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 transition disabled:opacity-70 disabled:cursor-not-allowed">
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : isEditMode ? "حفظ التعديلات" : "إضافة الطلب"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
