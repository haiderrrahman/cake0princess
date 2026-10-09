"use client";
import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShoppingBag, CheckCircle, XCircle, Clock, Loader2, Package, Plus,
  DollarSign, AlertTriangle, TrendingUp, Smartphone, Receipt,
  BarChart3, RefreshCw, ChevronRight, User, Phone, MapPin,
  Calendar, ArrowRight, Search, Filter, Edit, ChevronDown, GraduationCap, PlayCircle, Image as ImageIcon, Check, MessageCircle, Sparkles, PackageCheck, Banknote,
  Trash2, ExternalLink, ShoppingCart, Store, ChevronUp, Layers, Copy, ChevronLeft, X, Camera
} from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, query, orderBy, limit, onSnapshot, increment, where } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import InventoryDeductModal from "@/components/InventoryDeductModal";
import EditExternalOrderModal from "@/components/EditExternalOrderModal";
import EditInventoryModal from "@/components/EditInventoryModal";
import AdminQuickEntry from "@/components/AdminQuickEntry";
import CustomerProfileModal from "@/components/CustomerProfileModal";
import MapLink from "@/components/MapLink";
import ScanCakeInvoiceModal from "@/components/ScanCakeInvoiceModal";
import ManualCakePurchaseModal from "@/components/ManualCakePurchaseModal";
import CakeMaterialTimelineModal from "@/components/CakeMaterialTimelineModal";
import EditCakeInvoiceModal from "@/components/EditCakeInvoiceModal";
import CakeCostBreakdownModal from "@/components/CakeCostBreakdownModal";
import MaterialPurchaseHistoryModal from "@/components/MaterialPurchaseHistoryModal";
import { CakeMaterialPurchase, calculateItemConsumption } from "@/lib/cakeMaterialPurchases";
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
  cancelled:  { label: "الغاء الطلب", color: "text-amber-900 dark:text-amber-700", bg: "bg-amber-100 dark:bg-amber-900/20" },
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

// Safe TTL cache helper: ensures we NEVER display stale ghost orders from weeks/months ago
// Default TTL is 30 seconds for immediate freshness upon navigation
const getFreshCache = (key: string, maxAgeMs = 30 * 1000) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed._timestamp) {
      if (Date.now() - parsed._timestamp < maxAgeMs && Array.isArray(parsed.data) && parsed.data.length > 0) {
        return parsed.data;
      }
      localStorage.removeItem(key);
      return null;
    }
    // Remove stale un-enveloped cache from previous versions
    localStorage.removeItem(key);
    return null;
  } catch (e) {
    return null;
  }
};

