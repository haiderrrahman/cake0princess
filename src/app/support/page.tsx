"use client";
import Link from "next/link";
import { ChevronRight, MessageCircle, Mail, MapPin, ExternalLink, Instagram, Youtube } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SupportPage() {
  const { user } = useAuth();
  const WHATSAPP_NUMBER = "9647000000000";
  const WHATSAPP_MESSAGE = "مرحباً كيك الأميرة، أحتاج مساعدة بخصوص طلبي 🎂";
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className="flex flex-col min-h-screen bg-transparent dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95">
          <ChevronRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">المساعدة والدعم</h1>
      </header>

      <div className="px-5 mt-6">
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          نحن هنا لمساعدتك! اختر الطريقة التي تناسبك للتواصل مع فريق خدمة العملاء في كيك الأميرة.
        </p>

        {/* Support Methods */}
        <div className="space-y-4">
          {user && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition group active:scale-[0.98]">
              <div className="w-14 h-14 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div className="flex-1 mr-4">
                <h3 className="font-bold text-base mb-1">المراسلة عبر واتساب</h3>
                <p className="text-xs text-gray-500">أسرع طريقة للتواصل المباشر معنا.</p>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400 opacity-50 group-hover:opacity-100 transition" />
            </a>
          )}



          <a href="mailto:support@cakeprincess.com" className="flex items-center p-4 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition group active:scale-[0.98]">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Mail className="w-7 h-7" />
            </div>
            <div className="flex-1 mr-4">
              <h3 className="font-bold text-base mb-1">البريد الإلكتروني</h3>
              <p className="text-xs text-gray-500">للاستفسارات الرسمية والشكاوى.</p>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400 opacity-50 group-hover:opacity-100 transition" />
          </a>
        </div>

        {/* Social Media Section */}
        <div className="mt-8">
          <h2 className="font-black text-lg mb-4 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#e8456b] rounded-full"></div>
            حساباتنا الرسمية
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <a href="https://www.instagram.com/cake0princess/" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl text-white shadow-lg shadow-pink-500/20 active:scale-95 transition-transform">
              <Instagram className="w-8 h-8 mb-2" />
              <span className="font-bold text-sm">انستغرام</span>
            </a>
            <a href="https://www.youtube.com/@Cake.Princess" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-6 bg-[#FF0000] rounded-3xl text-white shadow-lg shadow-red-500/20 active:scale-95 transition-transform">
              <Youtube className="w-8 h-8 mb-2" />
              <span className="font-bold text-sm">يوتيوب</span>
            </a>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8">
          <h2 className="font-black text-lg mb-4 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-[#e8456b] rounded-full"></div>
            الأسئلة الشائعة
          </h2>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
            {[
              { q: "ما هي أوقات التوصيل؟", a: "نقوم بالتوصيل من الساعة 10 صباحاً وحتى 9 مساءً، ونحتاج لتأكيد الطلب قبل يوم واحد على الأقل للكيك الجاهز." },
              { q: "كيف يتم توصيل الكيك؟", a: "نستخدم سيارات مبردة خاصة للحفاظ على جودة وشكل الكيك حتى يصلك بحالة ممتازة." },
              { q: "هل يمكنني تعديل تصميم الكيك؟", a: "نعم! يمكنك ذلك من خلال قسم 'حسب الطلب' في المتجر وتحديد كل التفاصيل." }
            ].map((faq, i) => (
              <div key={i} className="p-4">
                <h4 className="font-bold text-sm mb-1">{faq.q}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
