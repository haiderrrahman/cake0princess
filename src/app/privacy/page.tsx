"use client";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Lock, Eye, FileText } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-transparent dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95">
          <ChevronRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">شروط الاستخدام والخصوصية</h1>
      </header>

      <div className="px-5 mt-6">
        <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-10 h-10" />
        </div>
        
        <h2 className="text-center font-black text-lg mb-2">حماية بياناتك أولويتنا</h2>
        <p className="text-center text-sm text-gray-500 mb-8 leading-relaxed">
          نحن في كيك الأميرة نلتزم بأعلى معايير الأمان لحماية معلوماتك الشخصية وبيانات الدفع الخاصة بك.
        </p>

        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">تشفير البيانات</h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              جميع معلوماتك الشخصية وبيانات الدفع مشفرة بتقنية SSL من طرف إلى طرف، ولا يتم مشاركتها مع أي جهة خارجية.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-xl">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">صلاحيات الوصول</h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              فريق العمل لا يمتلك صلاحية الوصول إلى كلمات المرور الخاصة بك أو معلوماتك البنكية بأي شكل من الأشكال.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm">سياسة الاستخدام</h3>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              باستخدامك لتطبيق كيك الأميرة، أنت توافق على الشروط والأحكام الخاصة بالاستخدام وخدمات التوصيل المحددة في بغداد.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
