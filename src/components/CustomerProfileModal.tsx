"use client";
import { X, ShoppingBag, Receipt, MapPin, Phone, Package, Calendar, User } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone?: string;
}

export default function CustomerProfileModal({ isOpen, onClose, customerName, customerPhone }: CustomerProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [appOrders, setAppOrders] = useState<any[]>([]);
  const [socialOrders, setSocialOrders] = useState<any[]>([]);
  const [customerProfile, setCustomerProfile] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !customerName) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Fetch customer profile details
        const custQ = query(collection(db, "customers"), where("name", "==", customerName));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
          setCustomerProfile(custSnap.docs[0].data());
        }

        // Fetch social orders
        const socialQ = query(
          collection(db, "external_orders"),
          where("customerName", "==", customerName)
        );
        const socialSnap = await getDocs(socialQ);
        const fetchedSocial = socialSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'social' }));

        // Fetch app orders (can be by shippingAddress.name or shippingAddress.phone)
        const appOrdersList: any[] = [];
        
        // Query by name if available
        const appQName = query(collection(db, "orders"), where("shippingAddress.name", "==", customerName));
        const appSnapName = await getDocs(appQName);
        appSnapName.docs.forEach(d => {
           appOrdersList.push({ id: d.id, ...d.data(), source: 'app' });
        });

        // If phone is provided, fetch by phone and merge
        if (customerPhone) {
          const appQPhone = query(collection(db, "orders"), where("shippingAddress.phone", "==", customerPhone));
          const appSnapPhone = await getDocs(appQPhone);
          appSnapPhone.docs.forEach(d => {
             if (!appOrdersList.find(o => o.id === d.id)) {
                appOrdersList.push({ id: d.id, ...d.data(), source: 'app' });
             }
          });
        }

        // Sort by date
        const sortByDate = (a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
        };

        setSocialOrders(fetchedSocial.sort(sortByDate));
        setAppOrders(appOrdersList.sort(sortByDate));

      } catch (error) {
        console.error("Error fetching customer history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, customerName, customerPhone]);

  if (!isOpen) return null;

  const totalAppSpent = appOrders.reduce((acc, order) => acc + Number(order.total || 0), 0);
  const totalSocialSpent = socialOrders.reduce((acc, order) => acc + Number(order.price || 0), 0);
  
  // Calculate debts
  let appDebt = 0;
  appOrders.forEach(o => {
    if (o.isDebt) appDebt += Number(o.debtAmount || 0);
  });

  let socialDebt = 0;
  let weOweSocial = 0;
  socialOrders.forEach(o => {
    if (o.status === "delivered" && !o.isDebtSettled) {
       const price = Number(o.price || 0);
       const paid = Number(o.paidAmount ?? price);
       const diff = price - paid;
       if (diff > 0) socialDebt += diff;
       else if (diff < 0) weOweSocial += Math.abs(diff);
    }
  });

  const totalDebt = appDebt + socialDebt;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full sm:w-[600px] max-h-[90vh] bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-gray-200 dark:border-zinc-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-l from-gray-50 to-white dark:from-zinc-900/50 dark:to-zinc-950">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-[#FF3366]/10 text-[#FF3366] flex items-center justify-center text-2xl">👤</span>
              {customerName}
              {customerProfile?.platform && (
                <span className="text-xs bg-[#FF3366]/10 text-[#FF3366] px-3 py-1 rounded-full font-bold ml-2">
                  {customerProfile.platform}
                </span>
              )}
            </h2>
            <div className="mt-2 space-y-1">
              {(customerPhone || customerProfile?.phone) && (
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1" dir="ltr">
                  <Phone className="w-3.5 h-3.5" /> {customerPhone || customerProfile?.phone}
                </p>
              )}
              {customerProfile?.address && (
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {customerProfile.address}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition active:scale-90">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#FF3366]" />
              <p className="text-gray-500 font-bold">جاري تحميل سجل الطلبات...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">إجمالي المشتريات</p>
                  <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300">
                    {(totalAppSpent + totalSocialSpent).toLocaleString()} د.ع
                  </p>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-1 font-bold">
                    {appOrders.length + socialOrders.length} طلبات
                  </p>
                </div>
                
                <div className={`p-4 rounded-2xl border ${totalDebt > 0 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30' : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-100 dark:border-zinc-800'}`}>
                  <p className={`text-xs font-bold mb-1 ${totalDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    الديون السابقة (نطلبه)
                  </p>
                  <p className={`text-lg sm:text-xl font-black ${totalDebt > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {totalDebt.toLocaleString()} د.ع
                  </p>
                  {weOweSocial > 0 && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-bold">
                      أمانات يطلبنا: {weOweSocial.toLocaleString()} د.ع
                    </p>
                  )}
                </div>
              </div>

              {/* Social Orders List */}
              {socialOrders.length > 0 && (
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="text-[#FF3366]">📱</span>
                    طلبات السوشيال ميديا
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">{socialOrders.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {socialOrders.map(order => (
                      <div key={order.id} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{order.cakeName}</p>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                            {Number(order.price || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-bold">
                           <span className="flex items-center gap-1">
                             <Calendar className="w-3.5 h-3.5" />
                             {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-IQ') : new Date(order.createdAt || 0).toLocaleDateString('ar-IQ')}
                           </span>
                           <span className="flex items-center gap-1">
                             <Package className="w-3.5 h-3.5" />
                             {order.status === 'delivered' ? 'مكتمل' : 'قيد المعالجة'}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* App Orders List */}
              {appOrders.length > 0 && (
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="text-blue-500">🛒</span>
                    طلبات التطبيق
                    <span className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">{appOrders.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {appOrders.map(order => (
                      <div key={order.id} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">طلب #{order.id.slice(0,6)}</span>
                             <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                               {order.items?.map((i:any) => i.name).join('، ')}
                             </p>
                          </div>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg shrink-0">
                            {Number(order.total || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 font-bold mt-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                           <span className="flex items-center gap-1">
                             <Calendar className="w-3.5 h-3.5" />
                             {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('ar-IQ') : new Date(order.createdAt || 0).toLocaleDateString('ar-IQ')}
                           </span>
                           <span className="flex items-center gap-1">
                             <Package className="w-3.5 h-3.5" />
                             {order.status === 'delivered' ? 'مكتمل' : 'قيد المعالجة'}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appOrders.length === 0 && socialOrders.length === 0 && (
                <div className="py-12 text-center text-gray-500 font-bold">
                  لا توجد طلبات سابقة لهذا الزبون.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
