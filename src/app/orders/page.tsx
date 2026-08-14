"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingBag, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [customOrders, setCustomOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"store" | "custom">("store");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchOrders = async () => {
        // Fetch store orders
        try {
          const q = query(
            collection(db, "orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setOrders(data);
        } catch (error) {
          console.error("Error fetching orders:", error);
          const q = query(collection(db, "orders"), where("userId", "==", user.uid));
          const snapshot = await getDocs(q);
          const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
          setOrders(data);
        }

        // Fetch custom design orders
        try {
          const q2 = query(
            collection(db, "custom_orders"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc")
          );
          const snapshot2 = await getDocs(q2);
          const data2 = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCustomOrders(data2);
        } catch (error) {
          console.error("Error fetching custom orders:", error);
          const q2 = query(collection(db, "custom_orders"), where("userId", "==", user.uid));
          const snapshot2 = await getDocs(q2);
          const data2: any[] = snapshot2.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          data2.sort((a, b) => new Date(b.createdAt?.toDate?.() || new Date(b.createdAt)).getTime() - new Date(a.createdAt?.toDate?.() || new Date(a.createdAt)).getTime());
          setCustomOrders(data2);
        }
      setLoading(false);
    };

    fetchOrders();
  }, [user, authLoading, router]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "processing": return { color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20", icon: Clock, label: "جاري التحضير" };
      case "pending": return { color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20", icon: Clock, label: "قيد المراجعة" };
      case "accepted": return { color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", icon: CheckCircle2, label: "تم القبول" };
      case "completed": return { color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20", icon: CheckCircle2, label: "مكتمل" };
      case "delivering": return { color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", icon: Clock, label: "قيد التوصيل" };
      case "delivered": return { color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", icon: CheckCircle2, label: "تم التوصيل" };
      case "cancelled":
      case "rejected": return { color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/20", icon: XCircle, label: "تم الرفض" };
      default: return { color: "text-gray-500", bg: "bg-gray-50 dark:bg-zinc-800", icon: Clock, label: "قيد الانتظار" };
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-transparent dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95 text-gray-800 dark:text-gray-200">
          <ChevronRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">طلباتي</h1>
      </header>

      {/* Tabs */}
      <div className="px-5 mt-4">
        <div className="flex bg-gray-100 dark:bg-zinc-900 p-1 rounded-2xl w-full">
          <button 
            onClick={() => setActiveTab("store")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === "store" ? "bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            طلبات المتجر
          </button>
          <button 
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === "custom" ? "bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            التصاميم الخاصة
          </button>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-4">
        {activeTab === "store" ? (
          orders.length > 0 ? (
            orders.map(order => {
              const style = getStatusStyle(order.status);
              const Icon = style.icon;
              
              const dateStr = order.createdAt?.toDate 
                ? new Date(order.createdAt.toDate()).toLocaleDateString('ar-IQ', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })
                : "تاريخ غير متوفر";
                
              const itemNames = order.items?.map((i: any) => i.name).join("، ") || "طلب غير معروف";
              
              return (
                <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-sm mb-1">الطلب #{order.id.slice(0,6).toUpperCase()}</h3>
                      <p className="text-[11px] text-gray-500">{dateStr}</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1 ${style.bg} ${style.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">{style.label}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-100 dark:border-zinc-800 pt-4 mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      {itemNames}
                    </p>
                  </div>
                  
                  {/* Payment Details */}
                  <div className="bg-gray-50 dark:bg-zinc-950 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">الإجمالي</span>
                      <span className="font-black text-[#e8456b]">{(order.total || 0).toLocaleString()} د.ع</span>
                    </div>
                    {order.paymentMethod && (
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-400">وسيلة الدفع</span>
                        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          {order.paymentMethod === "cash" ? "💵 نقداً" :
                           order.paymentMethod === "zaincash" ? "📱 زين كاش" :
                           order.paymentMethod === "fib" ? "🏦 FIB" :
                           order.paymentMethod === "card" ? "💳 بطاقة" : order.paymentMethod}
                        </span>
                      </div>
                    )}
                    {order.toPayNow !== undefined && order.toPayNow < (order.total || 0) && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-400">المدفوع مقدماً</span>
                          <span className="text-[11px] font-bold text-green-600">{(order.toPayNow || 0).toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-400">المتبقي عند الاستلام</span>
                          <span className="text-[11px] font-bold text-orange-500">{((order.total || 0) - (order.toPayNow || 0)).toLocaleString()} د.ع</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-500 mb-4">لا توجد طلبات سابقة</h3>
              <Link href="/shop" className="bg-[#e8456b] text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#e8456b]/20">
                تصفح المتجر
              </Link>
            </div>
          )
        ) : (
          customOrders.length > 0 ? (
            customOrders.map(order => {
              const style = getStatusStyle(order.status);
              const Icon = style.icon;
              
              const dateStr = order.createdAt?.toDate 
                ? new Date(order.createdAt.toDate()).toLocaleDateString('ar-IQ', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })
                : new Date(order.createdAt).toLocaleDateString('ar-IQ', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  });
              
              return (
                <div key={order.id} className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative flex-shrink-0">
                    {order.imageUrl && <img src={order.imageUrl} alt="Custom" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-sm mb-0.5">تصميم خاص</h3>
                        <p className="text-[10px] text-gray-500">{dateStr}</p>
                      </div>
                      <div className={`px-2 py-1 rounded border flex items-center gap-1 ${style.bg} ${style.color}`}>
                        <span className="text-[10px] font-bold">{style.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      الحجم: {order.size} • العجين: {order.dough}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-bold text-gray-500 mb-4">لا توجد طلبات تصميم خاص</h3>
              <Link href="/custom-design" className="bg-[#e8456b] text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#e8456b]/20">
                اطلب تصميمك الآن
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}
