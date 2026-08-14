"use client";
import { Bell, ShoppingBag, BookOpen, Gift, CheckCircle2, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function NotificationBadge() {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const targetUserId = isAdmin ? "admin" : user.uid;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", targetUserId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
      setNotifications(data.slice(0, 10)); // keep only latest 10 for dropdown
    }, (error) => {
      console.error("Error fetching notifications for badge:", error);
    });

    return () => unsubscribe();
  }, [user, isAdmin]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (n: any) => {
    setIsOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const toggleDropdown = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    
    // Mark all as read when opened
    if (nextState && unreadCount > 0) {
      const unreadNotifications = notifications.filter(n => !n.read);
      for (const n of unreadNotifications) {
        try {
          await updateDoc(doc(db, "notifications", n.id), { read: true });
        } catch (error) {
          console.error("Error updating notification:", error);
        }
      }
    }
  };

  const getIcon = (type?: string) => {
    switch(type) {
      case "order": return <ShoppingBag className="w-5 h-5" />;
      case "course": return <BookOpen className="w-5 h-5" />;
      case "offer": return <Gift className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-IQ', { hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className="relative p-2.5 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 active:scale-95 transition"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#e8456b] rounded-full text-[10px] text-white font-bold flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-[320px] sm:w-[380px] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-zinc-800">
            <h3 className="font-black">الإشعارات</h3>
            {unreadCount > 0 && <span className="text-xs font-bold text-[#e8456b] bg-[#e8456b]/10 px-2 py-1 rounded-lg">{unreadCount} جديد</span>}
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">لا توجد إشعارات جديدة</p>
                <p className="text-xs text-gray-500 mt-1">أنت على اطلاع بكل جديد!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => (
                  <button 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 p-4 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition text-right w-full ${!n.read ? 'bg-[#e8456b]/5' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!n.read ? 'bg-[#e8456b]/10 text-[#e8456b]' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'}`}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`text-sm font-bold ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{n.title}</h4>
                      </div>
                      <p className={`text-xs ${!n.read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500'} line-clamp-2 leading-relaxed`}>{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-2">{formatTime(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-[#e8456b] rounded-full mt-2 flex-shrink-0"></div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <Link href="/notifications" onClick={() => setIsOpen(false)} className="block w-full p-3 text-center text-xs font-bold text-[#e8456b] hover:bg-gray-50 dark:hover:bg-zinc-800 transition border-t border-gray-50 dark:border-zinc-800">
              عرض كل الإشعارات
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
