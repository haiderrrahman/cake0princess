"use client";
import { useState } from "react";
import { X, MessageCircle } from "lucide-react";

// ضع رقم الواتساب هنا (مع كود الدولة بدون + أو 00)
// مثال للعراق: 9647XXXXXXXXX
const WHATSAPP_NUMBER = "9647000000000";
const WHATSAPP_MESSAGE = "مرحباً، أحتاج مساعدة بخصوص طلبي في كيك الأميرة 🎂";

export default function FloatingWhatsApp() {
  const [showTooltip, setShowTooltip] = useState(true);

  const handleClick = () => {
    setShowTooltip(false);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {/* Tooltip bubble */}
      {showTooltip && (
        <div className="relative bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 ml-2 max-w-[180px] text-right leading-relaxed">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute -top-2 -left-2 w-5 h-5 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center"
          >
            <X className="w-3 h-3 text-gray-600 dark:text-gray-400" />
          </button>
          تواصل معنا عبر واتساب! 👋
          {/* Triangle arrow */}
          <div className="absolute -bottom-2 right-5 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-zinc-900"></div>
        </div>
      )}

      {/* WhatsApp Button */}
      <button
        onClick={handleClick}
        aria-label="تواصل معنا عبر واتساب"
        className="w-14 h-14 bg-[#25D366] hover:bg-[#1ebd5a] rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all active:scale-95 hover:scale-105"
      >
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M16 2C8.268 2 2 8.268 2 16c0 2.386.628 4.624 1.728 6.562L2 30l7.683-1.694A13.94 13.94 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm-3.5 8.25c-.26 0-.684.097-.963.4-.28.303-1.068 1.044-1.068 2.547s1.093 2.953 1.245 3.157c.152.204 2.128 3.37 5.22 4.592 2.57 1.015 3.092.813 3.652.763.56-.051 1.806-.738 2.062-1.451.254-.713.254-1.325.178-1.451-.076-.126-.28-.203-.585-.356-.304-.153-1.806-.891-2.086-.993-.28-.101-.484-.153-.687.153-.204.305-.787.993-.963 1.197-.178.204-.356.23-.66.077-.305-.153-1.286-.474-2.45-1.511-.905-.807-1.516-1.803-1.694-2.107-.178-.305-.019-.47.133-.62.137-.136.305-.356.458-.534.153-.178.204-.305.305-.508.102-.204.051-.382-.025-.534-.077-.153-.688-1.66-.942-2.27-.248-.601-.502-.507-.688-.517A8.35 8.35 0 0012.5 10.25z" fill="white"/>
        </svg>
      </button>
    </div>
  );
}
