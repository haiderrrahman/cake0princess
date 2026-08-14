"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Bell, Gift, BookOpen, AlertCircle, ShoppingBag, Loader2 } from "lucide-react";
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchNotifications = async () => {
      try {
        const targetUserId = isAdmin ? "admin" : user.uid;
        const q = query(
          collection(db, "notifications"), 
          where("userId", "==", targetUserId),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        setNotifications(data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        
        // Fallback for missing index
        try {
          const targetUserId = isAdmin ? "admin" : user.uid;
          const q = query(
            collection(db, "notifications"), 
            where("userId", "==", targetUserId)
          );
          const snapshot = await getDocs(q);
          const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
          data.sort((a, b) => new Date(b.createdAt?.toDate?.() || 0).getTime() - new Date(a.createdAt?.toDate?.() || 0).getTime());
          setNotifications(data);
        } catch (e) {
           console.error("Fallback failed:", e);
        }
      }
      setLoading(false);
    };

    fetchNotifications();
  }, [user, isAdmin, authLoading, router]);

  const markAsRead = async (id: string, read: boolean, link?: string) => {
    if (!read) {
      try {
        await updateDoc(doc(db, "notifications", id), { read: true });
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      } catch (error) {
        console.error("Error updating notification:", error);
      }
    }
    if (link) {
      router.push(link);
    }
  };

  const getIcon = (type?: string) => {
    switch(type) {
      case "order": return <ShoppingBag className="w-6 h-6" />;
      case "course": return <BookOpen className="w-6 h-6" />;
      case "offer": return <Gift className="w-6 h-6" />;
      default: return <Bell className="w-6 h-6" />;
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
        <h1 className="text-xl font-black">الإشعارات</h1>
      </header>

      <div className="px-5 mt-4">
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => markAsRead(notif.id, notif.read, notif.link)}
                  className={`flex gap-4 p-4 rounded-3xl border transition cursor-pointer active:scale-[0.98] ${notif.read ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800' : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${notif.read ? 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400' : 'bg-blue-100 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-sm mb-1 ${!notif.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                      {notif.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{notif.message}</p>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {notif.createdAt?.toDate ? new Date(notif.createdAt.toDate()).toLocaleDateString('ar-IQ', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit'
                      }) : 'الآن'}
                    </span>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  )}
                </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-500">لا توجد إشعارات جديدة</h3>
          </div>
        )}
      </div>
    </div>
  );
}
