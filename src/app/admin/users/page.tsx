"use client";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowRight, Search, User, Shield, ShieldAlert, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { customConfirm } from "@/lib/customConfirm";
import toast from "react-hot-toast";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function AdminUsers() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUsers(items);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoading(false);
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!(await customConfirm(`هل أنت متأكد من تغيير صلاحية هذا المستخدم؟`))) return;
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("تم التحديث بنجاح!");
    } catch (error) {
      toast.error("حدث خطأ");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا الحساب نهائياً؟"))) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(u => u.id !== userId));
      toast.success("تم الحذف بنجاح!");
    } catch (error) {
      toast.error("حدث خطأ");
    }
  };

  const filtered = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-24 animate-slide-up">
      <div className="px-5 pt-6 pb-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center shadow-sm hover:bg-pink-50 transition">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white">المستخدمين</h1>
              <p className="text-xs text-gray-500">إدارة حسابات التطبيق والصلاحيات</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="بحث بالاسم أو الإيميل..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-[#FF3366]/30 focus:border-[#FF3366] transition-all outline-none shadow-sm"
          />
        </div>
      </div>

      <div className="px-5 mt-2">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#FF3366]" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-zinc-800">
            <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">لا يوجد مستخدمين</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(user => (
              <div key={user.id} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${user.role === 'admin' ? 'bg-[#FF3366]/10 text-[#FF3366]' : 'bg-blue-50 text-blue-500'}`}>
                    {user.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{user.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    <span className={`inline-flex mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold items-center gap-1 ${user.role === 'admin' ? 'bg-[#FF3366]/10 text-[#FF3366]' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800'}`}>
                      {user.role === 'admin' ? <><ShieldAlert className="w-3 h-3" /> مدير</> : <><Shield className="w-3 h-3" /> مستخدم</>}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button onClick={() => handleToggleRole(user.id, user.role || 'user')} className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 rounded-xl text-gray-700 dark:text-gray-300 transition" title="تغيير الصلاحية">
                    <Shield className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-500 rounded-xl transition" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
