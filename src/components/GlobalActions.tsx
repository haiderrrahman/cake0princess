"use client";
import { ShoppingCart, Bell, Sun, Moon, X, BookOpen, Gift, CheckCircle2, ShoppingBag, LayoutDashboard, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useCart } from "@/context/CartContext";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function GlobalActions() {
  const { items } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);

  const cartItemCount = items.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const targetUserId = isAdmin ? "admin" : user.uid;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", targetUserId)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: any[] = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
      setNotifications(data.slice(0, 20));
    }, () => {});
    return () => unsubscribe();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!mounted) return;
    const newUnread = notifications.filter(n => !n.read && !notifiedIds.includes(n.id));
    if (newUnread.length > 0) {
      newUnread.forEach(n => {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-in slide-in-from-top-5' : 'animate-out slide-out-to-top-5 fade-out'} max-w-sm w-full bg-white dark:bg-zinc-900 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 overflow-hidden cursor-pointer`}
               onClick={() => { 
                 toast.dismiss(t.id); 
                 if (n.link) {
                   router.push(n.link);
                 } else {
                   setIsOpen(true); 
                 }
               }}>
            <div className="flex-1 w-0 p-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#e8456b]/10 text-[#e8456b]`}>
                  {n.imageUrl ? <img src={n.imageUrl} alt="" className="w-full h-full object-cover rounded-full" /> : <Bell className="w-5 h-5" />}
                </div>
                <div className="ml-3 flex-1 text-right mt-1">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">إشعار جديد</p>
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{n.title}</p>
                </div>
              </div>
            </div>
            <div className="flex border-r border-gray-100 dark:border-zinc-800">
              <button onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }} className="w-full p-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ), { duration: 4000, position: 'top-center' });
      });
      setNotifiedIds(prev => [...prev, ...newUnread.map(n => n.id)]);
    }
  }, [notifications, mounted, notifiedIds]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      } catch (e) {}
    }
  };

  const toggleNotifications = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && unreadCount > 0) {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        try {
          await updateDoc(doc(db, "notifications", n.id), { read: true });
        } catch (e) {}
      }
    }
  };

  const getIcon = (type?: string) => {
    switch(type) {
      case "order": return <ShoppingBag className="w-5 h-5" />;
      case "course": return <BookOpen className="w-5 h-5" />;
      case "offer": return <Gift className="w-5 h-5" />;
      case "duty": return <CheckCircle2 className="w-5 h-5 text-indigo-500" />;
      case "need": return <ShoppingCart className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-IQ', { hour: '2-digit', minute:'2-digit' });
  };

    const hideOnPaths = ["/login", "/checkout"];
  if (hideOnPaths.includes(pathname || "")) return null;

  const handleHardRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (e) {}
    window.location.href = window.location.pathname + '?refresh=' + Date.now();
  };

  return (
    <>
      {/* Top Left Actions */}
      <div className="fixed top-2 left-2 z-[60] flex flex-row items-center gap-1 p-1 rounded-full
        bg-white/90 dark:bg-[#150f2a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 shadow-md">

        {/* ── Cart ── */}
        <Link href="/cart"
          className="group relative flex flex-col items-center gap-0.5 active:scale-90 transition-transform px-1.5">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#FF3366]/15 to-[#E040FB]/15 flex items-center justify-center group-hover:from-[#FF3366]/25 group-hover:to-[#E040FB]/25 transition-all">
            <ShoppingCart className="w-[15px] h-[15px] text-[#FF3366]" />
            {cartItemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 bg-gradient-to-br from-[#FF3366] to-[#E040FB] rounded-full text-[7px] text-white font-bold flex items-center justify-center shadow-sm">
                {cartItemCount > 9 ? "9+" : cartItemCount}
              </span>
            )}
          </div>
        </Link>

        {/* ── Notifications ── */}
        <button onClick={toggleNotifications}
          className="group relative flex flex-col items-center gap-0.5 active:scale-90 transition-transform px-1.5">
          <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${unreadCount > 0 ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 shadow-[0_0_15px_rgba(239,68,68,0.4)] ring-2 ring-red-500/50 group-hover:from-red-500/30 group-hover:to-orange-500/30' : 'bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/30 group-hover:from-blue-500/25 group-hover:to-indigo-500/25'}`}>
            <Bell className={`w-[15px] h-[15px] ${unreadCount > 0 ? 'text-red-500 animate-pulse' : 'text-blue-600 dark:text-blue-400'}`} />
            {unreadCount > 0 && (
              <>
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center shadow-md animate-bounce z-10">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75"></span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Top Right Actions */}
      <div className="fixed top-2 right-2 z-[60] flex flex-row items-center gap-1 p-1 rounded-full
        bg-white/90 dark:bg-[#150f2a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 shadow-md">
        
        {/* ── Refresh Toggle ── */}
        <button
          onClick={handleHardRefresh}
          className="group flex flex-col items-center gap-0.5 active:scale-90 transition-transform px-1.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF3366]/15 to-[#F5C842]/15 flex items-center justify-center group-hover:from-[#FF3366]/25 group-hover:to-[#F5C842]/25 transition-all">
            <RefreshCw className="w-[15px] h-[15px] text-[#FF3366] active:animate-spin" />
          </div>
        </button>

        {/* ── Theme Toggle ── */}
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="group flex flex-col items-center gap-0.5 active:scale-90 transition-transform px-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E040FB]/15 to-[#9c27b0]/15 flex items-center justify-center group-hover:from-[#E040FB]/25 group-hover:to-[#9c27b0]/25 transition-all">
              {resolvedTheme === "dark"
                ? <Sun className="w-[15px] h-[15px] text-[#F5C842]" />
                : <Moon className="w-[15px] h-[15px] text-[#E040FB]" />}
            </div>
          </button>
        )}

        {/* ── Admin Dashboard ── */}
        {isAdmin && (
          <Link href="/admin"
            className="group flex flex-col items-center gap-0.5 active:scale-90 transition-transform px-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center group-hover:from-emerald-500/25 group-hover:to-teal-500/25 transition-all">
              <LayoutDashboard className="w-[15px] h-[15px] text-emerald-500" />
            </div>
          </Link>
        )}
      </div>

      {/* ── Notifications Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in" onClick={() => setIsOpen(false)}>
          <div 
            className="w-full sm:w-[400px] h-[85vh] sm:h-[600px] bg-white dark:bg-zinc-950 rounded-t-3xl sm:rounded-3xl flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 shadow-2xl border border-gray-100 dark:border-zinc-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-zinc-800">
              <div>
                <h3 className="font-black text-lg text-gray-900 dark:text-white">الإشعارات</h3>
                <p className="text-xs text-gray-500 mt-0.5">آخر التحديثات والتنبيهات</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-bold text-[#e8456b] bg-[#e8456b]/10 px-2.5 py-1 rounded-full active:scale-95 transition"
                  >
                    قراءة الكل ✓
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full active:scale-90 transition">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">لا توجد إشعارات جديدة</p>
                  <p className="text-xs text-gray-500 mt-1">أنت على اطلاع بكل جديد!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((n) => (
                    <button 
                      key={n.id}
                      onClick={() => { setIsOpen(false); if(n.link) router.push(n.link); }}
                      className={`w-full flex items-start gap-3 p-3 rounded-2xl border ${!n.read ? 'border-[#e8456b]/20 bg-[#e8456b]/5' : 'border-transparent hover:bg-gray-50 dark:hover:bg-zinc-800/50'} transition text-right`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${!n.read ? 'bg-[#e8456b]/10 text-[#e8456b]' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'}`}>
                        {n.imageUrl ? (
                          <img src={n.imageUrl} alt="Cake" className="w-full h-full object-cover" />
                        ) : getIcon(n.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <h4 className={`text-sm font-bold ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{n.title}</h4>
                          <span className="text-[10px] text-gray-400">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className={`text-xs ${!n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'} leading-relaxed`}>{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-[#e8456b] rounded-full mt-2 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
