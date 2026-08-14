"use client";
import Link from "next/link";
import { ChevronRight, Bell, Moon, Shield, Volume2, Key, Globe, EyeOff, Check, X, User as UserIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("ar");

  useEffect(() => {
    setMounted(true);
    // Load from local storage
    const savedNotifs = localStorage.getItem("push_notifications");
    if (savedNotifs !== null) setNotifications(savedNotifs === "true");
    
    const savedLang = localStorage.getItem("app_language");
    if (savedLang) setLanguage(savedLang);
  }, []);

  const toggleNotifications = () => {
    const newState = !notifications;
    setNotifications(newState);
    localStorage.setItem("push_notifications", String(newState));
  };

  const toggleLanguage = () => {
    const newLang = language === "ar" ? "en" : "ar";
    setLanguage(newLang);
    localStorage.setItem("app_language", newLang);
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent dark:bg-zinc-950 pb-24 animate-slide-up">
      {/* Header */}
      <header className="px-5 pt-4 pb-4 bg-white dark:bg-zinc-900 sticky top-0 z-40 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition active:scale-95">
          <ChevronRight className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">الإعدادات</h1>
      </header>

      <div className="px-5 mt-6 space-y-6">
        
        {/* App Settings */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 mb-3 ml-1">إعدادات التطبيق</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800">
            
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-gray-500">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">الوضع الليلي</h3>
                  <p className="text-[11px] text-gray-500">تغيير مظهر التطبيق</p>
                </div>
              </div>
              <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                {mounted && (
                  <>
                    <button onClick={() => setTheme('light')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}>فاتح</button>
                    <button onClick={() => setTheme('dark')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${theme === 'dark' ? 'bg-zinc-700 text-white shadow-sm' : 'text-gray-400'}`}>داكن</button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-500">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">الإشعارات المنبثقة</h3>
                  <p className="text-[11px] text-gray-500">عروض الكيك والدورات</p>
                </div>
              </div>
              <div onClick={toggleNotifications} className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-300 ${notifications ? 'bg-[#e8456b]' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${notifications ? 'right-1' : 'right-7'}`}></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-500">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">لغة التطبيق</h3>
                  <p className="text-[11px] text-gray-500">العربية</p>
                </div>
              </div>
              <button onClick={toggleLanguage} className="bg-gray-100 dark:bg-zinc-800 text-xs font-bold px-3 py-1.5 rounded-lg text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-zinc-700">
                {language === "ar" ? "English" : "العربية"}
              </button>
            </div>

          </div>
        </div>

        {/* Account Settings */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 mb-3 ml-1">إعدادات الحساب</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800">
            
            <Link href="/privacy" className="flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-zinc-800 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-500">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">الأمان والخصوصية</h3>
                  <p className="text-[11px] text-gray-500">إدارة الجلسات والأجهزة</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </Link>

            <Link href="/profile/edit" className="flex items-center justify-between p-4 active:bg-gray-50 dark:active:bg-zinc-800 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 rounded-xl flex items-center justify-center text-pink-500">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">تعديل الملف الشخصي</h3>
                  <p className="text-[11px] text-gray-500">الاسم، الجنس، تاريخ الميلاد</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </Link>



          </div>
        </div>

      </div>
    </div>
  );
}
