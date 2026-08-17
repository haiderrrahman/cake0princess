"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Loader2, CheckCircle, Clock, MapPin, Search } from "lucide-react";
import { collection, query, orderBy, getDocs, updateDoc, doc, addDoc } from "firebase/firestore";
import { customConfirm } from "@/lib/customConfirm";
import { db } from "@/lib/firebase";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [settleOrder, setSettleOrder] = useState<any | null>(null);
  const [settleDebtType, setSettleDebtType] = useState<"none" | "customer_owes" | "we_owe">("none");
  const [settleRemainingAmount, setSettleRemainingAmount] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
        
        try {
          const snapshot = await getDocs(collection(db, "orders"));
          const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
          setOrders(data);
        } catch (e) {
          console.error("Fallback failed:", e);
        }
      }
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const updateOrderStatus = async (id: string, newStatus: string) => {
    if (newStatus === "delivered" || newStatus === "completed") {
      const order = orders.find(o => o.id === id);
      if (order) {
        setSettleOrder(order);
        setSettleDebtType("none");
        setSettleRemainingAmount("");
      }
      return;
    }
    try {
      setUpdatingOrder(id);
      await updateDoc(doc(db, "orders", id), { status: newStatus });
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleOrder) return;
    
    const basePrice = Number(settleOrder.toPayNow || settleOrder.total || 0);
    let finalPaidAmount = basePrice;
    const remAmt = Number(settleRemainingAmount) || 0;
    
    if (settleDebtType === "customer_owes") {
      finalPaidAmount = basePrice - remAmt;
    } else if (settleDebtType === "we_owe") {
      finalPaidAmount = basePrice + remAmt;
    }
    
    try {
      setUpdatingOrder(settleOrder.id);
      await updateDoc(doc(db, "orders", settleOrder.id), { 
        status: "delivered", 
        paidAmount: finalPaidAmount,
        isDebtSettled: finalPaidAmount === basePrice
      });
      setOrders(orders.map(o => o.id === settleOrder.id ? { ...o, status: "delivered", paidAmount: finalPaidAmount, isDebtSettled: finalPaidAmount === basePrice } : o));
      setSettleOrder(null);
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleSettleDebt = async (order: any, diffAmt: number, customerOwesUs: boolean) => {
    if (!(await customConfirm("هل تم تسديد هذا المبلغ بالكامل؟"))) return;
    try {
      setUpdatingOrder(order.id);
      const basePrice = Number(order.toPayNow || order.total || 0);
      await updateDoc(doc(db, "orders", order.id), { 
        paidAmount: basePrice,
        isDebtSettled: true 
      });
      
      if (customerOwesUs) {
        await addDoc(collection(db, "store_sales"), {
          itemName: "تسديد دين تطبيق - " + (order.userName || ""),
          price: diffAmt,
          profit: 0,
          createdAt: new Date()
        });
      } else {
        await addDoc(collection(db, "expenses"), {
          description: "تسديد أمانة لتطبيق - " + (order.userName || ""),
          amount: diffAmt,
          date: new Date().toISOString()
        });
      }
      
      setOrders(orders.map(o => o.id === order.id ? { ...o, paidAmount: basePrice, isDebtSettled: true } : o));
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.phone?.includes(searchQuery) ||
      o.id.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* ═══════════════ LUXURY HEADER BANNER ═══════════════ */}
      <div className="bg-gradient-to-l from-pink-900 via-rose-900 to-purple-950 pt-16 pb-8 px-5 rounded-b-[40px] shadow-lg relative overflow-hidden mb-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 hover:bg-white/20 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white mb-1">الطلبات العامة (التطبيق)</h1>
              <p className="text-xs text-rose-200 font-bold">متابعة وإدارة طلبات المتجر والتوصيل</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto relative z-10">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input 
                type="text" 
                placeholder="بحث بالاسم أو الرقم..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-sm text-white placeholder-white/50 rounded-xl py-3 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-rose-400 backdrop-blur-md transition"
              />
            </div>
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
            const amt = Number(o.totalPrice) || 0;
            const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
            d.setHours(0,0,0,0);
            
            if (d.getTime() === today.getTime()) todaySales += amt;
            if (d >= weekAgo) weekSales += amt;
            if (d >= thirtyDaysAgo) monthSales += amt;
          });

          return (
            <div className="grid grid-cols-3 gap-2.5 mt-6 relative z-10">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات اليوم</p>
                <p className="text-sm md:text-xl font-black text-white">{todaySales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات الأسبوع</p>
                <p className="text-sm md:text-xl font-black text-white">{weekSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 md:p-4 text-center flex flex-col justify-center">
                <p className="text-[10px] md:text-xs font-bold text-rose-200 mb-1">مبيعات الشهر</p>
                <p className="text-sm md:text-xl font-black text-white">{monthSales.toLocaleString()} <span className="text-[9px] md:text-[10px] font-normal">د.ع</span></p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Visible Filter Grid (No Horizontal Scroll / Swipe) */}
      <div className="px-5 mb-6">
        <div className="flex flex-wrap gap-2 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
          {[
            { key: "all", label: "الكل 📋" },
            { key: "pending", label: "⏳ بانتظار الدفع" },
            { key: "processing", label: "🔧 قيد التجهيز" },
            { key: "delivering", label: "🚗 قيد التوصيل" },
            { key: "completed", label: "✅ مكتمل" },
          ].map((f: any) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 ${statusFilter === f.key ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20" : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="px-5">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">لا توجد طلبات</h2>
          <p className="text-gray-500 text-sm">لم يتم العثور على أي طلبات تطابق بحثك حالياً.</p>
        </div>
        </div>
      ) : (
        <div className="px-5">
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const amount = order.toPayNow || order.total || 0;
              const isDebt = (order.status === "delivered" || order.status === "completed") && order.paidAmount !== undefined && Number(order.paidAmount) !== Number(amount) && !order.isDebtSettled;
              const customerOwesUs = isDebt && Number(amount) > Number(order.paidAmount || 0);
              const weOweCustomer = isDebt && Number(amount) < Number(order.paidAmount || 0);
              const fullyPaidDelivered = (order.status === "delivered" || order.status === "completed") && !isDebt;
              const diffAmt = isDebt ? Math.abs(Number(amount) - Number(order.paidAmount || 0)) : 0;

              return (
            <div key={order.id} className={`rounded-[24px] p-4 sm:p-5 border-2 shadow-sm flex flex-col lg:flex-row gap-5 relative group hover:shadow-md transition-all ${
              customerOwesUs ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-400 dark:border-rose-800' : 
              weOweCustomer ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-400 dark:border-blue-800' : 
              fullyPaidDelivered ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-400 dark:border-purple-800' :
              'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
            }`}>
              
              {/* Order Info & Items */}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-2">
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-lg">{order.userName || "ضيف"}</h3>
                    <p className="text-xs font-bold text-gray-500 mt-0.5">{order.phone || "لا يوجد رقم"}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center w-fit gap-1.5 ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    order.status === 'processing' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    order.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    order.status === 'delivering' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    order.status === 'delivered' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    order.status === 'pending_verification' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                    'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'
                  }`}>
                    {order.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                    {order.status === 'processing' && <Clock className="w-3.5 h-3.5" />}
                    {order.status === 'completed' ? 'مكتمل' : 
                     order.status === 'processing' ? 'قيد التجهيز' : 
                     order.status === 'rejected' ? 'تم الرفض' : 
                     order.status === 'delivering' ? 'قيد التوصيل' : 
                     order.status === 'delivered' ? 'تم التوصيل' : 
                     order.status === 'pending_verification' ? 'بانتظار تأكيد الدفع' : 'بانتظار الدفع'}
                  </span>
                </div>
                
                <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-3 mb-4">
                  <div className="space-y-2">
                    {order.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2 font-bold">
                          <span className="w-6 h-6 bg-white dark:bg-zinc-700 rounded-md flex items-center justify-center text-[10px] text-gray-500 shadow-sm">{item.quantity || 1}x</span>
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{item.name}</span>
                        </span>
                        <span className="text-gray-500 text-xs font-bold">{(item.price * (item.quantity || 1)).toLocaleString()} د.ع</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
                    <span className="text-gray-500 text-xs font-bold">الإجمالي الكلي:</span>
                    <span className="font-black text-[#e8456b] text-base">{Number(order.total).toLocaleString()} د.ع</span>
                  </div>
                </div>

                {order.paymentMethod === 'manual_transfer' && order.transferReceipt && (
                  <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-500 block mb-1">تأكيد تحويل زين كاش:</span>
                      <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 select-all font-mono">{order.transferReceipt}</span>
                    </div>
                    {order.status === 'pending_verification' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, "processing")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 whitespace-nowrap"
                      >
                        تأكيد استلام الدفعة
                      </button>
                    )}
                  </div>
                )}

                {order.address && (
                  <div className="flex gap-2 items-start text-xs text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="leading-relaxed font-bold">{order.deliveryZone} - {order.address}</p>
                      {order.location && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${order.location.lat},${order.location.lng}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-100 transition"
                        >
                          <MapPin className="w-3 h-3" />
                          عرض على خرائط جوجل
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Actions Sidebar */}
              <div className="lg:w-48 flex flex-col gap-2 shrink-0 border-t lg:border-t-0 lg:border-r border-gray-100 dark:border-zinc-800 pt-4 lg:pt-0 lg:pr-5">
                <p className="text-[10px] font-bold text-gray-400 mb-1 hidden lg:block">تغيير حالة الطلب</p>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  <button 
                    onClick={() => updateOrderStatus(order.id, "processing")}
                    disabled={order.status === "processing"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "processing" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    قيد التجهيز
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "delivering")}
                    disabled={order.status === "delivering"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "delivering" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                    قيد التوصيل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "delivered")}
                    disabled={order.status === "delivered"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "delivered" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
                  >
                    تم التوصيل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "completed")}
                    disabled={order.status === "completed"}
                    className={`py-2 rounded-xl text-xs font-bold transition ${order.status === "completed" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    مكتمل
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(order.id, "rejected")}
                    disabled={order.status === "rejected"}
                    className={`py-2 col-span-2 lg:col-span-1 rounded-xl text-xs font-bold transition mt-2 ${order.status === "rejected" ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    إلغاء ورفض الطلب
                  </button>
                </div>
                {isDebt && (
                  <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                    <div className={`flex justify-between items-center text-sm font-black px-3 py-2 rounded-xl ${customerOwesUs ? 'bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      <span>{customerOwesUs ? '🔴 الباقي نطلبه:' : '🔵 أمانة يطلبنا:'}</span>
                      <span>{diffAmt.toLocaleString()} د.ع</span>
                    </div>
                    <button 
                      onClick={() => handleSettleDebt(order, diffAmt, customerOwesUs)}
                      disabled={updatingOrder === order.id}
                      className={`w-full text-center text-sm font-black py-2.5 rounded-xl transition-all ${customerOwesUs ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                    >
                      تأكيد التسديد
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          </div>
        </div>
      )}
      {settleOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl p-6 overflow-hidden animate-slide-up-scale relative border border-gray-100 dark:border-zinc-800">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#e8456b]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#e8456b]/10 dark:bg-[#e8456b]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-[#e8456b]" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">تأكيد تسليم الطلب</h2>
              <p className="text-sm text-gray-500 mt-1">يرجى تأكيد تفاصيل الدفع</p>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-4 mb-5 border border-gray-100 dark:border-zinc-800">
              <p className="text-xs text-gray-500 mb-1">المبلغ الكلي للطلب</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {Number(settleOrder.toPayNow || settleOrder.total || 0).toLocaleString()} <span className="text-xs text-gray-500 font-normal">د.ع</span>
              </p>
            </div>

            <form onSubmit={submitSettlement} className="space-y-4 relative z-10">
              <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-xl">
                <button type="button" onClick={() => { setSettleDebtType("none"); setSettleRemainingAmount(""); }}
                  className={`py-2 rounded-lg text-xs font-bold transition ${settleDebtType === "none" ? "bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                  دفع كامل
                </button>
                <button type="button" onClick={() => setSettleDebtType("customer_owes")}
                  className={`py-2 rounded-lg text-xs font-bold transition ${settleDebtType === "customer_owes" ? "bg-rose-50 dark:bg-rose-900/30 text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                  باقي يمنا دين
                </button>
                <button type="button" onClick={() => setSettleDebtType("we_owe")}
                  className={`py-2 rounded-lg text-xs font-bold transition ${settleDebtType === "we_owe" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                  باقي يمه أمانة
                </button>
              </div>

              {settleDebtType !== "none" && (
                <div className="animate-fade-in">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    {settleDebtType === "customer_owes" ? "المبلغ المتبقي ديون علينا (د.ع):" : "المبلغ المتبقي أمانة لدينا (د.ع):"}
                  </label>
                  <input 
                    required 
                    type="number" 
                    value={settleRemainingAmount} 
                    onChange={e => setSettleRemainingAmount(e.target.value)}
                    className={`w-full bg-white dark:bg-zinc-800 border ${settleDebtType === "customer_owes" ? "border-rose-200 dark:border-rose-900/50 focus:border-rose-500" : "border-blue-200 dark:border-blue-900/50 focus:border-blue-500"} rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none transition shadow-sm`}
                    placeholder="مثال: 5000"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSettleOrder(null)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition">
                  إلغاء
                </button>
                <button type="submit" disabled={updatingOrder === settleOrder.id}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-pink-500/20 disabled:opacity-50">
                  تأكيد الحفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
