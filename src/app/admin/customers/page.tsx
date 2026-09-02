"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ArrowRight, Search, User, Star, MapPin, Phone, Crown, DollarSign, Calendar, Loader2, Edit3, Image as ImageIcon, Check, Shield, ShieldAlert, Trash2 } from "lucide-react";
import { customConfirm } from "@/lib/customConfirm";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";
import CustomerProfileModal from "@/components/CustomerProfileModal";

export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [customers, setCustomers] = useState<any[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] = useState<{name: string, phone?: string} | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const compressed = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: false });
        setEditPhoto(compressed);
        const reader = new FileReader();
        reader.readAsDataURL(compressed);
        reader.onload = () => setTempPhotoUrl(reader.result as string);
      } catch (err) {
        console.error("Compression failed", err);
        setEditPhoto(file);
      }
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const [usersSnap, ordersSnap, extOrdersSnap, socialSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "external_orders")),
          getDocs(collection(db, "social_customers"))
        ]);

        const allUsers = usersSnap.docs.map(d => {
          const data = d.data() as any;
          const isAdminEmail = data.email && ["ontheway.princess@gmail.com", "haider.rahman@gmail.com", "haiderr.rahman@gmail.com", "test.user.12345@gmail.com"].includes(data.email);
          return { 
            id: d.id, 
            ...data, 
            displayName: data.displayName || data.name || "مجهول",
            role: isAdminEmail ? "admin" : (data.role || "user"),
            source: "app", 
            totalSpent: 0, 
            orderCount: 0 
          };
        });
        const orders = ordersSnap.docs.map(d => d.data());
        const extOrders = extOrdersSnap.docs.map(d => d.data());
        const socialProfiles = socialSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

        // Map app orders to users
        orders.forEach((o: any) => {
          if (o.status === "completed" || o.status === "delivered") {
            const userIndex = allUsers.findIndex(u => u.id === o.userId);
            if (userIndex !== -1) {
              allUsers[userIndex].totalSpent += Number(o.total || 0);
              allUsers[userIndex].orderCount += 1;
            }
          }
        });

        // Map external orders to pseudo-users based on phone number or name
        const extCustomersMap = new Map();
        extOrders.forEach((o: any) => {
          if (o.status !== "rejected" && o.status !== "cancelled") {
            const key = o.phone || o.customerName || "مجهول";
            const profile = socialProfiles.find(p => p.id === key);
            
            if (!extCustomersMap.has(key)) {
              extCustomersMap.set(key, {
                id: key,
                displayName: profile?.displayName || o.customerName || "زبون سوشيال",
                photoURL: profile?.photoURL || "",
                phone: key,
                address: o.address || "",
                source: "social",
                totalSpent: 0,
                orderCount: 0,
                rank: "غير مسجل",
                points: 0,
              });
            }
            const cust = extCustomersMap.get(key);
            cust.totalSpent += Number(o.price || 0);
            cust.orderCount += 1;
          }
        });

        const allCustomers = [...allUsers, ...Array.from(extCustomersMap.values())].sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return b.totalSpent - a.totalSpent;
        });
        setCustomers(allCustomers);
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
      setLoading(false);
    };

    fetchCustomers();
  }, [isAdmin, editingCustomer]);

  const handleToggleRole = async (userId: string, currentRole: string) => {
    if (!(await customConfirm(`هل أنت متأكد من تغيير صلاحية هذا المستخدم؟`))) return;
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setCustomers(customers.map(c => c.id === userId ? { ...c, role: newRole } : c));
      toast.success("تم التحديث بنجاح!");
    } catch (error) {
      toast.error("حدث خطأ");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!(await customConfirm("هل أنت متأكد من حذف هذا الحساب نهائياً؟"))) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      setCustomers(customers.filter(c => c.id !== userId));
      toast.success("تم الحذف بنجاح!");
    } catch (error) {
      toast.error("حدث خطأ في الحذف");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    try {
      let finalPhotoUrl = editingCustomer.photoURL;

      // Optimistically save the temp photo
      await setDoc(doc(db, "social_customers", editingCustomer.id), {
        displayName: editName,
        photoURL: tempPhotoUrl || finalPhotoUrl, // Fallback to temp if offline
        phone: editingCustomer.phone || editingCustomer.id,
      }, { merge: true });

      if (editPhoto && navigator.onLine) {
        toast.success("جاري رفع الصورة...", { duration: 2000 });
        const fileRef = ref(storage, `social_customers/${editingCustomer.id}_${Date.now()}`);
        await uploadBytes(fileRef, editPhoto);
        finalPhotoUrl = await getDownloadURL(fileRef);
        
        await setDoc(doc(db, "social_customers", editingCustomer.id), {
          photoURL: finalPhotoUrl,
        }, { merge: true });
      }

      toast.success(navigator.onLine ? "تم تحديث بيانات الزبون بنجاح" : "تم التحديث محلياً (أوفلاين)");
      setEditingCustomer(null);
      setTempPhotoUrl(null);
    } catch (err) {
      console.error(err);
      toast.error("فشل في حفظ التعديلات");
    }
    setIsSaving(false);
  };

  if (!isAdmin) return <div className="p-8 text-center text-red-500 font-bold">غير مصرح لك</div>;

  const filtered = customers.filter(c => {
    const matchesSearch = (c.displayName || "").includes(searchTerm) || (c.phone || "").includes(searchTerm);
    if (!matchesSearch) return false;
    
    if (filter === "admins") return c.source === "app" && c.role === "admin";
    if (filter === "members") return c.source === "app" && c.role !== "admin";
    if (filter === "customers") return c.source !== "app";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f0f4f8] dark:bg-zinc-950 pb-28">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-[#1a0533] via-[#2d1060] to-[#0f3460] pt-20 pb-6 px-5 overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/15 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/25 transition">
              <ArrowRight className="w-5 h-5 text-white" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white">إدارة الزبائن والمستخدمين 👥</h1>
              <p className="text-xs text-purple-200">زبائن التطبيق والسوشيال ميديا والمشرفين</p>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 mt-2">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
          <input 
            type="text" 
            placeholder="ابحث بالاسم أو رقم الهاتف..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-purple-300 rounded-xl pr-10 pl-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-md transition-all"
          />
        </div>

        <div className="relative z-10 flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-white text-purple-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>الكل</button>
          <button onClick={() => setFilter('admins')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === 'admins' ? 'bg-white text-purple-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>المدراء</button>
          <button onClick={() => setFilter('members')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === 'members' ? 'bg-white text-purple-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>الأعضاء</button>
          <button onClick={() => setFilter('customers')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${filter === 'customers' ? 'bg-white text-purple-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>الزبائن</button>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#e8456b]" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((customer, idx) => (
              <div key={customer.id || idx} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group hover:shadow-md transition">
                <div className="flex gap-4">
                  <div className="relative">
                    {customer.photoURL ? (
                      <img src={customer.photoURL} alt={customer.displayName} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-sm ${customer.source === 'app' ? 'bg-gradient-to-br from-pink-400 to-[#e8456b]' : 'bg-gradient-to-br from-emerald-400 to-teal-500'}`}>
                        {customer.displayName ? customer.displayName[0] : "ز"}
                      </div>
                    )}
                    <span className={`absolute -bottom-2 -left-2 text-[8px] font-black px-1.5 py-0.5 rounded-md text-white shadow-sm ${customer.source === 'app' ? 'bg-[#e8456b]' : 'bg-emerald-500'}`}>
                      {customer.source === 'app' ? 'تطبيق' : 'سوشيال'}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <button onClick={() => setCustomerProfile({ name: customer.displayName || customer.id, phone: customer.phone })} className="font-black text-gray-900 dark:text-white truncate hover:text-[#e8456b] transition">
                        {customer.displayName || "مجهول"}
                      </button>
                      <div className="flex items-center gap-1">
                        {customer.source === "app" && (
                          <>
                            {customer.rank && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${customer.rankColor || 'bg-gray-100 text-gray-600'}`}>
                                {customer.rank}
                              </span>
                            )}
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${customer.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                              {customer.role === "admin" ? "مدير" : "عضو"}
                            </span>
                            <button 
                              onClick={() => handleToggleRole(customer.id, customer.role || "user")}
                              className={`p-1.5 rounded-md ${customer.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-500'} hover:opacity-80 transition`}
                              title="تغيير الصلاحية"
                            >
                              {customer.role === "admin" ? <Shield className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                            </button>
                            <button 
                              onClick={() => handleDelete(customer.id)}
                              className="p-1.5 rounded-md bg-red-50 text-red-500 hover:opacity-80 transition"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        {customer.source === "social" && (
                          <button onClick={() => {
                            setEditingCustomer(customer);
                            setEditName(customer.displayName);
                            setEditPhoto(null);
                            setTempPhotoUrl(null);
                          }} className="w-6 h-6 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-500 hover:text-[#e8456b] transition">
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 mt-2">
                      {customer.phone && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 font-bold truncate">
                          <Phone className="w-3 h-3 text-blue-500" /> {customer.phone}
                        </span>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-1">
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-2 py-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-500" />
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{(customer.totalSpent / 1000).toFixed(1)}K د.ع</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-2 py-1 flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          <span className="text-[10px] font-black text-gray-600 dark:text-gray-300">{customer.orderCount} طلب</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filtered.length === 0 && (
              <div className="col-span-full py-10 text-center">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-bold">لا يوجد زبائن مطابقين للبحث</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal for Social Customers */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-5">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[32px] p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 text-center">تعديل ملف الزبون</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاسم</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#e8456b] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">صورة الزبون</label>
                <div className="flex items-center gap-3">
                  {tempPhotoUrl || editPhoto ? (
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 overflow-hidden">
                       {tempPhotoUrl ? <img src={tempPhotoUrl} className="w-full h-full object-cover" /> : <Check className="w-6 h-6" />}
                    </div>
                  ) : editingCustomer.photoURL ? (
                    <img src={editingCustomer.photoURL} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <label className="flex-1 bg-pink-50 dark:bg-pink-900/20 text-[#e8456b] rounded-xl py-3 text-center text-xs font-bold cursor-pointer border border-pink-100 dark:border-pink-900/30">
                    اختيار صورة جديدة
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                  </label>
                </div>
              </div>

              <button 
                disabled={isSaving || !editName.trim()}
                onClick={handleSaveEdit}
                className="w-full mt-4 bg-gradient-to-r from-pink-500 to-[#e8456b] hover:to-rose-600 text-white rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ التعديلات"}
              </button>
              
              <button 
                onClick={() => setEditingCustomer(null)}
                className="w-full mt-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-xl py-3 font-bold text-sm"
              >
                إلغاء
              </button>
            </div>
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