const setFreshCache = (key: string, data: any) => {
  if (typeof window === 'undefined') return;
  try {
    const envelope = {
      _timestamp: Date.now(),
      data
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch (e) {
    console.warn("Failed to set cache:", key, e);
  }
};

function AdminHubContent() {
  const [extOrdersLoaded, setExtOrdersLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRefreshingExt, setIsRefreshingExt] = useState(false);

  const [orders, setOrders] = useState<any[]>(() => {
    return getFreshCache('cache_orders_v2') || [];
  });
  const [externalOrders, setExternalOrders] = useState<any[]>(() => {
    return getFreshCache('cache_external_orders_v2') || [];
  });
  const [customOrders, setCustomOrders] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [homeDebts, setHomeDebts] = useState<any[]>([]);
  const [homeExpenses, setHomeExpenses] = useState<any[]>([]);
  const [homeIncomes, setHomeIncomes] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>(() => {
    return getFreshCache('cache_inventory_v2') || [];
  });
  const [storeSales, setStoreSales] = useState<any[]>([]);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [settleOrder, setSettleOrder] = useState<any>(null);
  const [settleOrderType, setSettleOrderType] = useState<"external" | "app" | null>(null);
  const [settleDebtType, setSettleDebtType] = useState<"none" | "customer_owes" | "we_owe">("none");
  const [settleRemainingAmount, setSettleRemainingAmount] = useState<string>("");
  const [settleDestination, setSettleDestination] = useState<"cake_funds" | "salary_debt">("cake_funds");
  const [settleSalaryAmount, setSettleSalaryAmount] = useState<string>("");
  const [cancelOrder, setCancelOrder] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [viewingCostOrder, setViewingCostOrder] = useState<any | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab') as string;
  const defaultTab = rawTab || "external";
  const activeTab = (defaultTab === "stats" ? "audit" : defaultTab) as "orders" | "external" | "supplies_orders" | "courses" | "inventory" | "audit";

  const handleRefreshExternal = async () => {
    setIsRefreshingExt(true);
    try {
      const qExt = query(collection(db, "external_orders"), orderBy("createdAt", "desc"), limit(100));
      const snap = await getDocs(qExt);
      const allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setExternalOrders(allExt);
      setExtOrdersLoaded(true);
      try {
        const cleanExt = allExt.slice(0, 100).map(o => {
          const clean = { ...o };
          delete clean.tempImageUrl;
          return clean;
        });
        setFreshCache("cache_external_orders_v2", cleanExt);
      } catch {}
      toast.success("تم تحديث طلبات السوشيال بنجاح 🔄");
    } catch (e) {
      console.error("Refresh error:", e);
      // Fallback
      try {
        const snap = await getDocs(collection(db, "external_orders"));
        let allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        allExt.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0).getTime());
        setExternalOrders(allExt.slice(0, 100));
        setExtOrdersLoaded(true);
        toast.success("تم تحديث طلبات السوشيال بنجاح 🔄");
      } catch (err) {
        toast.error("فشل تحديث البيانات، يرجى إعادة المحاولة");
      }
    } finally {
      setIsRefreshingExt(false);
    }
  };

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
  const [blacklistedCustomers, setBlacklistedCustomers] = useState<string[]>([]);

  // Inventory sub-tab & cake material purchases state
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'cycles' | 'purchases'>('stock');
  const [purchases, setPurchases] = useState<CakeMaterialPurchase[]>([]);
  const [isScanCakeInvoiceOpen, setIsScanCakeInvoiceOpen] = useState(false);
  const [isManualCakePurchaseOpen, setIsManualCakePurchaseOpen] = useState(false);
  const [manualPurchaseInitialItem, setManualPurchaseInitialItem] = useState<any>(null);
  const [timelineModalItem, setTimelineModalItem] = useState<any>(null);
  const [cycleFilterStatus, setCycleFilterStatus] = useState<'all' | 'critical' | 'warning' | 'safe'>('all');
  const [purchaseInvoiceFilter, setPurchaseInvoiceFilter] = useState<'all' | 'invoiced' | 'non_invoiced'>('all');
  const [purchaseSearchQuery, setPurchaseSearchQuery] = useState("");
  const [purchaseViewMode, setPurchaseViewMode] = useState<'invoices' | 'items'>('invoices');
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [editingCakeInvoice, setEditingCakeInvoice] = useState<any | null>(null);
  const [invoiceItemFilter, setInvoiceItemFilter] = useState("");
  const [isMaterialHistoryModalOpen, setIsMaterialHistoryModalOpen] = useState(false);
  const [selectedHistoryItemName, setSelectedHistoryItemName] = useState("");
  const [previewZoomImageUrl, setPreviewZoomImageUrl] = useState<{ url: string; title: string } | null>(null);

  const toggleExpandInvoice = (invId: string) => {
    setExpandedInvoiceIds(prev => ({
      ...prev,
      [invId]: !prev[invId]
    }));
  };

  const [stats, setStats] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hub_stats');
      if (saved) return JSON.parse(saved);
    }
    return {
      todaySales: 0, weekSales: 0, monthSales: 0, allTimeSales: 0, 
      todayExtSales: 0, weekExtSales: 0, monthExtSales: 0, allTimeExtSales: 0,
      extOweUs: 0, extWeOwe: 0,
      totalOrders: 0, pendingOrders: 0, pendingExtOrders: 0, pendingExtOrdersAmount: 0, externalSales: 0, externalProfit: 0,
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
      const cleanOrders = orders.slice(0, 50).map(o => ({ ...o, items: o.items?.map((i:any) => ({ ...i, tempImageUrl: undefined })) }));
      setFreshCache("cache_orders_v2", cleanOrders);
      
      const cleanExt = externalOrders.slice(0, 100).map(o => {
        const clean = { ...o };
        delete clean.tempImageUrl;
        return clean;
      });
      setFreshCache("cache_external_orders_v2", cleanExt);
      
      const cleanSales = storeSales.slice(0, 50);
      setFreshCache("cache_store_sales_v2", cleanSales);
    } catch (e) {
      console.error("Cache error:", e);
    }
  }, [orders, externalOrders, storeSales]);

  const fetchAll = useCallback(async () => {
    try {
      const [customSnap, coursesSnap] = await Promise.all([
        getDocs(query(collection(db, "custom_orders"), orderBy("createdAt", "desc"), limit(100))),
        getDocs(collection(db, "courses"))
      ]);
      setCustomOrders(customSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCourses(coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    const handleBackgroundUpload = () => {
      fetchAll();
    };
    window.addEventListener('backgroundUploadSuccess', handleBackgroundUpload);
    
    // Real-time listener for expenses
    const expQuery = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
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

    // Real-time listener for cake material purchases
    const unsubPurchases = onSnapshot(
      query(collection(db, "cake_material_purchases"), orderBy("purchaseDate", "desc")),
      (snap) => {
        setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() } as CakeMaterialPurchase)));
      },
      (err) => console.error("Purchases listener err:", err)
    );

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

    const unsubCustomers = onSnapshot(query(collection(db, "customers"), where("isBlacklisted", "==", true)), (snap) => {
      const names = snap.docs.map(d => d.data().name).filter(Boolean);
      const phones = snap.docs.map(d => d.data().phone).filter(Boolean);
      setBlacklistedCustomers([...names, ...phones]);
    });

    return () => {
      window.removeEventListener('backgroundUploadSuccess', handleBackgroundUpload);
      unsubExpenses();
      unsubInventory();
      unsubPurchases();
      unsubHomeDebts();
      unsubHomeExpenses();
      unsubHomeIncomes();
      unsubCustomers();
    };
  }, [fetchAll]);

  // Real-time listeners for orders, external_orders, and store_sales with limits
  useEffect(() => {
    const qExt = query(collection(db, "external_orders"), orderBy("createdAt", "desc"), limit(100));

    // Parallel instant fetch for zero delay on mount
    getDocs(qExt).then((snap) => {
      if (!snap.empty) {
        const allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        setExternalOrders(allExt);
        setExtOrdersLoaded(true);
        setLoading(false);
      }
    }).catch(() => {
      getDocs(collection(db, "external_orders")).then(snap => {
        let allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        allExt.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0).getTime());
        setExternalOrders(allExt.slice(0, 100));
        setExtOrdersLoaded(true);
        setLoading(false);
      }).catch(() => {});
    });

    const unsubExt = onSnapshot(qExt, (snap) => {
      const allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setExternalOrders(allExt);
      setExtOrdersLoaded(true);
      setLoading(false);
    }, (err) => {
      console.error("External orders listener error:", err);
      // Fallback
      getDocs(collection(db, "external_orders")).then(snap => {
        const allExt = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        allExt.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0).getTime() - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0).getTime());
        setExternalOrders(allExt.slice(0, 100));
        setExtOrdersLoaded(true);
        setLoading(false);
      }).catch(() => {
        setExtOrdersLoaded(true);
        setLoading(false);
      });
    });

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const allOrd = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setOrders(allOrd);
      setOrdersLoaded(true);
    }, (err) => {
      console.error("Orders listener error:", err);
    });

    const qStore = query(collection(db, "store_sales"), orderBy("createdAt", "desc"), limit(100));
    const unsubStore = onSnapshot(qStore, (snap) => {
      const allStore = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setStoreSales(allStore);
    }, (err) => {
      console.error("Store sales listener error:", err);
    });

    return () => { unsubExt(); unsubOrders(); unsubStore(); };
  }, []);


  // Reactive Stats Calculation
  useEffect(() => {
    let todaySales = 0, weekSales = 0, monthSales = 0, allTimeSales = 0;
    let todayExtSales = 0, weekExtSales = 0, monthExtSales = 0, allTimeExtSales = 0;
    let todayDeliveriesCount = 0, todayDeliveriesAmount = 0;
    let todayExtDeliveriesCount = 0, todayExtDeliveriesAmount = 0;
    let extOweUs = 0, extWeOwe = 0;
    let totalExtDeliveryFees = 0;
    
    let breakdown = { social: 0, storeSupplies: 0, appSupplies: 0, appAcademy: 0, appCakes: 0 };
    let totalProfit = 0;

    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pendingOrders = orders.filter(o => ["pending", "processing"].includes(o.status));
    
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

    orders.forEach(o => {
      if (["rejected", "cancelled"].includes(o.status)) return;
      const amt = Number(o.toPayNow) || Number(o.total) || 0;
      calcSales(o, amt, false);
      
      const dDate = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
      dDate.setHours(0,0,0,0);
      if (dDate.getTime() === today.getTime()) {
        todayDeliveriesCount++;
        todayDeliveriesAmount += amt;
      }
      
      const isDelivered = o.status === 'delivered' || o.status === 'completed';
      if (isDelivered) {
        totalProfit += (amt * 0.3); // Rough estimate for app profit
      }
      
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
    
    externalOrders.forEach(o => {
      if (["rejected", "cancelled"].includes(o.status)) return;
      const price = Number(o.price) || 0;
      const isDelivered = o.status === 'delivered' || o.status === 'completed';
      
      const dDate = o.deliveryDate ? new Date(o.deliveryDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0));
      dDate.setHours(0,0,0,0);
      if (dDate.getTime() === today.getTime()) {
        todayExtDeliveriesCount++;
        todayExtDeliveriesAmount += price;
      }
      
      let received = price;
      if (o.paidAmount !== undefined && !o.isDebtSettled) {
        const amt = Number(o.paidAmount);
        if (isDelivered && amt !== price) {
          if (amt < price) {
            extOweUs += (price - amt);
            received = amt;
          } else if (amt > price) {
            extWeOwe += (amt - price);
          }
        }
      }

      calcSales(o, received, true);
      if (isDelivered) {
        totalProfit += Number(o.profit) || 0;
        totalExtDeliveryFees += Number(o.deliveryFee || 0);
      }
      breakdown.social += received;
    });

    storeSales.forEach(o => {
      const amt = Number(o.price) || 0;
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
      d.setHours(0,0,0,0);
      
      allTimeSales += amt; 
      if (d.getTime() === today.getTime()) todaySales += amt;
      if (d >= weekAgo) weekSales += amt;
      if (d >= thirtyDaysAgo) monthSales += amt;
      
      totalProfit += Number(o.profit) || 0;
      breakdown.storeSupplies += amt;
    });

    const recentExt = externalOrders.filter(o => {
      if (!o.createdAt) return false;
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
      return d >= thirtyDaysAgo;
    });

    const externalSales = recentExt.reduce((s, o) => s + Number(o.price || 0), 0);
    const externalProfit = recentExt.reduce((s, o) => s + Number(o.profit || 0), 0);
    
    const pendingExtOrdersList = externalOrders.filter(o => ["pending", "processing"].includes(o.status || 'pending'));
    const pendingExtOrders = pendingExtOrdersList.length;
    const pendingExtOrdersAmount = pendingExtOrdersList.reduce((s, o) => s + Number(o.price || 0), 0);
    const pendingOrdersAmount = pendingOrders.reduce((s, o) => s + (Number(o.toPayNow) || Number(o.total) || 0), 0);

    setStats((prev: any) => ({
      ...prev,
      todaySales, weekSales, monthSales, allTimeSales, 
      todayExtSales, weekExtSales, monthExtSales, allTimeExtSales, 
      todayDeliveriesCount, todayDeliveriesAmount,
      todayExtDeliveriesCount, todayExtDeliveriesAmount,
      extOweUs, extWeOwe,
      totalOrders: orders.length, pendingOrders: pendingOrders.length, pendingOrdersAmount,
      pendingExtOrders, pendingExtOrdersAmount, externalSales, externalProfit, totalExtDeliveryFees,
      totalProfit, netProfit: totalProfit - prev.expenses, breakdown 
    }));
  }, [orders, externalOrders, storeSales]);

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
      
      const order = orders.find(o => o.id === orderId);
      if (order && (order.status === "delivered" || order.status === "completed") && newStatus !== "delivered" && newStatus !== "completed") {
        const refName = order.userName || orderId;
        
        // Revert expenses
        const q = query(collection(db, "expenses"), where("description", "==", `تسديد جزء من الدين المستحق (طلب سوشيال ${refName})`));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "expenses", docSnap.id)));
        await Promise.all(deletePromises);
        
        // Revert legacy explicit home finance incomes
        const updatedIncomes = homeIncomes.filter((inc: any) => inc.name !== `تسديد من طلب ${refName}`);
        if (updatedIncomes.length !== homeIncomes.length) {
          await updateDoc(doc(db, "home_finance", "incomes"), { data: updatedIncomes });
        }
      }

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus, isDebtSettled: false, paidAmount: 0 });
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, isDebtSettled: false, paidAmount: 0 } : o));
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

    if (newStatus === "cancelled") {
      const order = externalOrders.find(o => o.id === orderId);
      if (order) {
        setCancelOrder(order);
        setCancelReason("");
      }
      return;
    }

    try {
      setUpdatingOrder(orderId);

      const order = externalOrders.find(o => o.id === orderId);
      if (order && (order.status === "delivered" || order.status === "completed") && newStatus !== "delivered" && newStatus !== "completed") {
        const refName = order.customerName || orderId;
        
        // Revert expenses
        const q = query(collection(db, "expenses"), where("description", "==", `تسديد جزء من الدين المستحق (طلب سوشيال ${refName})`));
        const querySnapshot = await getDocs(q);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, "expenses", docSnap.id)));
        await Promise.all(deletePromises);
        
        // Revert legacy explicit home finance incomes
        const updatedIncomes = homeIncomes.filter((inc: any) => inc.name !== `تسديد من طلب ${refName}`);
        if (updatedIncomes.length !== homeIncomes.length) {
          await updateDoc(doc(db, "home_finance", "incomes"), { data: updatedIncomes });
        }
      }

      const orderRef = doc(db, "external_orders", orderId);
      await updateDoc(orderRef, { status: newStatus, isDebtSettled: false, paidAmount: 0 });
      // Optimistic update
      setExternalOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, isDebtSettled: false, paidAmount: 0 } : o));
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
    
    if (settleDestination === "salary_debt") {
      const salaryAmt = Number(settleSalaryAmount);
      if (isNaN(salaryAmt) || salaryAmt <= 0) {
        toast.error("يرجى إدخال مبلغ صحيح لتسديد ديون الراتب");
        return;
      }
      if (salaryAmt > finalPaidAmount) {
        toast.error("مبلغ التسديد لا يمكن أن يكون أكبر من المبلغ المستلم");
        return;
      }
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

      if (settleDestination === "salary_debt") {
        const salaryAmt = Number(settleSalaryAmount);
        const refName = settleOrder.customerName || orderId;

        // 1. Add expense: -salaryAmt (reduces debt)
        await addDoc(collection(db, "expenses"), {
          amount: -salaryAmt,
          category: "تسديد دين",
          description: `تسديد جزء من الدين المستحق (طلب سوشيال ${refName})`,
          month: new Date().getMonth() + 1,
          createdAt: serverTimestamp(),
          isDebt: true
        });

        // 2. Add expense: salaryAmt (logs the expense)
        await addDoc(collection(db, "expenses"), {
          amount: salaryAmt,
          category: "تسديد دين",
          description: `تسديد جزء من الدين المستحق (طلب سوشيال ${refName})`,
          month: new Date().getMonth() + 1,
          createdAt: serverTimestamp(),
          isDebt: false
        });
      }

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

  const submitCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelOrder) return;
    
    try {
      setUpdatingOrder(cancelOrder.id);
      await updateDoc(doc(db, "external_orders", cancelOrder.id), { 
        status: "cancelled", 
        cancelReason: cancelReason
      });
      // Optimistic update
      setExternalOrders(prev => prev.map(o => o.id === cancelOrder.id ? { ...o, status: "cancelled", cancelReason: cancelReason } : o));
      toast.success("تم إلغاء الطلب بنجاح");
      setCancelOrder(null);
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء الإلغاء");
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
    // 1. Blacklisted users at the bottom
    // 2. Delivered / Completed at the bottom
    // 3. Nearest delivery/creation date first (ascending order)
    return combined.sort((a, b) => {
      const isBlacklistedA = blacklistedCustomers.includes(a.shippingAddress?.name || "") || blacklistedCustomers.includes(a.shippingAddress?.phone || "");
      const isBlacklistedB = blacklistedCustomers.includes(b.shippingAddress?.name || "") || blacklistedCustomers.includes(b.shippingAddress?.phone || "");
      
      if (isBlacklistedA && !isBlacklistedB) return 1;
      if (!isBlacklistedA && isBlacklistedB) return -1;

      const isDeliveredA = a.status === 'delivered' || a.status === 'completed' || a.status === 'cancelled';
      const isDeliveredB = b.status === 'delivered' || b.status === 'completed' || b.status === 'cancelled';
      
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

  const itemsWithConsumption = useMemo(() => {
    return inventory.map(item => ({
      item,
      metrics: calculateItemConsumption(item, purchases)
    }));
  }, [inventory, purchases]);

  const filteredCyclesItems = useMemo(() => {
    return itemsWithConsumption.filter(({ item, metrics }) => {
      if (cycleFilterStatus !== 'all' && metrics.depletionStatus !== cycleFilterStatus) {
        return false;
      }
      if (!inventorySearch) return true;
      const s = inventorySearch.toLowerCase();
      return (item.name || "").toLowerCase().includes(s) || (item.category || "").toLowerCase().includes(s);
    });
  }, [itemsWithConsumption, cycleFilterStatus, inventorySearch]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      if (purchaseInvoiceFilter === 'invoiced' && !p.hasInvoice) return false;
      if (purchaseInvoiceFilter === 'non_invoiced' && p.hasInvoice) return false;
      if (purchaseSearchQuery) {
        const s = purchaseSearchQuery.toLowerCase();
        const matchesName = (p.itemName || "").toLowerCase().includes(s);
        const matchesStore = (p.storeName || "").toLowerCase().includes(s);
        const matchesCat = (p.category || "").toLowerCase().includes(s);
        const matchesInvNum = (p.invoiceNumber || "").toLowerCase().includes(s);
        if (!matchesName && !matchesStore && !matchesCat && !matchesInvNum) return false;
      }
      return true;
    });
  }, [purchases, purchaseInvoiceFilter, purchaseSearchQuery]);

  const groupedInvoices = useMemo(() => {
    const groups: Record<string, {
      id: string;
      invoiceId?: string;
      storeName: string;
      invoiceNumber: string;
      date: string;
      hasInvoice: boolean;
      paymentSource: "none" | "cake" | "salary" | "split";
      splitDebtAmount?: number;
      totalAmount: number;
      imageUrl?: string;
      items: CakeMaterialPurchase[];
    }> = {};

    filteredPurchases.forEach((p) => {
      let key = p.invoiceId;
      if (!key) {
        if (p.hasInvoice && (p.invoiceNumber || p.storeName)) {
          key = `inv_${p.purchaseDate}_${p.storeName || 'store'}_${p.invoiceNumber || 'no_num'}`;
        } else {
          key = `cash_${p.purchaseDate}_${p.storeName || 'direct'}_${p.id}`;
        }
      }

      if (!groups[key]) {
        groups[key] = {
          id: key,
          invoiceId: p.invoiceId,
          storeName: p.storeName || (p.hasInvoice ? "معرض مستلزمات الكيك" : "مشتريات نقدية مباشرة"),
          invoiceNumber: p.invoiceNumber || "",
          date: p.purchaseDate || "",
          hasInvoice: p.hasInvoice,
          paymentSource: p.paymentSource || "cake",
          splitDebtAmount: p.splitDebtAmount || 0,
          totalAmount: 0,
          imageUrl: p.invoiceImageUrl || "",
          items: []
        };
      }

      groups[key].items.push(p);
      groups[key].totalAmount += Number(p.totalPrice || 0);
      if (!groups[key].storeName && p.storeName) groups[key].storeName = p.storeName;
      if (!groups[key].invoiceNumber && p.invoiceNumber) groups[key].invoiceNumber = p.invoiceNumber;
      if (!groups[key].imageUrl && p.invoiceImageUrl) groups[key].imageUrl = p.invoiceImageUrl;
    });

    return Object.values(groups).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [filteredPurchases]);

  const handleDeleteWholeInvoice = async (inv: {
    id: string;
    invoiceId?: string;
    storeName: string;
    items: CakeMaterialPurchase[];
    totalAmount: number;
  }) => {
    const confirmed = await customConfirm(
      `هل أنت متأكد من حذف فاتورة "${inv.storeName}" (${inv.items.length} مواد) بإجمالي ${inv.totalAmount.toLocaleString()} د.ع نهائياً؟`
    );
    if (!confirmed) return;

    try {
      for (const item of inv.items) {
        if (item.id) {
          await deleteDoc(doc(db, "cake_material_purchases", item.id));
          try {
            const qP = await getDocs(query(collection(db, "expenses"), where("purchaseId", "==", item.id)));
            for (const pDoc of qP.docs) {
              await deleteDoc(doc(db, "expenses", pDoc.id));
            }
          } catch {}
        }
      }
      if (inv.invoiceId) {
        try {
          await deleteDoc(doc(db, "cake_invoices", inv.invoiceId));
          const qExp = await getDocs(query(collection(db, "expenses"), where("invoiceId", "==", inv.invoiceId)));
          for (const expDoc of qExp.docs) {
            await deleteDoc(doc(db, "expenses", expDoc.id));
          }
        } catch (e) {
          console.warn("Could not delete from cake_invoices or expenses:", e);
        }
      }
      toast.success("تم حذف الفاتورة وجميع موادها والمصروف المرتبط بنجاح");
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء حذف الفاتورة");
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا السجل نهائياً؟"))) return;

    try {
      await deleteDoc(doc(db, "cake_material_purchases", purchaseId));
      toast.success("تم حذف السجل بنجاح");
    } catch (e) {
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const filteredExternalOrders = externalOrders.filter(o => {
    if (extSearch) {
      const q = extSearch.toLowerCase().trim();
      const matchName = o.customerName?.toLowerCase().includes(q);
      const matchCake = o.cakeName?.toLowerCase().includes(q);
      const matchPhone = o.customerPhone?.includes(q);
      const matchId = o.id?.toLowerCase().includes(q);
      if (!matchName && !matchCake && !matchPhone && !matchId) return false;
    }
    return true;
  }).sort((a, b) => {
    const isBlacklistedA = blacklistedCustomers.includes(a.customerName || "") || blacklistedCustomers.includes(a.customerPhone || "");
    const isBlacklistedB = blacklistedCustomers.includes(b.customerName || "") || blacklistedCustomers.includes(b.customerPhone || "");
    
    if (isBlacklistedA && !isBlacklistedB) return 1;
    if (!isBlacklistedA && isBlacklistedB) return -1;

    const isDeliveredA = a.status === 'delivered' || a.status === 'completed';
    const isDeliveredB = b.status === 'delivered' || b.status === 'completed';
    
    const isCancelledA = a.status === 'cancelled';
    const isCancelledB = b.status === 'cancelled';

    const isFinishedA = isDeliveredA || isCancelledA;
    const isFinishedB = isDeliveredB || isCancelledB;
    
    const isDebtA = isDeliveredA && a.paidAmount !== undefined && Number(a.paidAmount) !== Number(a.price) && !a.isDebtSettled;
    const isDebtB = isDeliveredB && b.paidAmount !== undefined && Number(b.paidAmount) !== Number(b.price) && !b.isDebtSettled;

    if (isDebtA && !isDebtB) return -1; // Debt goes up
    if (!isDebtA && isDebtB) return 1;

    // normal finished (delivered without debt, or cancelled) goes down
    if (isFinishedA && !isDebtA && (!isFinishedB || isDebtB)) return 1;
    if (isFinishedB && !isDebtB && (!isFinishedA || isDebtA)) return -1;

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
      const isDelivered = order.status === 'delivered' || order.status === 'completed';
      if (!isDelivered) return;
      result.social.ordersCount++;

      const price = Number(order.price || 0);
      const paid  = Number(order.paidAmount ?? price); // if paidAmount missing → fully paid
      result.social.totalExpected += price;

      const isDebt = order.paidAmount !== undefined
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
      const isDelivered = order.status === 'delivered' || order.status === 'completed';
      if (!isDelivered) return;

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
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  router.push("/admin");
                }
              }}
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition active:scale-95"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-black text-white mb-1">{currentTabInfo.title}</h1>
              <p className="text-xs text-white/70 font-bold">{currentTabInfo.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "external" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshExternal}
                  disabled={isRefreshingExt}
                  className="bg-white/15 hover:bg-white/25 text-white rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black backdrop-blur-md transition active:scale-95 border border-white/20 disabled:opacity-50"
                  title="تحديث فوري من قاعدة البيانات مباشرة"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingExt ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshingExt ? "جاري التحديث..." : "تحديث فوري"}</span>
                  <span className="sm:hidden">تحديث</span>
                </button>
                <button onClick={() => setShowAddSocial(true)} className="bg-white text-emerald-950 rounded-xl px-3.5 py-2 flex items-center gap-1.5 text-xs font-black shadow-md hover:bg-gray-100 transition active:scale-95">
                  <Plus className="w-4 h-4 text-emerald-600" /> إضافة سوشيال
                </button>
              </div>
            )}
            {activeTab === "inventory" && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setIsScanCakeInvoiceOpen(true)}
                  className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 rounded-xl px-2.5 sm:px-3.5 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md active:scale-95 transition"
                >
                  <Receipt className="w-3.5 h-3.5 text-amber-950" />
                  <span className="hidden sm:inline">🧾 إضافة فاتورة مواد</span>
                  <span className="sm:hidden">🧾 إضافة فاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHistoryItemName("");
                    setIsMaterialHistoryModalOpen(true);
                  }}
                  className="bg-white/15 hover:bg-white/25 text-white rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black backdrop-blur-md transition active:scale-95 border border-white/20"
                >
                  <Search className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">شوكت ومنين اشتريت؟</span>
                  <span className="sm:hidden">كاشف الشراء</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualPurchaseInitialItem(null);
                    setIsManualCakePurchaseOpen(true);
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black backdrop-blur-md transition active:scale-95 border border-white/15 hidden md:flex"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>شراء مفرد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddInventory(true)}
                  className="bg-white text-blue-950 rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md hover:bg-gray-100 transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">إضافة مادة</span>
                  <span className="sm:hidden">مادة</span>
                </button>
              </div>
            )}
            {activeTab === "supplies_orders" && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setIsScanCakeInvoiceOpen(true)}
                  className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 text-slate-950 rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black shadow-md active:scale-95 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-950" />
                  <span className="hidden sm:inline">📸 فاتورة بالـ AI</span>
                  <span className="sm:hidden">📸 فاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualPurchaseInitialItem(null);
                    setIsManualCakePurchaseOpen(true);
                  }}
                  className="bg-white/15 hover:bg-white/25 text-white rounded-xl px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 text-xs font-black backdrop-blur-md transition active:scale-95 border border-white/20"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">تسجيل شراء</span>
                  <span className="sm:hidden">شراء</span>
                </button>
              </div>
            )}
            <button onClick={fetchAll} className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition backdrop-blur-md border border-white/10" title="تحديث">
              <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Dynamic KPI Glassmorphism Stats Cards */}
        {activeTab === "orders" && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> مبيعات اليوم</p>
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <p className="text-lg font-black text-white">{(stats.todaySales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-[9px] text-rose-200 font-bold">الطلبات: {stats.todayDeliveriesCount || 0}</p>
                  <p className="text-[9px] text-rose-200 font-bold">الكلي: {(stats.todayDeliveriesAmount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> طلبات معلقة</p>
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-amber-300">{stats.pendingOrders || 0} <span className="text-[10px] font-normal">طلب</span></p>
                <p className="text-sm font-black text-amber-100 bg-amber-500/20 px-2 py-0.5 rounded-lg">{(stats.pendingOrdersAmount || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> مبيعات الأسبوع</p>
              <p className="text-lg font-black text-white">{(stats.weekSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> المبيعات الشهرية</p>
              <p className="text-lg font-black text-white">{(stats.monthSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-rose-200 mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> المبيعات الكلية</p>
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-purple-200">{(stats.allTimeSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "external" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 relative z-10">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> مبيعات اليوم</p>
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <p className="text-lg font-black text-white">{(stats.todayExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-[9px] text-emerald-200 font-bold">الطلبات: {stats.todayExtDeliveriesCount || 0}</p>
                  <p className="text-[9px] text-emerald-200 font-bold">الكلي: {(stats.todayExtDeliveriesAmount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> طلبات معلقة</p>
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-amber-300">{stats.pendingExtOrders || 0} <span className="text-[10px] font-normal">طلب</span></p>
                <p className="text-sm font-black text-amber-100 bg-amber-500/20 px-2 py-0.5 rounded-lg">{(stats.pendingExtOrdersAmount || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> مبيعات الأسبوع</p>
              <p className="text-lg font-black text-white">{(stats.weekExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> المبيعات الشهرية</p>
              <p className="text-lg font-black text-white">{(stats.monthExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-emerald-200 mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> المبيعات الكلية</p>
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-teal-200">{(stats.allTimeExtSales || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5">
              <p className="text-[10px] font-bold text-cyan-200 mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> إجمالي التوصيل</p>
              <p className="text-lg font-black text-cyan-300">{(stats.totalExtDeliveryFees || 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
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
              <div className="flex justify-between items-end">
                <p className="text-lg font-black text-amber-300">{suppliesOrders.filter(o => o.status === "pending" || o.status === "processing").length} <span className="text-[10px] font-normal">طلب</span></p>
                <p className="text-sm font-black text-amber-100 bg-amber-500/20 px-2 py-0.5 rounded-lg">{suppliesOrders.filter(o => o.status === "pending" || o.status === "processing").reduce((sum, o) => sum + (Number(o.toPayNow) || Number(o.total) || 0), 0).toLocaleString()} <span className="text-[10px] font-normal">د.ع</span></p>
              </div>
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

      {/* Futuristic Hub Navigation Tabs Bar */}
      <div className="px-4 sm:px-5 -mt-5 relative z-20">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-gray-100 dark:border-zinc-800 p-1.5 rounded-2xl shadow-xl flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {[
            { id: "external", label: "📱 سوشيال", count: stats.pendingExtOrders },
            { id: "orders", label: "🛒 التطبيق", count: stats.pendingOrders },
            { id: "inventory", label: "📦 المخزن", count: null },
            { id: "supplies_orders", label: "🧂 مواد الكيك", count: null },
            { id: "courses", label: "🎓 الأكاديمية", count: null },
            { id: "audit", label: "📊 مطابقة وكشف", count: null },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === t.id
                  ? "bg-gradient-to-r from-slate-900 to-zinc-800 text-white dark:from-white dark:to-zinc-200 dark:text-zinc-950 shadow-md scale-[1.02]"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span>{t.label}</span>
              {t.count !== null && t.count > 0 && (
                <span className="bg-rose-500 text-white font-mono text-[10px] px-1.5 py-0.5 rounded-full font-black">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
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

      {/* Cake Materials & AI Invoices Modals */}
      <ScanCakeInvoiceModal
        isOpen={isScanCakeInvoiceOpen}
        onClose={() => setIsScanCakeInvoiceOpen(false)}
        onSuccess={() => {
          fetchAll();
          setIsScanCakeInvoiceOpen(false);
        }}
        inventoryItems={inventory || []}
      />

      <ManualCakePurchaseModal
        isOpen={isManualCakePurchaseOpen}
        onClose={() => {
          setIsManualCakePurchaseOpen(false);
          setManualPurchaseInitialItem(null);
        }}
        onSuccess={() => {
          fetchAll();
          setIsManualCakePurchaseOpen(false);
          setManualPurchaseInitialItem(null);
        }}
        inventoryItems={inventory}
        initialItem={manualPurchaseInitialItem}
      />

      <CakeMaterialTimelineModal
        isOpen={!!timelineModalItem}
        onClose={() => setTimelineModalItem(null)}
        item={timelineModalItem}
        allPurchases={purchases}
        onOpenPurchaseModal={(item) => {
          setTimelineModalItem(null);
          setManualPurchaseInitialItem(item);
          setIsManualCakePurchaseOpen(true);
        }}
        onDeletePurchase={handleDeletePurchase}
      />

      <MaterialPurchaseHistoryModal
        isOpen={isMaterialHistoryModalOpen}
        onClose={() => {
          setIsMaterialHistoryModalOpen(false);
          setSelectedHistoryItemName("");
        }}
        initialItemName={selectedHistoryItemName}
        purchases={purchases}
        inventoryItems={inventory}
        onViewImage={(url: string, title: string) => setPreviewZoomImageUrl({ url, title })}
        onOpenInvoiceDetails={(inv: any) => setViewingInvoice(inv)}
        onOpenManualPurchase={(itemName: string) => {
          setIsMaterialHistoryModalOpen(false);
          const found = inventory.find((i: any) => i.name.trim().toLowerCase() === itemName.trim().toLowerCase());
          setManualPurchaseInitialItem(found || { name: itemName });
          setIsManualCakePurchaseOpen(true);
        }}
      />

      <div className="p-5">
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
                      const isBlacklisted = blacklistedCustomers.includes(order.shippingAddress?.name || "") || blacklistedCustomers.includes(order.shippingAddress?.phone || "");
                      return (
                        <div key={order.id} className={`rounded-3xl p-3 sm:p-4 flex gap-4 shadow-sm relative group overflow-hidden transition-all duration-300 hover:shadow-md ${isBlacklisted ? 'bg-zinc-900 border border-zinc-800' : 'bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800'}`}>
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
                                <h3 className={`font-black text-base sm:text-lg leading-tight group-hover:text-[#FF3366] transition underline decoration-transparent group-hover:decoration-[#FF3366] underline-offset-4 flex items-center gap-1.5 ${isBlacklisted ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                  {order.shippingAddress?.name || order.userName || "ضيف"}
                                  {isBlacklisted && <span className="text-[9px] bg-zinc-800 text-red-400 px-1.5 py-0.5 rounded-md whitespace-nowrap">محظور 🚫</span>}
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
                              
                              {order.address && (
                                <div className="mt-2 text-[11px] sm:text-xs">
                                  <MapLink 
                                    address={`${order.deliveryZone || ''} - ${order.address}`}
                                    locationUrl={order.location ? `https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}` : ""}
                                    className={`font-bold flex items-start gap-1.5 transition cursor-pointer w-fit ${order.location ? 'text-blue-500 hover:underline underline-offset-2 decoration-blue-200' : 'text-gray-500 hover:text-blue-500'}`} 
                                  />
                                </div>
                              )}
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
                                <span className="font-black text-rose-500 text-xl sm:text-2xl leading-none">
                                  {Number(order.total).toLocaleString()} <span className="text-[10px] text-rose-500 font-bold">د.ع</span>
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

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleRefreshExternal}
                      disabled={isRefreshingExt}
                      className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-3 py-2 text-xs font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                      title="تحديث فوري من قاعدة البيانات مباشرة"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingExt ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingExt ? "جاري التحديث..." : "تحديث فوري"}</span>
                    </button>
                  </div>
                </div>

                {!extOrdersLoaded && externalOrders.length === 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-w-4xl mx-auto w-full">
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="bg-white dark:bg-zinc-900 rounded-3xl p-3 border border-gray-100 dark:border-zinc-800 animate-pulse flex flex-col gap-3">
                        <div className="w-full aspect-square rounded-2xl bg-gray-200 dark:bg-zinc-800" />
                        <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded-md w-3/4 mx-auto" />
                        <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded-md w-1/2 mx-auto" />
                        <div className="h-7 bg-gray-100 dark:bg-zinc-800/60 rounded-xl mt-1" />
                      </div>
                    ))}
                  </div>
                ) : filteredExternalOrders.length === 0 ? (
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
                      const isCancelled = order.status === "cancelled";

                      const isBlacklisted = blacklistedCustomers.includes(order.customerName || "") || blacklistedCustomers.includes(order.customerPhone || "");

                      return (
                        <div key={order.id} className={`rounded-3xl p-3 flex flex-col gap-3 shadow-sm relative group border-2 transition-all ${
                          isBlacklisted ? 'bg-zinc-900 border-zinc-800' :
                          isCancelled ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900' :
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
                              <button onClick={() => setCustomerProfile({ name: order.customerName, phone: order.customerPhone })} className={`text-center group mx-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl transition active:scale-95 border shadow-sm ${isBlacklisted ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-700 border-gray-100 dark:border-zinc-700'}`}>
                                <span className={`text-sm ${isBlacklisted ? 'text-gray-500' : 'text-[#FF3366]'}`}>👤</span>
                                <h3 className={`font-black text-sm sm:text-base leading-tight line-clamp-1 underline underline-offset-4 flex items-center gap-1.5 ${isBlacklisted ? 'text-gray-500 decoration-transparent' : 'text-gray-900 dark:text-white decoration-gray-300 dark:decoration-zinc-600'}`}>
                                  {order.customerName}
                                  {isBlacklisted && <span className="text-[9px] bg-zinc-700 text-red-400 px-1.5 py-0.5 rounded-md whitespace-nowrap decoration-transparent">محظور</span>}
                                </h3>
                              </button>
                              {order.customerPhone && (
                                <a href={`tel:${order.customerPhone}`} className="text-[10px] font-bold text-gray-500 mt-1.5 flex items-center justify-center gap-1.5 hover:text-emerald-500 transition">
                                  <Phone className="w-3 h-3" /> {order.customerPhone}
                                </a>
                              )}
                              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 font-bold mt-1">{order.cakeName}</p>
                              
                              <div className="flex justify-center mt-1.5 text-[9px] sm:text-[10px]">
                                <span className="bg-gray-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-0.5 font-bold">
                                  {order.platform === "انستغرام" ? "📸" : order.platform === "واتساب" ? "💬" : "📱"} {order.platform}
                                </span>
                              </div>
                              {order.address && (
                                <div className="flex justify-center mt-1">
                                  <MapLink 
                                    address={order.address} 
                                    locationUrl={order.locationUrl || ""} 
                                    className={`text-xs sm:text-sm font-bold flex items-center gap-1 line-clamp-1 max-w-[150px] transition cursor-pointer ${order.locationUrl ? 'text-blue-500 hover:text-blue-600 underline underline-offset-2 decoration-blue-200 dark:decoration-blue-900/50' : 'text-gray-500 hover:text-blue-500'}`} 
                                  />
                                </div>
                              )}
                              {order.deliveryDate && (
                                <div className="mt-2.5 w-full">
                                  <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 p-[2px] rounded-xl shadow-md">
                                    <div className="bg-amber-50 dark:bg-zinc-900 rounded-[10px] px-3 py-2.5 flex flex-col items-center justify-center gap-2">
                                      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                        <Calendar className="w-5 h-5 animate-pulse" />
                                        <span className="font-black text-sm sm:text-base leading-none">
                                          {new Date(order.deliveryDate).toLocaleDateString('ar-IQ')}
                                        </span>
                                      </div>
                                      <span className="text-orange-700 dark:text-orange-400 font-black text-sm sm:text-base leading-none bg-orange-100 dark:bg-orange-900/30 px-3 py-1 rounded-md">
                                        الساعة {new Date(order.deliveryDate).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 mt-auto border-t border-gray-100 dark:border-zinc-800/50 pt-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-gray-400 font-bold">
                                  {Number(order.deliveryFee || 0) > 0 || order.isBismayah ? "المبلغ (الطلب+التوصيل):" : "مبلغ الطلب:"}
                                </span>
                                <div className="flex flex-col items-end">
                                  <span className="font-black text-sm sm:text-lg text-emerald-600 dark:text-emerald-400">{Number(order.totalPriceWithDelivery || order.price || 0).toLocaleString()} د.ع</span>
                                </div>
                              </div>
                              {(order.cost !== undefined && order.cost !== null && order.cost !== "" && Number(order.cost) > 0) ? (
                                <div className="flex justify-between items-center text-[10px] bg-pink-50/70 dark:bg-pink-950/20 px-2 py-1 rounded-lg border border-pink-100 dark:border-pink-900/30">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-500 dark:text-gray-400 font-bold">التكلفة:</span>
                                    <span className="font-black text-gray-800 dark:text-gray-200">{Number(order.cost).toLocaleString()} د.ع</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setViewingCostOrder(order)}
                                    className="text-[9px] bg-pink-100 hover:bg-pink-200 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 px-1.5 py-0.5 rounded font-black transition flex items-center gap-0.5"
                                  >
                                    📋 {order.costBreakdown ? `${order.costBreakdown.ingredients?.length || 12} مادة` : "المقادير"}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCostOrder(order)}
                                    className="text-[9px] text-pink-600 dark:text-pink-400 hover:underline font-bold"
                                  >
                                    + حساب تكلفة المقادير
                                  </button>
                                </div>
                              )}
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
                                  <option value="cancelled" className="bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400">الغاء الطلب</option>
                                </select>
                                <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${extCfg.color}`} />
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600" />}
                              </div>
                            </div>
                            {order.status === "cancelled" && order.cancelReason && (
                              <div className="mt-3 bg-red-50 dark:bg-red-900/10 p-2.5 rounded-xl text-center text-red-600 text-[11px] font-bold border border-red-100 dark:border-red-900/30">
                                ❌ سبب الرفض: {order.cancelReason}
                              </div>
                            )}
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
                      const isCancelled = order.status === "cancelled";

                      return (
                        <div key={order.id} className={`rounded-3xl p-3 sm:p-4 flex gap-4 shadow-sm border-2 transition-all ${
                          isCancelled ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900' :
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
                              <p className="text-[11px] text-gray-500 line-clamp-1 mb-2 font-bold leading-relaxed">
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
                              
                              {order.address && (
                                <div className="mt-2 text-[11px] sm:text-xs">
                                  <MapLink 
                                    address={`${order.deliveryZone || ''} - ${order.address}`}
                                    locationUrl={order.location ? `https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}` : ""}
                                    className={`font-bold flex items-start gap-1.5 transition cursor-pointer w-fit ${order.location ? 'text-blue-500 hover:underline underline-offset-2 decoration-blue-200' : 'text-gray-500 hover:text-blue-500'}`} 
                                  />
                                </div>
                              )}
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
                              <div className="flex flex-col text-left pl-1">
                                <span className="text-[9px] text-gray-400 font-bold mb-0.5">الإجمالي</span>
                                <span className="font-black text-rose-500 text-xl sm:text-2xl leading-none">
                                  {Number(amount).toLocaleString()} <span className="text-[10px] text-rose-500 font-bold">د.ع</span>
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
                {/* Unified Sub-tab Segmented Navigation */}
                <div className="flex bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm gap-1">
                  <button
                    type="button"
                    onClick={() => setInventorySubTab("stock")}
                    className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      inventorySubTab === "stock"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span className="truncate">المخزون ({filteredInventory.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventorySubTab("cycles")}
                    className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      inventorySubTab === "cycles"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="truncate">دورة النفاد ({itemsWithConsumption.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventorySubTab("purchases")}
                    className={`flex-1 py-2.5 px-2 sm:px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      inventorySubTab === "purchases"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span className="truncate">سجل المشتريات ({purchases.length})</span>
                  </button>
                </div>

                {/* ──────── SUB-TAB 1: STOCK & SHORTAGES ──────── */}
                {inventorySubTab === "stock" && (
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="ابحث عن مادة في المخزن..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-bold"
                      />
                    </div>

                    {/* Quick Material Purchase Lookup Card ("شوكت ومنين اشتريت؟") */}
                    <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-purple-500/10 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-purple-950/20 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Search className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>كاشف تاريخ ومحلات الشراء</span>
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">شوكت ومنين؟</span>
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-bold mt-0.5">
                            ابحث عن أي مادة مخزنية لمعرفة متى اشتريتها آخر مرة، من أي متجر، مقارنة الأسعار، وسجل الفواتير السابقة.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHistoryItemName("");
                          setIsMaterialHistoryModalOpen(true);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>فتح كاشف المشتريات</span>
                      </button>
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

                                  <div className="p-2.5 flex flex-col gap-2 flex-1">
                                    <div>
                                      <p className="font-black text-gray-900 dark:text-white text-xs sm:text-sm leading-tight truncate">{i.name}</p>
                                      <p className="text-[10px] text-gray-500 font-bold">{cost > 0 ? `${cost.toLocaleString()} د.ع` : 'لا يوجد سعر'}</p>
                                    </div>

                                    {/* Quantity controls */}
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 rounded-xl px-2 py-1 border border-gray-100 dark:border-zinc-700">
                                      <button onClick={async () => {
                                        const newVal = neededQty + 1;
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
                                      <button onClick={() => handlePurchaseMissing(i)} className="w-full text-[10px] font-black py-1.5 rounded-lg transition shadow-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1">
                                        <Check className="w-3 h-3" /> تم التوفير
                                      </button>
                                      <div className="flex gap-1 w-full">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setManualPurchaseInitialItem(i);
                                            setIsManualCakePurchaseOpen(true);
                                          }}
                                          className="flex-1 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-[10px] font-bold py-1 rounded-lg transition text-center"
                                        >
                                          🛒 شراء بتفاصيل
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedHistoryItemName(i.name);
                                            setIsMaterialHistoryModalOpen(true);
                                          }}
                                          className="w-7 h-7 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 rounded-lg flex items-center justify-center shrink-0 transition"
                                          title="شوكت ومنين اشتريت هذه المادة؟"
                                        >
                                          <Search className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setTimelineModalItem(i)}
                                          className="w-7 h-7 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-lg flex items-center justify-center shrink-0 transition"
                                          title="عرض دورة النفاد"
                                        >
                                          <Clock className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
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
                        <p className="text-gray-500 font-bold">لا توجد مواد تطابق البحث</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {INVENTORY_CATEGORIES.map(cat => {
                          const catItems = filteredInventory.filter(item => {
                            const itemCat = item.category || "أخرى";
                            return itemCat === cat || (cat === "أخرى" && !INVENTORY_CATEGORIES.includes(itemCat));
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
                                      
                                      <div className="p-2.5 flex flex-col gap-2 flex-1 justify-between">
                                        <div>
                                          <p className="font-black text-gray-900 dark:text-white text-xs sm:text-sm leading-tight line-clamp-2 mb-1">{item.name}</p>
                                          <p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">المفرد: <span className="font-black">{item.price ? Number(item.price).toLocaleString() : '0'}</span> د.ع</p>
                                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black mt-0.5">الإجمالي: {item.price ? (Number(item.price) * Number(item.quantity)).toLocaleString() : '0'} د.ع</p>
                                          {Number(item.quantity) <= 0 ? (
                                            <span className="inline-flex mt-1 bg-red-100 text-red-600 text-[9px] px-1.5 py-0.5 rounded-md font-bold items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> نفدت</span>
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

                                        <div className="flex items-center gap-1 pt-1 mt-1 border-t border-gray-100 dark:border-zinc-800">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setManualPurchaseInitialItem(item);
                                              setIsManualCakePurchaseOpen(true);
                                            }}
                                            className="flex-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-[10px] py-1 rounded-lg transition text-center flex items-center justify-center gap-0.5"
                                          >
                                            <ShoppingCart className="w-3 h-3" />
                                            <span>شراء</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedHistoryItemName(item.name);
                                              setIsMaterialHistoryModalOpen(true);
                                            }}
                                            className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 flex items-center justify-center shrink-0 transition"
                                            title="شوكت ومنين اشتريت هذه المادة؟"
                                          >
                                            <Search className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setTimelineModalItem(item)}
                                            className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center shrink-0 transition"
                                            title="دورة النفاد والسجل"
                                          >
                                            <Clock className="w-3 h-3" />
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
                )}

                {/* ──────── SUB-TAB 2: SMART DEPLETION CYCLES (مربعات مرتبة) ──────── */}
                {inventorySubTab === "cycles" && (
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="ابحث باسم المادة لمعرفة موعد نفادها..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-bold"
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCycleFilterStatus("all")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                          cycleFilterStatus === "all"
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm"
                            : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-800"
                        }`}
                      >
                        الكل ({itemsWithConsumption.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCycleFilterStatus("critical")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                          cycleFilterStatus === "critical"
                            ? "bg-red-600 text-white shadow-sm"
                            : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40"
                        }`}
                      >
                        <span>🔴 عاجل ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === "critical").length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCycleFilterStatus("warning")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                          cycleFilterStatus === "warning"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40"
                        }`}
                      >
                        <span>🟡 أسبوع ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === "warning").length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCycleFilterStatus("safe")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 ${
                          cycleFilterStatus === "safe"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40"
                        }`}
                      >
                        <span>🟢 كافية ({itemsWithConsumption.filter(i => i.metrics.depletionStatus === "safe").length})</span>
                      </button>
                    </div>

                    {/* Square Cards Grid (2 columns on mobile!) */}
                    {filteredCyclesItems.length === 0 ? (
                      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800">
                        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-bold">لا توجد مواد مطابقة للفلتر</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredCyclesItems.map(({ item, metrics }) => (
                          <div
                            key={item.id}
                            className={`bg-white dark:bg-zinc-900 rounded-2xl border p-3 shadow-sm flex flex-col justify-between relative hover:shadow-md transition ${
                              metrics.depletionStatus === "critical"
                                ? "border-red-300 dark:border-red-900/60 bg-red-50/10"
                                : metrics.depletionStatus === "warning"
                                ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/10"
                                : "border-gray-100 dark:border-zinc-800"
                            }`}
                          >
                            <div>
                              {/* Category & Status pill */}
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[55%] ${CAT_COLORS[item.category] || "bg-gray-100 text-gray-600"}`}>
                                  {item.category}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                                    metrics.depletionStatus === "critical"
                                      ? "bg-red-500 text-white"
                                      : metrics.depletionStatus === "warning"
                                      ? "bg-amber-500 text-white"
                                      : "bg-emerald-500 text-white"
                                  }`}
                                >
                                  {metrics.depletionStatus === "critical" ? "🔴 عاجل" : metrics.depletionStatus === "warning" ? "🟡 قريب" : "🟢 كافية"}
                                </span>
                              </div>

                              {/* Item Name */}
                              <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight mb-2">
                                {item.name}
                              </h4>

                              {/* Metric Mini Pills */}
                              <div className="space-y-1 text-[10px] bg-gray-50 dark:bg-zinc-800/80 p-2 rounded-xl border border-gray-100 dark:border-zinc-700/50 mb-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500 font-bold">المخزون:</span>
                                  <span className="font-black text-gray-800 dark:text-gray-200">
                                    {item.quantity} {item.unit}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-500 font-bold">دورة النفاد:</span>
                                  <span className="font-black text-blue-600 dark:text-blue-400">
                                    {metrics.averageCycleDays ? `كل ~${metrics.averageCycleDays} يوم` : "تحت المراقبة"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pt-0.5 border-t border-gray-200/50 dark:border-zinc-700/50">
                                  <span className="text-gray-500 font-bold">متبقي:</span>
                                  <span className={`font-black ${metrics.estimatedDaysRemaining !== null && metrics.estimatedDaysRemaining <= 3 ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                                    {metrics.estimatedDaysRemaining !== null ? `~${metrics.estimatedDaysRemaining} يوم` : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 pt-1 mt-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setManualPurchaseInitialItem(item);
                                  setIsManualCakePurchaseOpen(true);
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 shadow-sm active:scale-95"
                              >
                                <ShoppingCart className="w-3 h-3" />
                                <span>شراء</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimelineModalItem(item)}
                                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 flex items-center justify-center shrink-0 transition"
                                title="سجل الشراء ومعدل النفاد"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ──────── SUB-TAB 3: PURCHASES & INVOICES LOG (مربعات مرتبة) ──────── */}
                {inventorySubTab === "purchases" && (
                  <div className="space-y-4">
                    {/* Search & Toggle Filters */}
                    <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="ابحث باسم المادة، المتجر، أو رقم الفاتورة..."
                          value={purchaseSearchQuery}
                          onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs font-bold rounded-xl py-2.5 pr-9 pl-3 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* View Mode Toggle: Invoices Grouped vs Individual Items */}
                      <div className="flex gap-1 bg-blue-50/80 dark:bg-zinc-800/80 p-1 rounded-xl border border-blue-100 dark:border-zinc-700/60">
                        <button
                          type="button"
                          onClick={() => setPurchaseViewMode("invoices")}
                          className={`flex-1 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                            purchaseViewMode === "invoices"
                              ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-100 shadow-sm"
                              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          }`}
                        >
                          <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>📑 فواتير مجمعة ({groupedInvoices.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPurchaseViewMode("items")}
                          className={`flex-1 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                            purchaseViewMode === "items"
                              ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-100 shadow-sm"
                              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>📦 كل المواد المفردة ({filteredPurchases.length})</span>
                        </button>
                      </div>

                      {/* Filter by Invoice Status */}
                      <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPurchaseInvoiceFilter("all")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition ${
                            purchaseInvoiceFilter === "all"
                              ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          الكل ({purchases.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPurchaseInvoiceFilter("invoiced")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition ${
                            purchaseInvoiceFilter === "invoiced"
                              ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          بفاتورة ({purchases.filter(p => p.hasInvoice).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPurchaseInvoiceFilter("non_invoiced")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition ${
                            purchaseInvoiceFilter === "non_invoiced"
                              ? "bg-white dark:bg-zinc-700 text-blue-900 dark:text-blue-200 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          بدون فاتورة ({purchases.filter(p => !p.hasInvoice).length})
                        </button>
                      </div>
                    </div>

                    {/* Content View: Invoices vs Items */}
                    {purchaseViewMode === "invoices" ? (
                      /* ── GROUPED INVOICES VIEW ── */
                      groupedInvoices.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 space-y-3">
                          <Receipt className="w-10 h-10 text-gray-300 mx-auto" />
                          <h4 className="font-black text-gray-700 dark:text-gray-300 text-sm">لا توجد فواتير مطابقة للبحث</h4>
                          <p className="text-xs text-gray-500">يمكنك تصوير فاتورة بالـ AI لتسجيل جميع موادها دفعة واحدة</p>
                          <div className="flex justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsScanCakeInvoiceOpen(true)}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              📸 تصوير فاتورة
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {groupedInvoices.map((inv) => (
                            <div
                              key={inv.id}
                              className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition p-4 flex flex-col justify-between space-y-3 relative"
                            >
                              {/* Header: Store Name, Invoice # & Delete */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                                    <Store className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-black text-sm text-gray-900 dark:text-white truncate">
                                      {inv.storeName}
                                    </h4>
                                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                      <Calendar className="w-3 h-3" /> {inv.date || "بدون تاريخ"}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {inv.invoiceNumber && (
                                    <span className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg text-xs font-mono font-black border border-slate-200 dark:border-zinc-700">
                                      #{inv.invoiceNumber}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingCakeInvoice(inv)}
                                    className="text-gray-400 hover:text-purple-600 p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-zinc-800 transition"
                                    title="تعديل الفاتورة ومصدر الصرف"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWholeInvoice(inv)}
                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-800 transition"
                                    title="حذف الفاتورة كاملة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Badges: Has Invoice & Payment Source */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                  inv.hasInvoice
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                }`}>
                                  {inv.hasInvoice ? "🧾 بفاتورة" : "🛒 شراء كاش"}
                                </span>

                                {inv.paymentSource === "none" ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-200">
                                    🚫 بدون تسجيل مصروف
                                  </span>
                                ) : inv.paymentSource === "salary" ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    💳 دين من الراتب
                                  </span>
                                ) : inv.paymentSource === "split" ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                                    🔀 مجزأ (دين: {Number(inv.splitDebtAmount || 0).toLocaleString()} د.ع)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    🎂 أموال الكيك
                                  </span>
                                )}

                                {inv.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewZoomImageUrl({ url: inv.imageUrl!, title: `وصل فاتورة: ${inv.storeName}` })}
                                    className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 transition flex items-center gap-1 active:scale-95"
                                  >
                                    <Camera className="w-3 h-3" /> صورة الوصل
                                  </button>
                                )}
                              </div>

                              {/* Summary Box */}
                              <div className="bg-gray-50 dark:bg-zinc-800/70 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] text-gray-400 font-bold mb-0.5">إجمالي الفاتورة</p>
                                  <p className="font-black text-base text-rose-600 dark:text-rose-400">
                                    {inv.totalAmount.toLocaleString()} <span className="text-xs font-normal">د.ع</span>
                                  </p>
                                </div>
                                <div className="text-left">
                                  <p className="text-[10px] text-gray-400 font-bold mb-0.5">عدد المواد</p>
                                  <p className="font-black text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded-md border border-gray-200 dark:border-zinc-600">
                                    {inv.items.length} مواد
                                  </p>
                                </div>
                              </div>

                              {/* Action: Open Invoice Details Modal (Matching Home Finance) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingInvoice(inv);
                                  setInvoiceItemFilter("");
                                }}
                                className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center justify-between border border-indigo-100 dark:border-indigo-800/40 transition active:scale-[0.98]"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Receipt className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>تفاصيل القائمة ({inv.items.length} مواد)</span>
                                </span>
                                <ChevronLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              </button>

                              {/* Accordion Toggle */}
                              <button
                                type="button"
                                onClick={() => toggleExpandInvoice(inv.id)}
                                className="w-full text-center text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center gap-1 pt-0.5"
                              >
                                <span>{expandedInvoiceIds[inv.id] ? "إخفاء المعاينة السريعة" : "معاينة المواد في البطاقة"}</span>
                                {expandedInvoiceIds[inv.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {/* Inline preview if expanded */}
                              {expandedInvoiceIds[inv.id] && (
                                <div className="bg-gray-50/80 dark:bg-zinc-800/80 rounded-xl p-2.5 space-y-1.5 border border-gray-100 dark:border-zinc-700 max-h-40 overflow-y-auto custom-scrollbar">
                                  {inv.items.map((it, idx) => (
                                    <div key={it.id || idx} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 dark:border-zinc-700/50 last:border-0">
                                      <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[60%]">
                                        {idx + 1}. {it.itemName} ({it.quantity} {it.unit})
                                      </span>
                                      <span className="font-black text-rose-600 dark:text-rose-400 text-[11px]">
                                        {Number(it.totalPrice || 0).toLocaleString()} د.ع
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      /* ── INDIVIDUAL ITEMS VIEW (Square grid) ── */
                      filteredPurchases.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-zinc-800 space-y-3">
                          <Receipt className="w-10 h-10 text-gray-300 mx-auto" />
                          <h4 className="font-black text-gray-700 dark:text-gray-300 text-sm">لا توجد مشتريات مسجلة بعد</h4>
                          <p className="text-xs text-gray-500">يمكنك تصوير فاتورة بالـ AI أو تسجيل شراء مباشر لحساب تواريخ الاستهلاك</p>
                          <div className="flex justify-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsScanCakeInvoiceOpen(true)}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              📸 تصوير فاتورة
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setManualPurchaseInitialItem(null);
                                setIsManualCakePurchaseOpen(true);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition"
                            >
                              🛒 تسجيل شراء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {filteredPurchases.map(p => (
                            <div
                              key={p.id}
                              className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-3 flex flex-col justify-between relative hover:shadow-md transition"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[60%] ${CAT_COLORS[p.category] || "bg-gray-100 text-gray-600"}`}>
                                    {p.category || "أخرى"}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${p.hasInvoice ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
                                    {p.hasInvoice ? "🧾 بفاتورة" : "🛒 كاش"}
                                  </span>
                                </div>

                                <h4 className="font-black text-xs sm:text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight mb-2">
                                  {p.itemName}
                                </h4>

                                <div className="bg-gray-50 dark:bg-zinc-800/80 p-2 rounded-xl text-[10px] space-y-1 mb-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-bold">الكمية:</span>
                                    <span className="font-black text-gray-800 dark:text-gray-200">{p.quantity} {p.unit}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-bold">المبلغ:</span>
                                    <span className="font-black text-purple-700 dark:text-purple-300">{Number(p.totalPrice || 0).toLocaleString()} د.ع</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-0.5 border-t border-gray-200/50 dark:border-zinc-700/50 text-[9px] text-gray-500">
                                    <span>📅 {p.purchaseDate}</span>
                                    {p.storeName && <span className="truncate max-w-[45%]">🏪 {p.storeName}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-1 pt-1 mt-auto border-t border-gray-100 dark:border-zinc-800">
                                {p.invoiceImageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => window.open(p.invoiceImageUrl, "_blank")}
                                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 py-1 px-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-zinc-800 transition"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>الوصل</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-gray-400">بدون وصل</span>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => handleDeletePurchase(p.id!)}
                                  className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-zinc-800 transition"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
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

                {/* ── Monthly Sales Overview ── */}
                <div className="bg-gradient-to-br from-purple-900 to-fuchsia-900 rounded-3xl p-6 shadow-xl border border-purple-500/20">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-purple-400" /> المبيعات الشهرية (خلال 30 يوم)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                      <span className="text-purple-200 text-xs font-bold mb-1">مبيعات التطبيق والمخزن</span>
                      <span className="text-white text-xl font-black">{(stats.monthSales || 0).toLocaleString()} د.ع</span>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex flex-col justify-center">
                      <span className="text-purple-200 text-xs font-bold mb-1">مبيعات السوشيال ميديا</span>
                      <span className="text-white text-xl font-black">{(stats.monthExtSales || 0).toLocaleString()} د.ع</span>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-purple-400/30 flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <span className="text-purple-200 text-xs font-bold mb-1">إجمالي المبيعات الشهرية</span>
                      <span className="text-white text-2xl font-black">{((stats.monthSales || 0) + (stats.monthExtSales || 0)).toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>

                {/* ── Net Balance Overview ── */}
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-500/20">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4"><Banknote className="w-5 h-5 text-indigo-400" /> صافي الأموال المتوفرة (بعد المصاريف)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/20 p-4 rounded-2xl border border-emerald-500/20 flex flex-col justify-center">
                      <span className="text-gray-300 text-xs font-bold mb-1">إجمالي المُستلم من كافة الأقسام</span>
                      <span className="text-emerald-400 text-xl font-black">{(auditData.social.totalReceived + auditData.appCakes.totalReceived + auditData.supplies.totalReceived).toLocaleString()} د.ع</span>
                    </div>
                    <div className="bg-black/20 p-4 rounded-2xl border border-rose-500/20 flex flex-col justify-center">
                      <span className="text-gray-300 text-xs font-bold mb-1">إجمالي المصروفات</span>
                      <span className="text-rose-400 text-xl font-black">{(stats.expenses || 0).toLocaleString()} د.ع</span>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-indigo-400/30 flex flex-col justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                      <span className="text-indigo-200 text-xs font-bold mb-1">الرصيد الصافي الفعلي بالصندوق</span>
                      <span className="text-white text-2xl font-black">{(auditData.social.totalReceived + auditData.appCakes.totalReceived + auditData.supplies.totalReceived - (stats.expenses || 0)).toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>

                {/* ── Inventory Overview ── */}
                <div className="bg-gradient-to-br from-slate-900 to-zinc-900 rounded-3xl p-6 shadow-xl border border-zinc-500/20">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4"><Package className="w-5 h-5 text-gray-400" /> مطابقة المخزن</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl col-span-2">
                      <span className="text-gray-300 text-sm font-bold">قيمة البضاعة في المخزن:</span>
                      <span className="text-gray-300 font-black">{stats.inventoryValue.toLocaleString()} د.ع</span>
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

              {settleOrderType === "external" && (
                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <label className="block text-sm font-bold mb-2 text-indigo-600">أين سيذهب المبلغ؟</label>
                  <select 
                    value={settleDestination}
                    onChange={(e) => setSettleDestination(e.target.value as any)}
                    className="w-full bg-white dark:bg-zinc-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none font-bold"
                  >
                    <option value="cake_funds">🎂 أموال الكيك (الطبيعي)</option>
                    <option value="salary_debt">💼 تسديد ديون الراتب</option>
                  </select>
                </div>
              )}

              {settleDestination === "salary_debt" && settleOrderType === "external" && (
                <div className="animate-fade-in-up">
                  <label className="block text-sm font-bold mb-2 text-indigo-600">المبلغ المسدد لديون الراتب (د.ع)</label>
                  <input 
                    type="number" 
                    required 
                    value={settleSalaryAmount}
                    onChange={(e) => setSettleSalaryAmount(e.target.value)}
                    placeholder="أدخل المبلغ المستقطع لديون الراتب..."
                    className="w-full bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none font-black text-lg text-indigo-900 dark:text-indigo-100"
                  />
                  <p className="text-[10px] font-bold text-gray-500 mt-2">
                    المبلغ المكتوب سيُخصم من دين الكيك ويسجل كوارد لإدارة المنزل تلقائياً.
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

      {cancelOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-red-600">إلغاء الطلب</h3>
              <button type="button" onClick={() => setCancelOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={submitCancellation} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">سبب الرفض / الإلغاء</label>
                <textarea 
                  required 
                  value={cancelReason} 
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-red-500 focus:outline-none font-bold min-h-[100px] resize-none"
                  placeholder="اكتب سبب الرفض هنا..." 
                />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl flex justify-center items-center gap-2 transition mt-6 shadow-md shadow-red-500/20">
                تأكيد الإلغاء
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

      {/* ─── INVOICE DETAILS MODAL SHEET (matching Home Finance) ─── */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] px-5 sm:px-7 pt-5 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800 max-h-[92svh] overflow-y-auto mb-[75px] sm:mb-0 custom-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🧾</span>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                    فاتورة: {viewingInvoice.storeName}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                  {viewingInvoice.invoiceNumber && (
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono font-bold">
                      #{viewingInvoice.invoiceNumber}
                    </span>
                  )}
                  <span>•</span>
                  <span>{viewingInvoice.date || "بدون تاريخ"}</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400 font-black">
                    {Number(viewingInvoice.totalAmount || 0).toLocaleString()} د.ع
                  </span>
                  <span>•</span>
                  <span>{(viewingInvoice.items || []).length} مواد</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setViewingInvoice(null)} 
                className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Attached receipt photo preview if exists */}
            {viewingInvoice.imageUrl && (
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-800/80 rounded-2xl border border-blue-100 dark:border-zinc-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={viewingInvoice.imageUrl} 
                    alt="صورة الوصل" 
                    className="w-12 h-12 object-cover rounded-xl border border-blue-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:opacity-90 transition"
                    onClick={() => setPreviewZoomImageUrl({ url: viewingInvoice.imageUrl, title: `وصل: ${viewingInvoice.storeName}` })}
                  />
                  <div>
                    <p className="text-xs font-black text-gray-900 dark:text-white flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>صورة الوصل / الفاتورة مرفقة</span>
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">انقر على الصورة للمعاينة والتكبير بالحجم الكامل</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewZoomImageUrl({ url: viewingInvoice.imageUrl, title: `وصل: ${viewingInvoice.storeName}` })}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 shrink-0"
                >
                  تكبير الصورة 🔍
                </button>
              </div>
            )}

            {/* Search inside invoice items */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="ابحث في مواد الفاتورة (مثال: طحين، فستق، كريمة...)"
                value={invoiceItemFilter}
                onChange={e => setInvoiceItemFilter(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 pr-10 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              {invoiceItemFilter && (
                <button type="button" onClick={() => setInvoiceItemFilter("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Items Table */}
            <div className="bg-gray-50 dark:bg-zinc-900/60 rounded-2xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-gray-100/70 dark:bg-zinc-800/60 text-[11px] font-black text-gray-500 border-b border-gray-200 dark:border-zinc-800 text-right">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4">اسم المادة</div>
                <div className="col-span-3 text-center">الكمية والوحدة</div>
                <div className="col-span-2 text-center">سعر المفرد</div>
                <div className="col-span-2 text-left">الإجمالي (د.ع)</div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-zinc-800/80 max-h-[350px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const filtered = (viewingInvoice.items || []).filter((item: any) => 
                    !invoiceItemFilter || (item.itemName || "").toLowerCase().includes(invoiceItemFilter.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs font-bold text-gray-400">
                        {invoiceItemFilter ? "لا توجد مواد مطابقة للبحث" : "لا توجد مواد في هذه القائمة"}
                      </div>
                    );
                  }

                  return filtered.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-white dark:hover:bg-zinc-800/50 transition">
                      <div className="col-span-1 text-center font-bold text-gray-400 text-[11px]">{idx + 1}</div>
                      <div className="col-span-4 font-bold text-gray-800 dark:text-gray-200 truncate">{item.itemName}</div>
                      <div className="col-span-3 text-center font-black text-gray-600 dark:text-gray-300 bg-gray-200/60 dark:bg-zinc-800 px-1 py-0.5 rounded-md text-[11px]">
                        {item.quantity} {item.unit || ""}
                      </div>
                      <div className="col-span-2 text-center text-gray-500 font-bold text-[11px]">
                        {Number(item.unitPrice || 0).toLocaleString()}
                      </div>
                      <div className="col-span-2 text-left font-black text-rose-600 dark:text-rose-400">
                        {Number(item.totalPrice || 0).toLocaleString()}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Total Footer */}
              <div className="bg-gray-100/90 dark:bg-zinc-800 px-4 py-3 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-center text-xs">
                <span className="font-bold text-gray-600 dark:text-gray-300">
                  إجمالي الفاتورة: {(viewingInvoice.items || []).length} مادة
                </span>
                <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                  {Number(viewingInvoice.totalAmount || 0).toLocaleString()} د.ع
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => {
                  const lines = (viewingInvoice.items || []).map((it: any, i: number) => `${i + 1}. ${it.itemName} (${it.quantity} ${it.unit || ''}) - ${Number(it.totalPrice || 0).toLocaleString()} د.ع`);
                  const text = `🧾 فاتورة: ${viewingInvoice.storeName}\n${viewingInvoice.invoiceNumber ? `رقم الفاتورة: #${viewingInvoice.invoiceNumber}\n` : ''}📅 التاريخ: ${viewingInvoice.date}\n💰 الإجمالي: ${Number(viewingInvoice.totalAmount || 0).toLocaleString()} د.ع\n\nالمواد:\n${lines.join("\n")}`;
                  navigator.clipboard.writeText(text);
                  toast.success("تم نسخ قائمة الفاتورة إلى الحافظة 📋");
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-4 h-4" /> نسخ القائمة
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = viewingInvoice;
                  setViewingInvoice(null);
                  setEditingCakeInvoice(target);
                }}
                className="bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Edit className="w-4 h-4" /> تعديل الفاتورة
              </button>

              <button
                type="button"
                onClick={async () => {
                  const target = viewingInvoice;
                  setViewingInvoice(null);
                  await handleDeleteWholeInvoice(target);
                }}
                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className="w-4 h-4" /> حذف الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cake Invoice Modal */}
      {editingCakeInvoice && (
        <EditCakeInvoiceModal
          isOpen={!!editingCakeInvoice}
          onClose={() => setEditingCakeInvoice(null)}
          invoice={editingCakeInvoice}
          onSuccess={() => {
            setEditingCakeInvoice(null);
          }}
        />
      )}

      {/* Cake Cost Breakdown Viewer & Editor Modal */}
      {viewingCostOrder && (
        <CakeCostBreakdownModal
          isOpen={!!viewingCostOrder}
          onClose={() => setViewingCostOrder(null)}
          cakeName={viewingCostOrder.cakeName || "كيكة"}
          initialSellingPrice={Number(viewingCostOrder.price) || 0}
          initialBreakdown={viewingCostOrder.costBreakdown}
          onApplyCost={async (totalCost, breakdown) => {
            try {
              const numCost = totalCost;
              const numPrice = Number(viewingCostOrder.price) || 0;
              const profit = numCost > 0 ? numPrice - numCost : numPrice;
              await updateDoc(doc(db, "external_orders", viewingCostOrder.id), {
                cost: numCost,
                costBreakdown: JSON.parse(JSON.stringify(breakdown)),
                profit
              });
              setExternalOrders(prev => prev.map(o => o.id === viewingCostOrder.id ? {
                ...o,
                cost: numCost,
                costBreakdown: breakdown,
                profit
              } : o));
              toast.success("تم تحديث تكلفة الكيكة والمقادير بنجاح ✔");
            } catch (err) {
              toast.error("فشل تحديث التكلفة");
            }
            setViewingCostOrder(null);
          }}
        />
      )}

      {/* Receipt Photo Fullscreen Lightbox Modal */}
      {previewZoomImageUrl && (
        <div 
          className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setPreviewZoomImageUrl(null)}
        >
          <div 
            className="relative max-w-3xl w-full max-h-[92vh] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/90 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-sm truncate">{previewZoomImageUrl.title || "معاينة صورة الفاتورة"}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a 
                  href={previewZoomImageUrl.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-xl text-zinc-200 font-bold transition flex items-center gap-1"
                >
                  فتح بالحجم الكامل ↗
                </a>
                <button 
                  type="button" 
                  onClick={() => setPreviewZoomImageUrl(null)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-300 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-black/50 min-h-[250px]">
              <img 
                src={previewZoomImageUrl.url} 
                alt={previewZoomImageUrl.title} 
                className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

