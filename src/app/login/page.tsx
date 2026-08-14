"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Loader2, Mail, Lock, User as UserIcon } from "lucide-react";

export default function LoginPage() {
  const { user, loginWithEmail, signupWithEmail, loading } = useAuth();
  const router = useRouter();

  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push("/profile");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!firstName || !lastName) throw new Error("يرجى إدخال الاسم الأول والأخير");
        if (!gender) throw new Error("يرجى تحديد الجنس");
        if (!dob) throw new Error("يرجى تحديد المواليد");
        await signupWithEmail({ email, pass: password, firstName, lastName, gender, dob });
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      const code = err.code;
      let friendlyMessage = "حدث خطأ أثناء العملية. يرجى المحاولة لاحقاً.";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        friendlyMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (code === "auth/email-already-in-use") {
        friendlyMessage = "هذا البريد الإلكتروني مسجل لدينا مسبقاً.";
      } else if (code === "auth/weak-password") {
        friendlyMessage = "كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.";
      } else if (code === "auth/network-request-failed") {
        friendlyMessage = "مشكلة في الاتصال بالإنترنت. يرجى التحقق من الشبكة.";
      }
      setError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      {/* Top Bar */}
      <header className="px-5 py-4 pt-4">
        <Link href="/" className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-zinc-900 rounded-full active:scale-95 transition">
          <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </Link>
      </header>

      <div className="flex-1 flex flex-col px-6 pt-4 max-w-sm mx-auto w-full pb-12">
        {/* Logo & Welcome */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-24 h-24 rounded-3xl bg-pink-50 dark:bg-zinc-900 flex items-center justify-center mb-6 shadow-sm border border-pink-100 dark:border-zinc-800">
            <Image src="/icon.png" alt="كيك الأميرة" width={70} height={70} className="object-contain" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
            {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            {isLogin ? "أهلاً بك مجدداً" : "انضم إلينا واستمتع بأفضل الكيكات"}
          </p>
        </div>

          <div className="w-full flex-1 flex flex-col">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-right">
              {!isLogin && (
                <>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="الاسم الأول"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 pr-12 pl-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none"
                      />
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="الاسم الثاني"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <select
                      required
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none text-gray-700 dark:text-gray-300"
                    >
                      <option value="" disabled>الجنس</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                    
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none text-gray-700 dark:text-gray-300"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 pr-12 pl-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  placeholder="كلمة المرور (6 أحرف على الأقل)"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 pr-12 pl-4 text-sm focus:ring-2 focus:ring-pink-500 transition-all outline-none text-left"
                  dir="ltr"
                />
              </div>

              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] mt-2 flex justify-center items-center disabled:opacity-70 text-base"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "دخول →" : "إنشاء الحساب →")}
              </button>
            </form>

            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-sm text-gray-500 font-bold hover:text-pink-500 py-3 w-full transition mt-2"
            >
              {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب بالفعل؟ تسجيل الدخول"}
            </button>

            <button
              onClick={() => { setIsEmailMode(false); setError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 py-2 w-full transition underline underline-offset-4"
            >
              الرجوع للخيارات الأخرى
            </button>
          </div>
      </div>
    </div>
  );
}
