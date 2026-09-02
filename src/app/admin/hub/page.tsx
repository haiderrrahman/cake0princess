"use client";
import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShoppingBag, CheckCircle, XCircle, Clock, Loader2, Package, Plus,
  DollarSign, AlertTriangle, TrendingUp, Smartphone, Receipt,
  BarChart3, RefreshCw, ChevronRight, User, Phone, MapPin,
  Calendar, ArrowRight, Search, Filter, Edit, ChevronDown, GraduationCap, PlayCircle, Image as ImageIcon, Check, MessageCircle, Sparkles, PackageCheck, Banknote
} from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit, onSnapshot, increment, where } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import InventoryDeductModal from "@/components/InventoryDeductModal";
import EditExternalOrderModal from "@/components/EditExternalOrderModal";
import EditInventoryModal from "@/components/EditInventoryModal";
import AdminQuickEntry from "@/components/AdminQuickEntry";
import CustomerProfileModal from "@/components/CustomerProfileModal";
import { customConfirm } from '@/lib/customConfirm';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "بانتظار الدفع", color: "text-gray-500", bg: "bg-gray-100 dark:bg-zinc-800" },
  processing: { label: "قيد التجهيز",  color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  delivering: { label: "قيد التوصيل",  color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  delivered:  { label: "تم التوصيل",   color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
  completed:  { label: "مكتمل",         color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  rejected:   { label: "مرفوض",         color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
  cancelled:  { label: "ملغي",           color: "text-red-400", bg: "bg-red-50 dark:bg-red-900/10" },
};

const EXTERNAL_STATUS_CONFIG: any = {
  pending:    { label: "قيد التحضير", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  prepared:   { label: "تم التحضير",   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  delivering: { label: "قيد التسليم",  color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  delivered:  { label: "تم التسليم",   color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
};

const CUSTOM_STATUS_CONFIG: any = {
  pending:    { label: "قيد المراجعة", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
  accepted:   { label: "تم القبول (جاري التنفيذ)", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
  completed:  { label: "مكتمل", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  rejected:   { label: "مرفوض", color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
};

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

export default function AdminHub() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
      <AdminHubContent />
    </Suspense>
  );
}

function AdminHubContent() {
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const hasOrders = localStorage.getItem('cache_orders');
      const hasExt = localStorage.getItem('cache_external_orders');
      const hasInv = localStorage.getItem('cache_inventory');
      return !(hasOrders && hasExt && hasInv);
    }
    return true;
  });
  const [orders, setOrders] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cache_orders');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [externalOrders, setExternalOrders] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cache_external_orders');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [customOrders, setCustomOrders] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [homeDebts, setHomeDebts] = useState<any[]>([]);
  const [homeExpenses, setHomeExpenses] = useState<any[]>([]);
  const [homeIncomes, setHomeIncomes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cache_inventory');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [settleOrder, setSettleOrder] = useState<any>(null);
  const [settleOrderType, setSettleOrderType] = useState<"external" | "app" | null>(null);
  const [settleDebtType, setSettleDebtType] = useState<"none" | "customer_owes" | "we_owe">("none");
  const [settleRemainingAmount, setSettleRemainingAmount] = useState<string>("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab') as string;
  const defaultTab = rawTab || "external";
  const activeTab = (defaultTab === "stats" ? "audit" : defaultTab) as "orders" | "external" | "supplies_orders" | "courses" | "inventory" | "audit";

  const setActiveTab = (tab: "orders" | "external" | "supplies_orders" | "courses" | "inventory" | "audit") => {
    router.replace(`/admin/hub?tab=${tab}`, { scroll: false });
  };
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "processing" | "delivering">("all");
  
  // External Orders filter and sort state
  const [extSearch, setExtSearch] = useState("");
  const [extSort, setExtSort] = useState<"newest" | "oldest" | "delivery_asc" | "delivery_desc">("delivery_asc");

  const [showInventoryDeduct, setShowInventoryDeduct] = useState<string | null>(null); // orderId
  const [showEditExternal, setShowEditExternal] = useState<any | null>(null); // order object
  const [inventorySearch, setInventorySearch] = useState("");
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [showEditInventory, setShowEditInventory] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<{name: string, phone?: string} | null>(null);
  // Track purchase source per item: 'haider' | 'cake'
  const [purchaseSource, setPurchaseSource] = useState<Record<string, 'salary' | 'cake'>>({});
  const [invExpSummary, setInvExpSummary] = useState({ haider: 0, cake: 0 });

  const [stats, setStats] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hub_stats');
      if (saved) return JSON.parse(saved);
    }
    return {
      todaySales: 0, weekSales: 0, monthSales: 0, allTimeSales: 0, 
      todayExtSales: 0, weekExtSales: 0, monthExtSales: 0, allTimeExtSales: 0,
      extOweUs: 0, extWeOwe: 0,
      totalOrders: 0, pendingOrders: 0, pendingExtOrders: 0, externalSales: 0, externalProfit: 0,
      expenses: 0, inventoryLow: 0, inventoryValue: 0,
      netProfit: 0, totalProfit: 0,
      breakdown: { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 }
    };
  });

  useEffect(() => {
    localStorage.setItem('hub_stats', JSON.stringify(stats));
  }, [stats]);
  
  useEffect(() => {
    try {
      const cleanInv = inventory.map(i => ({ ...i, tempImageUrl: undefined }));
      localStorage.setItem('cache_inventory', JSON.stringify(cleanInv));
    } catch (e) {
      console.error("Cache error inventory:", e);
    }
  }, [inventory]);

  useEffect(() => {
    try {
      const cleanOrders = orders.slice(0, 20).map(o => ({ ...o, items: o.items?.map((i:any) => ({ ...i, tempImageUrl: undefined })) }));
      localStorage.setItem('cache_orders', JSON.stringify(cleanOrders));
    } catch (e) {
      console.error("Cache error orders:", e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      const cleanExt = externalOrders.slice(0, 20).map(o => ({ ...o, tempImageUrl: o.imageUrl ? undefined : o.tempImageUrl }));
      localStorage.setItem('cache_external_orders', JSON.stringify(cleanExt));
    } catch (e) {
      console.error("Cache error ext:", e);
    }
  }, [externalOrders]);

  const fetchAll = useCallback(async () => {
    if (orders.length === 0 && externalOrders.length === 0) {
      setLoading(true);
    }
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 86400000);

      // Fast crucial data
      const [ordersSnap, extSnap, customSnap] = await Promise.all([
        getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100))),
        getDocs(query(collection(db, "external_orders"), orderBy("createdAt", "desc"), limit(100))),
        getDocs(query(collection(db, "custom_orders"), orderBy("createdAt", "desc"), limit(100)))
      ]);

      const allOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setOrders(allOrders);
      try {
        const cleanOrders = allOrders.slice(0, 20).map(o => ({ ...o, items: o.items?.map((i:any) => ({ ...i, tempImageUrl: undefined })) }));
        localStorage.setItem("cache_orders", JSON.stringify(cleanOrders));
      } catch (e) {}

      const allExt = extSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setExternalOrders(allExt);
      try {
        const cleanExt = allExt.slice(0, 20).map(o => ({ ...o, tempImageUrl: o.imageUrl ? undefined : o.tempImageUrl }));
        localStorage.setItem("cache_external_orders", JSON.stringify(cleanExt));
      } catch (e) {}

      const allCustom = customSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setCustomOrders(allCustom);

      // Unblock UI immediately
      setLoading(false);

      // Fetch heavy/secondary data in background
      Promise.all([
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "store_sales"))
      ]).then(([coursesSnap, storeSnap]) => {
        const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        setCourses(allCourses);
        const allStoreSales = storeSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      // Stats and Notifications
      let todaySales = 0, weekSales = 0, monthSales = 0, allTimeSales = 0;
      let todayExtSales = 0, weekExtSales = 0, monthExtSales = 0, allTimeExtSales = 0;
      let extOweUs = 0, extWeOwe = 0;
      
      let breakdown = { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 };
      let totalProfit = 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const pendingOrders = allOrders.filter(o => ["pending", "processing"].includes(o.status));
      
      const calcSales = (o: any, amt: number, isExternal: boolean) => {
        const isDelivered = o.status === 'delivered' || o.status === 'completed';
        if (!isDelivered) return;
        
        const d = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
        d.setHours(0,0,0,0);
        
        if (isExternal) {
          allTimeExtSales += amt;
          if (d.getTime() === today.getTime()) todayExtSales += amt;
          if (d >= weekAgo) weekExtSales += amt;
          if (d >= thirtyDaysAgo) monthExtSales += amt;
        } else {
          allTimeSales += amt;
          if (d.getTime() === today.getTime()) todaySales += amt;
          if (d >= weekAgo) weekSales += amt;
          if (d >= thirtyDaysAgo) monthSales += amt;
        }
      };

      allOrders.forEach(o => {
        if (["rejected", "cancelled"].includes(o.status)) return;
        const amt = Number(o.toPayNow) || Number(o.total) || 0;
        calcSales(o, amt, false);
        
        totalProfit += (amt * 0.3); // Rough estimate for app profit
        if (o.items && Array.isArray(o.items)) {
           let hasAcademy = o.items.some((i: any) => i.type === "course" || i.id?.includes("course"));
           let hasSupplies = o.items.some((i: any) => i.type === "supply" || i.id?.includes("supply"));
           if (hasAcademy) breakdown.appAcademy += amt;
           else if (hasSupplies) breakdown.appSupplies += amt;
           else breakdown.appCakes += amt;
        } else {
           breakdown.appCakes += amt;
        }
      });
      
      allExt.forEach(o => {
        if (["rejected", "cancelled"].includes(o.status)) return;
        const amt = o.paidAmount !== undefined ? Number(o.paidAmount) : (Number(o.price) || 0);
        const price = Number(o.price) || 0;
        
        if (o.status === "delivered" && amt !== price && !o.isDebtSettled) {
          if (amt < price) {
            extOweUs += (price - amt);
          } else if (amt > price) {
            extWeOwe += (amt - price);
          }
        }

        calcSales(o, amt, true);
        totalProfit += Number(o.profit) || 0;
        breakdown.social += amt;
      });

      allStoreSales.forEach(o => {
        const amt = Number(o.price) || 0;
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
        d.setHours(0,0,0,0);
        
        allTimeSales += amt; // Add to all time sales
        if (d.getTime() === today.getTime()) todaySales += amt;
        if (d >= weekAgo) weekSales += amt;
        if (d >= thirtyDaysAgo) monthSales += amt;
        
        totalProfit += Number(o.profit) || 0;
        breakdown.storeSupplies += amt;
      });

      // Notification Logic for External Orders
      allExt.forEach(o => {
        const rawDate = o.deliveryDate || o.deliveryTime;
        if (rawDate) {
          const deliveryDateObj = new Date(rawDate);
          const now = new Date();
          const diffMs = deliveryDateObj.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          
          let title = "";
          let message = "";
          let updateObj: any = null;

          if (diffHours <= 1 && diffHours >= 0 && !o.notified1h) {
             title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
             message = `الوقت يقترب! يجب تسليم كيكة (${o.cakeName || 'بدون اسم'}) بعد ساعة.`;
             updateObj = { notified1h: true };
          } else if (diffHours <= 10 && diffHours > 1 && !o.notified10h) {
             title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
             message = `يجب إكمال كيكة (${o.cakeName || 'بدون اسم'}) الآن!`;
             updateObj = { notified10h: true };
          } else if (diffHours <= 24 && diffHours > 10 && !o.notified24h) {
             title = `طلب الزبون: ${o.customerName || 'مجهول'} ⚠️`;
             message = `تذكير: يجب تحضير كيكة (${o.cakeName || 'بدون اسم'}) بسرعة.`;
             updateObj = { notified24h: true };
          }

          if (updateObj) {
            addDoc(collection(db, "notifications"), {
              userId: "admin",
              title,
              message,
              type: "order",
              imageUrl: o.imageUrl || "",
              customerName: o.customerName || "",
              read: false,
              link: "/admin/hub?tab=external",
              createdAt: serverTimestamp()
            });
            updateDoc(doc(db, "external_orders", o.id || o._id), updateObj).catch(console.error);
          }
        }
      });

      // thirtyDaysAgo is already defined and set on line 124
      const recentExt = allExt.filter(o => {
        if (!o.createdAt) return false;
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
        return d >= thirtyDaysAgo;
      });

      const externalSales = recentExt.reduce((s, o) => s + Number(o.price || 0), 0);
      const externalProfit = recentExt.reduce((s, o) => s + Number(o.profit || 0), 0);
      
      const pendingExtOrders = allExt.filter(o => ["pending", "processing"].includes(o.status || 'pending')).length;

      setStats((prev: any) => ({
        ...prev,
        todaySales, weekSales, monthSales, allTimeSales, 
        todayExtSales, weekExtSales, monthExtSales, allTimeExtSales, 
        extOweUs, extWeOwe,
        totalOrders: allOrders.length, pendingOrders: pendingOrders.length, 
        pendingExtOrders, externalSales, externalProfit, 
        totalProfit, netProfit: totalProfit - prev.expenses, breakdown 
      }));
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // ⚡ Instant load from cache (0ms delay for Social and Hub orders)
    try {
      const cachedExt = localStorage.getItem("cache_external_orders");
      if (cachedExt) {
        const parsed = JSON.parse(cachedExt);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExternalOrders(parsed);
          setLoading(false);
        }
      }
      const cachedOrd = localStorage.getItem("cache_orders");
      if (cachedOrd) {
        const parsed = JSON.parse(cachedOrd);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    fetchAll();

    const handleBackgroundUpload = () => {
      fetchAll();
    };
    window.addEventListener('backgroundUploadSuccess', handleBackgroundUpload);
    
    // Real-time listener for expenses
    const expQuery = query(collection(db, "expenses"), orderBy("createdAt", "desc"), limit(200));
    const unsubExpenses = onSnapshot(expQuery, (snap) => {
      const exps = snap.docs.map(d => d.data()) as any[];
      const totalExpenses = exps.reduce((s, e) => s + Number(e.amount || 0), 0);
      
      const invExps = exps.filter(e => e.isInventoryExpense);
      const invExpHaider = invExps.filter(e => e.paidBy === 'haider').reduce((s, e) => s + Number(e.amount || 0), 0);
      const invExpCake = invExps.filter(e => e.paidBy === 'cake').reduce((s, e) => s + Number(e.amount || 0), 0);
      
      setInvExpSummary({ haider: invExpHaider, cake: invExpCake });
      setStats((prev: any) => ({
        ...prev,
        expenses: totalExpenses,
        netProfit: prev.totalProfit - totalExpenses
      }));
    });

    // Real-time listener for inventory
    const unsubInventory = onSnapshot(collection(db, "cake_inventory"), (snap) => {
      const allInv = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setInventory(allInv);
      const inventoryLow = allInv.filter(i => Number(i.neededQuantity || 0) > 0).length;
      const inventoryValue = allInv.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
      setStats((prev: any) => ({
        ...prev,
        inventoryLow,
        inventoryValue
      }));
    });

    // Real-time listener for home debts
    const unsubHomeDebts = onSnapshot(doc(db, "home_finance", "debts"), (snap) => {
      if (snap.exists() && snap.data().data) {
        setHomeDebts(snap.data().data);
      } else {
        setHomeDebts([]);
      }
    });

    const unsubHomeExpenses = onSnapshot(doc(db, "home_finance", "expenses"), (snap) => {
      if (snap.exists() && snap.data().data) setHomeExpenses(snap.data().data);
      else setHomeExpenses([]);
    });

    const unsubHomeIncomes = onSnapshot(doc(db, "home_finance", "incomes"), (snap) => {
      if (snap.exists() && snap.data().data) setHomeIncomes(snap.data().data);
      else setHomeIncomes([]);
    });

    return () => {
      window.removeEventListener('backgroundUploadSuccess', handleBackgroundUpload);
      unsubExpenses();
      unsubInventory();
      unsubHomeDebts();
      unsubHomeExpenses();
      unsubHomeIncomes();
    };
  }, [fetchAll]);

  // Real-time listener for external orders to prevent stale cache issues
  useEffect(() => {
    const q = query(collection(db, "external_orders"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setExternalOrders(allExt);
    });
    return () => unsub();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (newStatus === "delivered" || newStatus === "completed") {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSettleOrder(order);
        setSettleOrderType("app");
        setSettleDebtType("none");
        setSettleRemainingAmount("");
      }
      return;
    }
    try {
      setUpdatingOrder(orderId);
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success("تم تحديث حالة الطلب");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const updateExternalOrderStatus = async (orderId: string, newStatus: string) => {
    if (newStatus === "delivered") {
      const order = externalOrders.find(o => o.id === orderId);
      if (order) {
        setSettleOrder(order);
        setSettleOrderType("external");
        setSettleDebtType("none");
        setSettleRemainingAmount("");
      }
      return;
    }

    try {
      setUpdatingOrder(orderId);
      const orderRef = doc(db, "external_orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      // Optimistic update
      setExternalOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success("تم تحديث حالة طلب السوشيال ميديا");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const updateCustomOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrder(orderId);
      const orderRef = doc(db, "custom_orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      // Optimistic update
      setCustomOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast.success("تم تحديث حالة طلب الكيك الخاص");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder) return;
    
    const basePrice = settleOrderType === "external" ? Number(settleOrder.price || 0) : Number(settleOrder.toPayNow || settleOrder.total || 0);
    let finalPaidAmount = basePrice;
    const remAmt = Number(settleRemainingAmount) || 0;
    
    if (settleDebtType === "customer_owes") {
      finalPaidAmount = basePrice - remAmt;
    } else if (settleDebtType === "we_owe") {
      finalPaidAmount = basePrice + remAmt;
    }
    
    try {
      setUpdatingOrder(settleOrder.id);
      const collectionName = settleOrderType === "external" ? "external_orders" : "orders";
      const orderId = settleOrder.id;
      const isSettled = finalPaidAmount === basePrice;
      
      await updateDoc(doc(db, collectionName, orderId), { 
        status: "delivered", 
        paidAmount: finalPaidAmount,
        isDebtSettled: isSettled
      });
      // Optimistic update
      if (settleOrderType === "external") {
        setExternalOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "delivered", paidAmount: finalPaidAmount, isDebtSettled: isSettled } : o));
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "delivered", paidAmount: finalPaidAmount, isDebtSettled: isSettled } : o));
      }
      toast.success("تم تأكيد التسليم وتحديث الحساب");
      setSettleOrder(null);
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleSettleDebt = async (order: any, diffAmt: number, customerOwesUs: boolean, type: "external" | "app" = "external") => {
    if (!(await customConfirm("هل تم تسديد هذا المبلغ بالكامل؟"))) return;
    try {
      setUpdatingOrder(order.id);
      
      const collectionName = type === "external" ? "external_orders" : "orders";
      const basePrice = type === "external" ? Number(order.price || 0) : Number(order.toPayNow || order.total || 0);
      
      await updateDoc(doc(db, collectionName, order.id), { 
        paidAmount: basePrice,
        isDebtSettled: true 
      });
      // Optimistic update
      if (type === "external") {
        setExternalOrders(prev => prev.map(o => o.id === order.id ? { ...o, paidAmount: basePrice, isDebtSettled: true } : o));
      } else {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paidAmount: basePrice, isDebtSettled: true } : o));
      }
      
      if (customerOwesUs) {
        await addDoc(collection(db, "store_sales"), {
          itemName: (type === "external" ? "تسديد دين سوشيال - " : "تسديد دين تطبيق - ") + (order.customerName || order.userName || ""),
          price: diffAmt,
          profit: diffAmt,
          quantity: 1,
          category: "تسديد ديون",
          createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "expenses"), {
          amount: diffAmt,
          category: "إرجاع أمانة زبون",
          description: "إرجاع مبلغ للزبون - " + (order.customerName || ""),
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp()
        });
      }
      
      toast.success("تم التسديد بنجاح وتم تسجيلها في الحسابات");
    } catch (e) {
      toast.error("خطأ أثناء التسديد");
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handlePurchaseMissing = async (item: any) => {
    try {
      const neededQty = Number(item.neededQuantity || 1);

      // Optimistic update: immediately reflect in UI
      setInventory(prev => prev.map(i => i.id === item.id 
        ? { ...i, quantity: Number(i.quantity || 0) + neededQty, neededQuantity: 0 }
        : i
      ));

      await updateDoc(doc(db, "cake_inventory", item.id), {
        quantity: increment(neededQty),
        neededQuantity: 0,
        lastUpdated: serverTimestamp()
      });
      
      toast.success(`✅ تم توفير ${item.name} وإضافته للمخزن`, { duration: 3000 });
    } catch (e) {
      // Revert on failure
      setInventory(prev => prev.map(i => i.id === item.id 
        ? { ...i, quantity: Number(i.quantity || 0) - Number(item.neededQuantity || 1), neededQuantity: item.neededQuantity }
        : i
      ));
      toast.error("فشل التحديث");
    }
  };

  const updateInventoryQuantity = async (id: string, currentQty: number, change: number) => {
    try {
      const newQty = Math.max(0, currentQty + change);
      const item = inventory.find(i => i.id === id);
      const minAlert = Number(item?.minAlert || 0);
      
      const updates: any = { quantity: newQty };
      
      if (newQty <= minAlert && Number(item?.neededQuantity || 0) === 0) {
        updates.neededQuantity = 1;
      } else if (newQty > minAlert && Number(item?.neededQuantity || 0) > 0) {
        updates.neededQuantity = 0;
      }
      
      await updateDoc(doc(db, "cake_inventory", id), updates);
      setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء تحديث الكمية");
    }
  };

  const filteredOrders = (() => {
    // 1. App Orders
    const appOrders = orders.filter(o => {
      if (orderFilter === "all") return true;
      return o.status === orderFilter;
    });

    const combined = [...appOrders];
    
    // Sort logic: 
    // 1. Delivered / Completed at the bottom
    // 2. Nearest delivery/creation date first (ascending order)
    return combined.sort((a, b) => {
      const isDeliveredA = a.status === 'delivered' || a.status === 'completed';
      const isDeliveredB = b.status === 'delivered' || b.status === 'completed';
      
      if (isDeliveredA && !isDeliveredB) return 1;
      if (!isDeliveredA && isDeliveredB) return -1;
      
      // Get dates for sorting
      const parseDate = (d: any) => {
        if (!d) return new Date(8640000000000000);
        if (d.toDate) return d.toDate();
        if (d.seconds) return new Date(d.seconds * 1000); // Fix for JSON stringified Firebase Timestamps
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? new Date(8640000000000000) : parsed;
      };

      const dateA = a.isExternal ? parseDate(a.deliveryDate) : parseDate(a.createdAt);
      const dateB = b.isExternal ? parseDate(b.deliveryDate) : parseDate(b.createdAt);
      
      return dateA.getTime() - dateB.getTime();
    });
  })();

  const suppliesOrders = orders.filter(o => {
    const hasSupplies = o.items?.some((i: any) => i.isSupply || i.category === 'supplies' || INVENTORY_CATEGORIES.includes(i.category));
    return hasSupplies;
  });

  const filteredInventory = inventory.filter(i => {
    if (!inventorySearch) return true;
    const search = inventorySearch.toLowerCase();
    const nameMatch = (i.name || "").toLowerCase().includes(search);
    const catMatch = (i.category || "").toLowerCase().includes(search);
    return nameMatch || catMatch;
  });
  const lowStockItems = filteredInventory.filter(i => Number(i.neededQuantity || 0) > 0);

  const filteredExternalOrders = externalOrders.filter(o => {
    if (extSearch && !o.customerName?.includes(extSearch) && !o.cakeName?.includes(extSearch)) return false;
    return true;
  }).sort((a, b) => {
    const isDeliveredA = a.status === 'delivered' || a.status === 'completed';
    const isDeliveredB = b.status === 'delivered' || b.status === 'completed';
    
    const isDebtA = isDeliveredA && a.paidAmount !== undefined && Number(a.paidAmount) !== Number(a.price) && !a.isDebtSettled;
    const isDebtB = isDeliveredB && b.paidAmount !== undefined && Number(b.paidAmount) !== Number(b.price) && !b.isDebtSettled;

    if (isDebtA && !isDebtB) return -1; // Debt goes up
    if (!isDebtA && isDebtB) return 1;

    // normal delivered (without debt) goes down
    if (isDeliveredA && !isDebtA && (!isDeliveredB || isDebtB)) return 1;
    if (isDeliveredB && !isDebtB && (!isDeliveredA || isDebtA)) return -1;

    const parseDate = (d: any) => {
      if (!d) return new Date(8640000000000000);
      if (d.toDate) return d.toDate();
      if (d.seconds) return new Date(d.seconds * 1000); // Fix for JSON stringified Firebase Timestamps
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? new Date(8640000000000000) : parsed;
    };

    if (extSort === "newest") {
      const d1 = parseDate(a.createdAt);
      const d2 = parseDate(b.createdAt);
      return d2.getTime() - d1.getTime();
    }
    if (extSort === "oldest") {
      const d1 = parseDate(a.createdAt);
      const d2 = parseDate(b.createdAt);
      return d1.getTime() - d2.getTime();
    }
    if (extSort === "delivery_asc" || extSort === "delivery_desc") {
      const d1 = parseDate(a.deliveryDate);
      const d2 = parseDate(b.deliveryDate);
      return extSort === "delivery_asc" ? d1.getTime() - d2.getTime() : d2.getTime() - d1.getTime();
    }
    return 0;
  });

  const tabTitles: Record<string, {title: string, subtitle: string}> = {
    external: { title: "طلبات السوشيال", subtitle: "إدارة طلبات واتساب وانستغرام" },
    orders: { title: "طلبات التطبيق", subtitle: "إدارة الطلبات الواردة من التطبيق" },
    supplies_orders: { title: "طلبات مواد الكيك", subtitle: "إدارة المواد الخام والطلبيات" },
    inventory: { title: "إدارة المخزن", subtitle: "جرد الكيك والمواد الأولية" },
    courses: { title: "الأكاديمية", subtitle: "إدارة دورات المبيعات والمشتركين" },
    audit: { title: "مطابقة وكشف", subtitle: "التدقيق المالي ومطابقة الحسابات والديون" }
  };
  

  const auditData = useMemo(() => {
    const result = {
      social:   { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
      appCakes: { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
      supplies: { totalExpected: 0, totalReceived: 0, totalDebt: 0, totalWeOwe: 0, ordersCount: 0 },
    };

    // ── Social Orders (external_orders): uses `price` and `paidAmount` ──
    externalOrders.forEach((order: any) => {
      if (order.status === 'rejected' || order.status === 'cancelled') return;
      result.social.ordersCount++;

      const price = Number(order.price || 0);
      const paid  = Number(order.paidAmount ?? price); // if paidAmount missing → fully paid
      result.social.totalExpected += price;

      const isDebt = order.status === 'delivered'
        && order.paidAmount !== undefined
        && paid !== price
        && !order.isDebtSettled;

      if (isDebt) {
        const diff = price - paid;
        if (diff > 0) {
          // Customer owes us (red)
          result.social.totalReceived += paid;
          result.social.totalDebt     += diff;
        } else {
          // We owe customer (blue)
          result.social.totalReceived += price;
          result.social.totalWeOwe    += Math.abs(diff);
        }
      } else {
        result.social.totalReceived += price;
      }
    });

    // ── App Orders (orders): uses `total`, `toPayNow`, `isDebt`, `debtAmount` ──
    orders.forEach((order: any) => {
      if (order.status === 'rejected' || order.status === 'cancelled') return;

      const hasSupplies = order.items?.some((i: any) => i.isSupply || i.category === 'supplies' || i.id?.includes('supply'));
      const hasCourses  = order.items?.some((i: any) => i.type === 'course');
      if (hasCourses && !hasSupplies && order.items?.length === 1) return; // Skip pure academy

      const cat: 'supplies' | 'appCakes' = hasSupplies ? 'supplies' : 'appCakes';
      result[cat].ordersCount++;

      const total      = Number(order.total || order.toPayNow || 0);
      const isDebt     = order.isDebt === true;
      const debtAmount = Number(order.debtAmount || 0);
      const weOwe      = order.customerOwesUs === false; // blue: we owe

      result[cat].totalExpected += total;

      if (isDebt && debtAmount > 0) {
        if (weOwe) {
          result[cat].totalReceived += total;
          result[cat].totalWeOwe    += debtAmount;
        } else {
          result[cat].totalReceived += (total - debtAmount);
          result[cat].totalDebt     += debtAmount;
        }
      } else {
        result[cat].totalReceived += total;
      }
    });

    const totalHomeDebtsForMe = homeDebts.filter(d => d.type === "دين لي").reduce((s, d) => s + (d.amount - (d.payments || []).reduce((ps:any, p:any) => ps + p.amount, 0)), 0);
    const totalHomeDebtsOnMe = homeDebts.filter(d => d.type === "دين علي").reduce((s, d) => s + (d.amount - (d.payments || []).reduce((ps:any, p:any) => ps + p.amount, 0)), 0);
    const salaryDebtsForMe = homeDebts.filter(d => d.type === "دين لي" && (String(d.name).includes("راتب") || String(d.category).includes("راتب"))).reduce((s, d) => s + (d.amount - (d.payments || []).reduce((ps:any, p:any) => ps + p.amount, 0)), 0);
    const salaryDebtsOnMe = homeDebts.filter(d => d.type === "دين علي" && (String(d.name).includes("راتب") || String(d.category).includes("راتب"))).reduce((s, d) => s + (d.amount - (d.payments || []).reduce((ps:any, p:any) => ps + p.amount, 0)), 0);

    return { ...result, totalHomeDebtsForMe, totalHomeDebtsOnMe, salaryDebtsForMe, salaryDebtsOnMe };
  }, [externalOrders, orders, homeDebts]);

  const financialLog = useMemo(() => {
    const all = [
      ...homeExpenses.map(e => ({ ...e, type: "expense", amount: Number(e.amount), date: e.date || e.createdAt?.split("T")[0] })),
      ...homeIncomes.map(i => ({ ...i, type: "income", amount: Number(i.amount), date: i.date || i.createdAt?.split("T")[0] }))
    ];
    return all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 50); // Get last 50
  }, [homeExpenses, homeIncomes]);

  const currentTabInfo = tabTitles[activeTab] || { title: "القسم", subtitle: "إدارة القسم" };

  return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-zinc-950 pb-28">
      {/* Luxury Gradient Header Banner (Matched to Finances Style) */}
      <div className={`bg-gradient-to-l ${
        activeTab === "orders" ? "from-pink-900 via-rose-900 to-purple-950" :
        activeTab === "external" ? "from-emerald-900 via-teal-900 to-slate-950" :
        activeTab === "inventory" ? "from-blue-900 via-indigo-900 to-slate-950" :
        activeTab === "supplies_orders" ? "from-orange-900 via-amber-900 to-red-950" :
        activeTab === "courses" ? "from-cyan-900 via-blue-900 to-indigo-950" :
        "from-purple-900 via-violet-900 to-indigo-950"
      } pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden text-white`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">{currentTabInfo.title}</h1>
              <p className="text-xs text-white/70 font-bold">{currentTabInfo.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "external" && (
              <button onClick={() => setShowAddSocial(true)} className="bg-white text-emerald-950 rounded-xl px-3.5 py-2 flex items-center gap-1.5 text-xs font-black shadow-md hover:bg-gray-100 transition active:scale-95">
                <Plus className="w-4 h-4 text-emerald-600" /> إضافة سوشيال
              </button>
            )}
            {activeTab === "inventory" && (
              <button onClick={() => setShowAddInventory(true)} className="bg-white text-blue-950 rounded-xl px-3.5 py-2 flex items-center gap-1.5 text-xs font-black shadow-md hover:bg-gray-100 transition active:scale-95">
                <Plus className="w-4 h-4 text-blue-600" /> إضافة مادة
              </button>
            )}
            <button onClick={fetchAll} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition backdrop-blur-md border border-white/10" title="تحديث">
              <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Dynamic KPI Glassmorphism Stats Cards */}
        {activeTab === "orders" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> مبيعات اليوم</p>
              <p className="text-lg font-black text-white">{(stats.todaySales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> طلبات معلقة</p>
              <p className="text-lg font-black text-amber-300">{stats.pendingOrders || 0} <span className="text-[10px] font-normal">طلب</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> مبيعات الأسبوع</p>
              <p className="text-lg font-black text-white">{(stats.weekSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> المبيعات الكلية</p>
              <p className="text-lg font-black text-purple-200">{(stats.allTimeSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
          </div>
        )}

        {activeTab === "external" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> مبيعات اليوم</p>
              <p className="text-lg font-black text-white">{(stats.todayExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> طلبات معلقة</p>
              <p className="text-lg font-black text-amber-300">{stats.pendingExtOrders || 0} <span className="text-[10px] font-normal">طلب</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> مبيعات الأسبوع</p>
              <p className="text-lg font-black text-white">{(stats.weekExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> المبيعات الكلية</p>
              <p className="text-lg font-black text-teal-200">{(stats.allTimeExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> باقي نطلبه</p>
              <p className="text-lg font-black text-rose-300">{(stats.extOweUs || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-blue-200 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> أمانة يطلبنا</p>
              <p className="text-lg font-black text-blue-300">{(stats.extWeOwe || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-blue-200 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> نواقص الشراء</p>
              <p className="text-lg font-black text-orange-300">{lowStockItems.length} <span className="text-[10px] font-normal">مادة</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-blue-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> تكلفة النواقص</p>
              <p className="text-lg font-black text-white">{lowStockItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.neededQuantity || 1)), 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-blue-200 mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> المتوفر حالياً</p>
              <p className="text-lg font-black text-emerald-300">{inventory.filter(i => Number(i.quantity) > 0).length} <span className="text-[10px] font-normal">مادة</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-blue-200 mb-1 flex items-center gap-1"><Package className="w-3.5 h-3.5" /> القيمة الكلية للمخزن</p>
              <p className="text-lg font-black text-indigo-200">{(stats.inventoryValue || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
          </div>
        )}

        {activeTab === "supplies_orders" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-orange-200 mb-1 flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> إجمالي الطلبيات</p>
              <p className="text-lg font-black text-white">{suppliesOrders.length} <span className="text-[10px] font-normal">طلب</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-orange-200 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> قيد التجهيز</p>
              <p className="text-lg font-black text-amber-300">{suppliesOrders.filter(o => o.status === "pending" || o.status === "processing").length} <span className="text-[10px] font-normal">طلب</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-orange-200 mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> طلبات مكتملة</p>
              <p className="text-lg font-black text-emerald-300">{suppliesOrders.filter(o => o.status === "completed" || o.status === "delivered").length} <span className="text-[10px] font-normal">طلب</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-orange-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> إجمالي المبيعات</p>
              <p className="text-lg font-black text-white">{suppliesOrders.reduce((sum, o) => sum + (Number(o.toPayNow) || Number(o.total) || 0), 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showQuickEntry && (
        <AdminQuickEntry
          onClose={() => setShowQuickEntry(false)}
          onSuccess={() => { setShowQuickEntry(false); fetchAll(); }}
        />
      )}
      
      {showAddSocial && (
        <AdminQuickEntry
          onClose={() => setShowAddSocial(false)}
          onSuccess={() => { setShowAddSocial(false); fetchAll(); }}
          initialTab="sale"
          hideTabs={true}
        />
      )}

      {showAddInventory && (
        <AdminQuickEntry
          onClose={() => setShowAddInventory(false)}
          onSuccess={() => { setShowAddInventory(false); fetchAll(); }}
          initialTab="inventory"
          hideTabs={true}
        />
      )}

      {showEditInventory && (
        <EditInventoryModal
          isOpen={true}
          onClose={() => setShowEditInventory(null)}
          item={showEditInventory}
          onEditSuccess={(updatedItem: any) => {
            if (updatedItem) {
              setInventory(prev => prev.map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i));
            }
            setShowEditInventory(null);
          }}
        />
      )}

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" /></div>
        ) : (
          <>

            {/* === ORDERS TAB === */}
            {activeTab === "orders" && (
              <div className="space-y-4">
                {/* Visible Filter Grid (No Horizontal Scroll / Swipe) */}
                <div className="flex flex-wrap gap-2 mb-4 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                  {[
                    { key: "all", label: "الكل 📋" },
                    { key: "pending", label: "⏳ بانتظار الدفع" },
                    { key: "processing", label: "🔧 قيد التجهيز" },
                    { key: "delivering", label: "🚗 قيد التوصيل" },
                  ].map((f: any) => (
                    <button key={f.key} onClick={() => setOrderFilter(f.key)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${orderFilter === f.key ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">لا توجد طلبات لهذا الفلتر</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                    {filteredOrders.slice(0, 30).map(order => {
                      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG["pending"];
                      const isUpdating = updatingOrder === order.id;
                      return (
                        <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-3 sm:p-4 flex gap-4 border border-gray-100 dark:border-zinc-800 shadow-sm relative group overflow-hidden transition-all duration-300 hover:shadow-md">
                          {/* Right: Image */}
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 border border-gray-100 dark:border-zinc-700 flex items-center justify-center">
                            {order.items && order.items.length > 0 && (order.items[0].imageUrl || order.items[0].tempImageUrl) ? (
                              <img src={order.items[0].imageUrl || order.items[0].tempImageUrl} alt={order.items[0].name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" />
                            ) : (
                              <ShoppingBag className="w-8 h-8 text-gray-300" />
                            )}
                          </div>

                          <div className="flex-1 flex flex-col justify-between py-0.5">
                            <div>
                              <div className="flex justify-between items-start mb-1">
                              <button onClick={() => setCustomerProfile({ name: order.shippingAddress?.name || order.userName || "ضيف", phone: order.shippingAddress?.phone })} className="text-right group">
                                <h3 className="font-black text-gray-900 dark:text-white text-base sm:text-lg leading-tight group-hover:text-[#FF3366] transition underline decoration-transparent group-hover:decoration-[#FF3366] underline-offset-4 flex items-center gap-1.5">
                                  {order.shippingAddress?.name || order.userName || "ضيف"}
                                </h3>
                              </button>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-xl shrink-0 ml-1 ${cfg.bg} ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-2 font-bold leading-relaxed">
                                {(order.items || []).map((item: any) => `${item.quantity || 1}× ${item.name}`).join(' ، ')}
                              </p>
                              <div className="flex flex-wrap gap-1.5 text-[10px] sm:text-[11px]">
                                <span className="bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-1 font-bold">
                                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                  {order.phone ? <a href={`tel:${order.phone}`} className="hover:underline">{order.phone}</a> : "غير محدد"}
                                </span>
                                <span className="bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-1 font-bold">
                                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString("ar-IQ", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "غير محدد"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-end justify-between mt-3 sm:mt-2">
                              <div className="relative w-32 sm:w-36">
                                <select
                                  value={order.status}
                                  onChange={(e) => order.isExternal ? updateExternalOrderStatus(order.id, e.target.value) : updateOrderStatus(order.id, e.target.value)}
                                  disabled={isUpdating}
                                  className={`w-full appearance-none ${cfg.bg} ${cfg.color} border border-transparent rounded-xl px-3 py-1.5 text-[10px] sm:text-[11px] font-black focus:outline-none pr-7 shadow-sm transition-all`}
                                >
                                  {!order.isExternal && (
                                    <>
                                      <option value="pending" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">بانتظار الدفع</option>
                                      <option value="processing" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">قيد التجهيز</option>
                                      <option value="delivering" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">قيد التوصيل</option>
                                      <option value="delivered" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">تم التوصيل</option>
                                      <option value="completed" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">مكتمل</option>
                                      <option value="rejected" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">مرفوض</option>
                                      <option value="cancelled" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">ملغي</option>
                                    </>
                                  )}
                                </select>
                                <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${cfg.color}`} />
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 absolute left-2.5 top-1/2 -translate-y-1/2" />}
                              </div>

                              <div className="flex flex-col text-left pl-1">
                                <span className="text-[9px] text-gray-400 font-bold mb-0.5">الإجمالي</span>
                                <span className="font-black text-[#e8456b] text-base sm:text-lg leading-none">
                                  {Number(order.total).toLocaleString()} <span className="text-[10px] text-[#e8456b] font-bold">د.ع</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* === EXTERNAL ORDERS TAB === */}
            {activeTab === "external" && (
              <div className="space-y-4">
                {/* Filters and Sorting Card */}
                <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center mb-4">
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="بحث بالاسم أو رقم الطلب أو الهاتف..."
                        value={extSearch}
                        onChange={e => setExtSearch(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-emerald-500 focus:outline-none pr-9 transition text-gray-800 dark:text-gray-200"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={extSort}
                        onChange={e => setExtSort(e.target.value as any)}
                        className="w-full appearance-none bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:border-emerald-500 focus:outline-none pr-9 text-gray-700 dark:text-gray-300 transition cursor-pointer"
                      >
                        <option value="newest">💡 الأحدث إضافة أولاً</option>
                        <option value="oldest">⏳ الأقدم إضافة أولاً</option>
                        <option value="delivery_asc">📅 تاريخ التسليم (الأقرب)</option>
                        <option value="delivery_desc">📆 تاريخ التسليم (الأبعد)</option>
                      </select>
                      <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {filteredExternalOrders.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">لا توجد طلبات تطابق بحثك</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-w-4xl mx-auto w-full">
                    {filteredExternalOrders.map(order => {
                      const statusKey = order.status || "pending";
                      const extCfg = EXTERNAL_STATUS_CONFIG[statusKey] || EXTERNAL_STATUS_CONFIG["pending"];
                      const isUpdating = updatingOrder === order.id;
                      
                      const isDebt = order.status === "delivered" && order.paidAmount !== undefined && Number(order.paidAmount) !== Number(order.price) && !order.isDebtSettled;
                      const customerOwesUs = isDebt && Number(order.price) > Number(order.paidAmount || 0);
                      const weOweCustomer = isDebt && Number(order.price) < Number(order.paidAmount || 0);
                      const fullyPaidDelivered = order.status === "delivered" && !isDebt;
                      const diffAmt = isDebt ? Math.abs(Number(order.price) - Number(order.paidAmount || 0)) : 0;

                      return (
                        <div key={order.id} className={`rounded-3xl p-3 flex flex-col gap-3 shadow-sm relative group border-2 transition-all ${
                          customerOwesUs ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-400 dark:border-rose-800' : 
                          weOweCustomer ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-400 dark:border-blue-800' : 
                          fullyPaidDelivered ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-400 dark:border-purple-800' :
                          'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
                        }`}>
                          
                          {/* Image Top */}
                          <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 border border-gray-100 dark:border-zinc-700 relative">
                            {order.imageUrl || order.tempImageUrl ? (
                              <img src={order.imageUrl || order.tempImageUrl} alt={order.cakeName} onClick={() => window.open(order.imageUrl || order.tempImageUrl, '_blank')} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal cursor-pointer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <img src="/cp-logo.png" alt="Cake Princess" className="w-10 h-10 opacity-20 grayscale" />
                              </div>
                            )}
                            <button onClick={() => setShowEditExternal(order)} className="absolute top-2 right-2 bg-white/80 dark:bg-black/60 backdrop-blur-md text-gray-700 dark:text-gray-300 hover:text-emerald-500 p-1.5 rounded-xl transition">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex-1 flex flex-col justify-between">
                            <div className="text-center">
                              <button onClick={() => setCustomerProfile({ name: order.customerName, phone: order.customerPhone })} className="text-center group mx-auto block">
                                <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base leading-tight line-clamp-1 group-hover:text-[#FF3366] transition underline decoration-transparent group-hover:decoration-[#FF3366] underline-offset-4 inline-flex items-center gap-1">
                                  {order.customerName}
                                </h3>
                              </button>
                              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 font-bold">{order.cakeName}</p>
                              
                              <div className="flex justify-center mt-1.5 text-[9px] sm:text-[10px]">
                                <span className="bg-gray-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-0.5 font-bold">
                                  {order.platform === "انستغرام" ? "📸" : order.platform === "واتساب" ? "💬" : "📱"} {order.platform}
                                </span>
                              </div>
                              {order.deliveryDate && (
                                <div className="mt-2.5 w-full">
                                  <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 p-[2px] rounded-lg shadow-md">
                                    <div className="bg-amber-50/90 dark:bg-zinc-900/90 rounded-[6px] px-3 py-2 flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                      <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                                        <Calendar className="w-4 h-4 animate-pulse" />
                                        <span className="font-black text-[13px] sm:text-sm leading-none">
                                          {new Date(order.deliveryDate).toLocaleDateString('ar-IQ')}
                                        </span>
                                      </div>
                                      <span className="text-orange-700 dark:text-orange-400 font-black text-xs sm:text-[13px] leading-none bg-orange-200/50 dark:bg-orange-900/40 px-2 py-0.5 rounded-md">
                                        الساعة {new Date(order.deliveryDate).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 mt-auto border-t border-gray-100 dark:border-zinc-800/50 pt-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-400 font-bold">المبلغ:</span>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{Number(order.price || 0).toLocaleString()} د.ع</span>
                              </div>
                              {isDebt && (
                                <div className="flex flex-col gap-1.5 mt-1">
                                  <div className={`flex justify-between items-center text-[10px] font-black px-2 py-1.5 rounded-lg ${customerOwesUs ? 'bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                    <span>{customerOwesUs ? '🔴 الباقي نطلبه:' : '🔵 أمانة يطلبنا:'}</span>
                                    <span>{diffAmt.toLocaleString()} د.ع</span>
                                  </div>
                                  <button 
                                    onClick={() => handleSettleDebt(order, diffAmt, customerOwesUs)}
                                    disabled={isUpdating}
                                    className={`w-full text-center text-[10px] font-black py-1.5 rounded-lg transition-all ${customerOwesUs ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                                  >
                                    تأكيد التسديد
                                  </button>
                                </div>
                              )}
                              <div className="relative w-full">
                                <select
                                  value={statusKey}
                                  onChange={(e) => updateExternalOrderStatus(order.id, e.target.value)}
                                  disabled={isUpdating}
                                  className={`w-full appearance-none ${extCfg.bg} ${extCfg.color} border border-transparent rounded-xl px-2 py-1.5 text-[10px] font-black focus:outline-none pr-6 shadow-sm transition-all text-center`}
                                >
                                  <option value="pending" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">قيد التحضير</option>
                                  <option value="prepared" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">تم التحضير</option>
                                  <option value="delivering" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">قيد التسليم</option>
                                  <option value="delivered" className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200">تم التسليم</option>
                                </select>
                                <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${extCfg.color}`} />
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* === SUPPLIES ORDERS TAB === */}
            {activeTab === "supplies_orders" && (
              <div className="space-y-4">
                {suppliesOrders.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">لا توجد طلبات لمواد الكيك حتى الآن</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-w-4xl mx-auto w-full">
                    {suppliesOrders.map(order => {
                      const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                      const isUpdating = updatingOrder === order.id;
                      const amount = order.toPayNow || order.total || 0;
                      
                      const isDebt = (order.status === "delivered" || order.status === "completed") && order.paidAmount !== undefined && Number(order.paidAmount) !== Number(amount) && !order.isDebtSettled;
                      const customerOwesUs = isDebt && Number(amount) > Number(order.paidAmount || 0);
                      const weOweCustomer = isDebt && Number(amount) < Number(order.paidAmount || 0);
                      const fullyPaidDelivered = (order.status === "delivered" || order.status === "completed") && !isDebt;
                      const diffAmt = isDebt ? Math.abs(Number(amount) - Number(order.paidAmount || 0)) : 0;

                      return (
                        <div key={order.id} className={`rounded-3xl p-3 sm:p-4 flex gap-4 shadow-sm border-2 transition-all ${
                          customerOwesUs ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-400 dark:border-rose-800' : 
                          weOweCustomer ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-400 dark:border-blue-800' : 
                          fullyPaidDelivered ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-400 dark:border-purple-800' :
                          'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
                        }`}>
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 border border-gray-100 dark:border-zinc-700 flex items-center justify-center">
                            {order.items && order.items.length > 0 && (order.items[0].imageUrl || order.items[0].tempImageUrl) ? (
                              <img src={order.items[0].imageUrl || order.items[0].tempImageUrl} alt={order.items[0].name} className="w-full h-full object-cover" />
                            ) : (
                              <ShoppingBag className="w-8 h-8 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-0.5">
                            <div>
                              <div className="flex justify-between items-start mb-1">
                              <button onClick={() => setCustomerProfile({ name: order.shippingAddress?.name || order.userName || "بدون اسم", phone: order.shippingAddress?.phone })} className="text-right group">
                                <h3 className="font-black text-gray-900 dark:text-white text-base leading-tight group-hover:text-[#FF3366] transition underline decoration-transparent group-hover:decoration-[#FF3366] underline-offset-4 flex items-center gap-1.5">
                                  {order.shippingAddress?.name || order.userName || "بدون اسم"}
                                </h3>
                              </button>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-xl shrink-0 ml-1 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                              </div>
                              <p className="text-[11px] text-gray-500 line-clamp-1 mb-2 font-bold">
                                {(order.items || []).map((item: any) => `${item.quantity || 1}× ${item.name}`).join(' ، ')}
                              </p>
                            </div>
                            <div className="flex items-end justify-between mt-2">
                              <div className="relative w-32">
                                <select
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                  disabled={isUpdating}
                                  className={`w-full appearance-none ${cfg.bg} ${cfg.color} border border-transparent rounded-xl px-3 py-1.5 text-[10px] font-black focus:outline-none pr-7 shadow-sm`}
                                >
                                  <option value="pending">بانتظار الدفع</option>
                                  <option value="processing">قيد التجهيز</option>
                                  <option value="delivering">قيد التوصيل</option>
                                  <option value="delivered">تم التوصيل</option>
                                  <option value="completed">مكتمل</option>
                                </select>
                                <ChevronDown className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${cfg.color}`} />
                              </div>
                              <span className="font-black text-[#e8456b] text-lg">{Number(amount).toLocaleString()} <span className="text-[10px] font-bold">د.ع</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* === COURSES TAB === */}
            {activeTab === "courses" && (
              <div className="space-y-4">
                {courses.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">لا توجد دورات مضافة في الأكاديمية</p>
                    <Link href="/admin/courses" className="mt-3 inline-block bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition">إدارة الدورات</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end mb-4">
                      <Link href="/admin/courses" className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-50 transition shadow-sm flex items-center gap-1.5">
                        <Edit className="w-3.5 h-3.5" /> إدارة كاملة للأكاديمية
                      </Link>
                    </div>
                    {courses.map(course => (
                      <div key={course.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-3 sm:p-4 flex gap-4 border border-gray-100 dark:border-zinc-800 shadow-sm">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-gray-50 dark:bg-zinc-800 flex-shrink-0 border border-gray-100 dark:border-zinc-700 relative">
                          {course.thumbnail ? (
                            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold py-1 text-center truncate px-1">
                            {course.level || "مبتدئ"}
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-0.5">
                          <div>
                            <h3 className="font-black text-gray-900 dark:text-white text-base leading-tight mb-1">{course.title}</h3>
                            <p className="text-[11px] text-gray-500 line-clamp-1 mb-2 font-bold">{course.description}</p>
                            <span className="bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-1 font-bold text-[10px] w-fit">
                              <PlayCircle className="w-3.5 h-3.5 text-blue-500" />
                              {(course.curriculum || []).length} فيديوهات تعليمية
                            </span>
                          </div>
                          <div className="flex items-end justify-end mt-2">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">
                              {Number(course.price || 0).toLocaleString()} <span className="text-[10px] text-emerald-500 font-bold">د.ع</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === INVENTORY TAB === */}
            {activeTab === "inventory" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ابحث عن مادة في المخزن..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                </div>
                {lowStockItems.length > 0 && (
                  <div className="rounded-3xl overflow-hidden shadow-lg border border-orange-200 dark:border-orange-800/40">
                    {/* Header */}
                    <div className="bg-gradient-to-l from-orange-600 to-red-600 px-5 py-4">
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">النواقص — مطلوب شراؤها</h3>
                            <p className="text-orange-200 text-[10px] font-bold">{lowStockItems.length} مادة بحاجة للشراء</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2 text-center border border-white/20">
                            <p className="text-orange-200 text-[9px] font-bold mb-0.5">💰 التكلفة الإجمالية</p>
                            <p className="text-white font-black text-sm">{lowStockItems.reduce((s, i) => s + (Number(i.price || 0) * Number(i.neededQuantity || 1)), 0).toLocaleString()} <span className="text-[9px] font-normal">د.ع</span></p>
                          </div>
                        </div>
                      </div>


                    </div>

                    {/* Grid of shortage cards */}
                    <div className="bg-orange-50 dark:bg-orange-900/10 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {lowStockItems.map(i => {
                          const neededQty = Number(i.neededQuantity || 1);
                          const cost = neededQty * Number(i.price || 0);
                          return (
                            <div key={i.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-orange-100 dark:border-orange-800/30 shadow-sm overflow-hidden flex flex-col relative">
                              <button onClick={() => setShowEditInventory(i)} className="absolute top-1.5 left-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                <Edit className="w-3 h-3" />
                              </button>
                              {/* Item image / emoji */}
                              <div className="h-20 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-4xl relative">
                                {(i.imageUrl || i.tempImageUrl) ? (
                                  <img src={i.imageUrl || i.tempImageUrl} alt={i.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{i.category === "كريمات" ? "🧁" : i.category === "حشوات" ? "🍫" : i.category === "طحين وسكر" ? "🌾" : i.category === "ألوان وإضافات" ? "🎨" : i.category === "تغليف وزينة" ? "🎀" : i.category === "أدوات" ? "🔧" : "📦"}</span>
                                )}
                                <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg">{neededQty} {i.unit}</span>
                              </div>

                              <div className="p-3 flex flex-col gap-2 flex-1">
                                <div>
                                  <p className="font-black text-gray-900 dark:text-white text-sm leading-tight truncate">{i.name}</p>
                                  <p className="text-[10px] text-gray-500 font-bold">{cost > 0 ? `${cost.toLocaleString()} د.ع` : 'لا يوجد سعر'}</p>
                                </div>

                                {/* Quantity controls */}
                                <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-xl px-2 py-1 border border-gray-100 dark:border-zinc-700">
                                  <button onClick={async () => {
                                    const newVal = neededQty + 1;
                                    // Optimistic
                                    setInventory(prev => prev.map(x => x.id === i.id ? { ...x, neededQuantity: newVal } : x));
                                    try {
                                      await updateDoc(doc(db, "cake_inventory", i.id), { neededQuantity: newVal });
                                    } catch (e) {
                                      setInventory(prev => prev.map(x => x.id === i.id ? { ...x, neededQuantity: neededQty } : x));
                                      toast.error("فشل التحديث");
                                    }
                                  }} className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 text-emerald-600 font-bold text-base flex items-center justify-center shadow-sm hover:bg-emerald-50 transition">+</button>
                                  <span className="text-xs font-black text-gray-700 dark:text-gray-200">{neededQty}</span>
                                  <button onClick={async () => {
                                    const newVal = Math.max(0, neededQty - 1);
                                    // Optimistic
                                    setInventory(prev => prev.map(x => x.id === i.id ? { ...x, neededQuantity: newVal } : x));
                                    try {
                                      await updateDoc(doc(db, "cake_inventory", i.id), { neededQuantity: newVal });
                                    } catch (e) {
                                      setInventory(prev => prev.map(x => x.id === i.id ? { ...x, neededQuantity: neededQty } : x));
                                      toast.error("فشل التحديث");
                                    }
                                  }} className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-700 text-red-500 font-bold text-base flex items-center justify-center shadow-sm hover:bg-red-50 transition">−</button>
                                </div>
                                <div className="mt-auto flex flex-col gap-1.5 w-full">
                                  <button onClick={() => handlePurchaseMissing(i)} className="w-full text-[10px] font-black py-2 rounded-lg transition shadow-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5">
                                    <Check className="w-3 h-3" /> تم توفير المادة
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-6">
                  <h3 className="font-black text-gray-800 dark:text-gray-200">سجل المخزن (جميع المواد) ({filteredInventory.length})</h3>
                  <button onClick={() => setShowAddInventory(true)} className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 flex items-center gap-1 transition shadow-sm">
                    <Plus className="w-3 h-3" /> إضافة مادة
                  </button>
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-bold">لا توجد مواد في المخزن بعد</p>
                    <Link href="/admin/inventory" className="mt-3 inline-block bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold">إضافة مواد</Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {INVENTORY_CATEGORIES.map(cat => {
                      const catItems = filteredInventory.filter(item => {
                        const itemCat = item.category || "أخرى";
                        const matchesCat = itemCat === cat || (cat === "أخرى" && !INVENTORY_CATEGORIES.includes(itemCat));
                        return matchesCat;
                      });
                      if (catItems.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-3">
                          <h3 className={`text-sm font-black px-3 py-1.5 rounded-full inline-block ${CAT_COLORS[cat] || "bg-gray-100 text-gray-600"}`}>
                            {cat} ({catItems.length})
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {catItems.map(item => {
                              const isLow = Number(item.quantity) <= Number(item.minAlert);
                              const isZero = Number(item.quantity) <= 0;
                              return (
                                <div key={item.id} className={`bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col relative ${isZero ? "border-red-300 dark:border-red-800/60" : isLow ? "border-orange-300 dark:border-orange-800/60" : "border-gray-100 dark:border-zinc-800"}`}>
                                  <button onClick={() => setShowEditInventory(item)} className="absolute top-1.5 left-1.5 z-10 w-6 h-6 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 transition">
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  
                                  <div className={`h-24 flex items-center justify-center text-4xl relative ${isZero ? 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-zinc-800 dark:to-zinc-700' : isLow ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-800 dark:to-zinc-700' : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-zinc-800 dark:to-zinc-700'}`}>
                                    {(item.imageUrl || item.tempImageUrl) ? (
                                      <img src={item.imageUrl || item.tempImageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{item.category === "كريمات" ? "🧁" : item.category === "حشوات" ? "🍫" : item.category === "طحين وسكر" ? "🌾" : item.category === "ألوان وإضافات" ? "🎨" : item.category === "تغليف وزينة" ? "🎀" : item.category === "أدوات" ? "🔧" : "📦"}</span>
                                    )}
                                    <span className={`absolute top-1.5 right-1.5 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg ${Number(item.quantity) <= 0 ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-emerald-500'}`}>
                                      {item.quantity} {item.unit}
                                    </span>
                                  </div>
                                  
                                  <div className="p-2 flex flex-col gap-2 flex-1 justify-between">
                                    <div>
                                      <p className="font-black text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 mb-1">{item.name}</p>
                                      <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">المفرد: <span className="font-black">{item.price ? Number(item.price).toLocaleString() : '0'}</span> د.ع</p>
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black mt-0.5">الإجمالي: {item.price ? (Number(item.price) * Number(item.quantity)).toLocaleString() : '0'} د.ع</p>
                                      {Number(item.quantity) <= 0 ? (
                                        <span className="inline-flex mt-1 bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded-md font-bold items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> نفدت الكمية</span>
                                      ) : isLow ? (
                                        <span className="inline-flex mt-1 bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded-md font-bold items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> نقص</span>
                                      ) : null}
                                    </div>
                                    
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-xl px-1.5 py-1 border border-gray-100 dark:border-zinc-700 mt-1">
                                      <button onClick={() => updateInventoryQuantity(item.id, Number(item.quantity), 1)}
                                        className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 text-emerald-600 rounded-lg font-black hover:bg-emerald-50 transition shadow-sm text-sm">+</button>
                                      <span className="text-xs font-black text-gray-800 dark:text-gray-200">{item.quantity}</span>
                                      <button onClick={() => updateInventoryQuantity(item.id, Number(item.quantity), -1)}
                                        className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-700 text-red-600 rounded-lg font-black hover:bg-red-50 transition shadow-sm text-sm">−</button>
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
            )}

            {/* === AUDIT TAB === */}
            {activeTab === "audit" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white">مطابقة وكشف حسابات المركز</h2>
                  <p className="text-sm text-gray-500 mt-1">يتم عرض المبالغ المتوقعة مقابل المبالغ المستلمة فعلياً والديون والأمانات</p>
                </div>
                
                {[
                  { id: "social", label: "طلبات كيك السوشيال", data: auditData.social, icon: <MessageCircle className="w-6 h-6 text-emerald-400" />, colors: "from-emerald-900 via-teal-900 to-slate-950", border: "border-emerald-500/20", glow: "bg-emerald-500/20" },
                  { id: "appCakes", label: "طلبات كيك التطبيق", data: auditData.appCakes, icon: <Sparkles className="w-6 h-6 text-pink-400" />, colors: "from-pink-900 via-rose-900 to-purple-950", border: "border-pink-500/20", glow: "bg-pink-500/20" },
                  { id: "supplies", label: "طلبات مواد الكيك", data: auditData.supplies, icon: <PackageCheck className="w-6 h-6 text-amber-400" />, colors: "from-orange-900 via-amber-900 to-red-950", border: "border-amber-500/20", glow: "bg-amber-500/20" }
                ].map(section => (
                  <div key={section.id} className={`relative bg-gradient-to-br ${section.colors} rounded-3xl p-6 overflow-hidden shadow-2xl border ${section.border}`}>
                    <div className={`absolute top-0 right-0 w-64 h-64 ${section.glow} blur-[80px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none`} />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/40 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                            {section.icon}
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white">{section.label}</h3>
                            <p className="text-sm text-gray-300">{section.data.ordersCount} طلب مكتمل أو قيد التنفيذ</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/5">
                          <p className="text-xs text-gray-300 font-bold mb-1">المبلغ الإجمالي (المتوقع)</p>
                          <p className="text-lg font-black text-white">{section.data.totalExpected.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">د.ع</span></p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                          <p className="text-xs text-emerald-200 font-bold mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> المُستلم الفعلي</p>
                          <p className="text-lg font-black text-emerald-400">{section.data.totalReceived.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                        <div className={`bg-rose-950/40 backdrop-blur-sm rounded-2xl p-4 border ${section.data.totalDebt > 0 ? 'border-rose-500/50' : 'border-rose-900/30'}`}>
                          <p className="text-xs text-rose-300 font-bold mb-1 flex items-center gap-1">🔴 ديون (نطلبهم)</p>
                          <p className="text-lg font-black text-rose-400">{section.data.totalDebt.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                        <div className={`bg-blue-950/40 backdrop-blur-sm rounded-2xl p-4 border ${section.data.totalWeOwe > 0 ? 'border-blue-500/50' : 'border-blue-900/30'}`}>
                          <p className="text-xs text-blue-300 font-bold mb-1 flex items-center gap-1">🔵 أمانات (يطلبونا)</p>
                          <p className="text-lg font-black text-blue-400">{section.data.totalWeOwe.toLocaleString()} <span className="text-[10px] font-normal opacity-70">د.ع</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── Inventory Overview ── */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-500/20">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4"><Package className="w-5 h-5 text-indigo-400" /> مطابقة المخزن</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl col-span-2">
                      <span className="text-gray-300 text-sm font-bold">قيمة البضاعة في المخزن:</span>
                      <span className="text-indigo-300 font-black">{stats.inventoryValue.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-rose-500/20 col-span-2">
                      <span className="text-gray-300 text-sm font-bold">نواقص المخزن (مواد تحت الصفر):</span>
                      <span className="text-rose-400 font-black">{stats.inventoryLow} مادة</span>
                    </div>
                  </div>
                </div>

                {/* ── Smart Advisor ── */}
                <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 rounded-3xl p-6 shadow-2xl border border-emerald-500/30 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[50px] rounded-full pointer-events-none" />
                  <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4"><TrendingUp className="w-6 h-6 text-emerald-400" /> المستشار الذكي للمركز (تحليل وتنبؤ)</h3>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="bg-black/20 p-4 rounded-xl border-r-4 border-emerald-500">
                      <p className="text-sm text-emerald-100 font-bold leading-relaxed">
                        {auditData.social.totalReceived > auditData.appCakes.totalReceived 
                          ? "📈 طلبات السوشيال ميديا تحقق أرباحاً أعلى من التطبيق حالياً. يُنصح بزيادة الحملات الإعلانية على السوشيال ميديا لاستغلال هذا الزخم، مع الاحتفاظ بأسعار تنافسية."
                          : "📈 طلبات كيك التطبيق تحقق أرباحاً أعلى من السوشيال ميديا. هذا مؤشر جيد على ولاء العملاء للتطبيق. استمر في تقديم عروض حصرية داخل التطبيق لزيادة المبيعات."}
                      </p>
                    </div>

                    {(auditData.social.totalDebt + auditData.appCakes.totalDebt + auditData.supplies.totalDebt) > 100000 && (
                      <div className="bg-rose-950/40 p-4 rounded-xl border-r-4 border-rose-500">
                        <p className="text-sm text-rose-200 font-bold leading-relaxed">
                          ⚠️ هنالك ديون متراكمة (أنت تطلبها) تتجاوز 100,000 د.ع. لزيادة هامش الربح والسيولة النقدية لديك، ننصح بالتواصل مع المندوبين والعملاء لتحصيل هذه الديون في أسرع وقت وتجنب تراكمها.
                        </p>
                      </div>
                    )}

                    {stats.inventoryValue > (auditData.supplies.totalReceived * 2) && auditData.supplies.totalReceived > 0 && (
                      <div className="bg-amber-950/40 p-4 rounded-xl border-r-4 border-amber-500">
                        <p className="text-sm text-amber-200 font-bold leading-relaxed">
                          💡 قيمة المخزون الحالي ({stats.inventoryValue.toLocaleString()} د.ع) عالية جداً مقارنة بمبيعات مواد الكيك المستلمة. ننصح بعمل عروض ترويجية لمواد الكيك لتحريك المخزون وتجنب تلف المواد (خاصة ذات الصلاحية المحدودة).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showInventoryDeduct && (
        <InventoryDeductModal
          isOpen={true}
          onClose={() => setShowInventoryDeduct(null)}
          inventoryItems={inventory}
          onDeductSuccess={() => {
            fetchAll();
            toast.success("تم تسجيل النقص في المخزن بنجاح!");
          }}
        />
      )}

      {showEditExternal && (
        <EditExternalOrderModal
          isOpen={true}
          onClose={() => setShowEditExternal(null)}
          order={showEditExternal}
          onEditSuccess={(updatedOrder: any) => {
            if (updatedOrder) {
              setExternalOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
              setShowEditExternal(null);
            }
          }}
        />
      )}

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

      {customerProfile && (
        <CustomerProfileModal
          isOpen={true}
          onClose={() => setCustomerProfile(null)}
          customerName={customerProfile.name}
          customerPhone={customerProfile.phone}
        />
      )}
    </div>
  );
}

