"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronRight, Save, User as UserIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function EditProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
      return;
    }
    if (user) {
      setEmail(user.email || "");
      const fetchUserData = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFirstName(data.firstName || "");
            setLastName(data.lastName || "");
            setGender(data.gender || "");
            setDob(data.dob || "");
          }
        } catch (e) {
          console.error("Error fetching user data:", e);
        }
        setFetching(false);
      };
      fetchUserData();
    }
  }, [user, loading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        firstName,
        lastName,
        gender,
        dob,
        name: `${firstName} ${lastName}`.trim() || user.displayName
      });
      toast.success("تم تحديث معلومات الحساب بنجاح", {
        style: {
          background: '#10B981',
          color: '#fff',
          borderRadius: '16px',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      router.push("/profile");
    } catch (e) {
      console.error("Error updating profile:", e);
      toast.error("فشل في تحديث المعلومات");
    }
    setIsSaving(false);
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col pb-24">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95">
            <ChevronRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black">تعديل الملف الشخصي</h1>
        </div>
      </header>

      <div className="px-5 mt-6 max-w-md w-full mx-auto">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-gray-100 dark:bg-zinc-800 border-none rounded-xl py-3 px-4 text-sm text-gray-400 cursor-not-allowed outline-none text-left"
                dir="ltr"
              />
              <p className="text-[10px] text-gray-400 mt-1">لا يمكن تغيير البريد الإلكتروني حالياً.</p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">الاسم الأول</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">الاسم الثاني</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">الجنس</label>
                <select
                  required
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition"
                >
                  <option value="" disabled>اختر</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">تاريخ الميلاد</label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-pink-500 outline-none transition text-left"
                  dir="ltr"
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-[20px] py-4 font-black flex items-center justify-center gap-2 shadow-lg shadow-pink-500/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            حفظ التعديلات
          </button>
        </form>
      </div>
    </div>
  );
}
