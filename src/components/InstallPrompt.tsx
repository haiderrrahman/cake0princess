"use client";
import { useState, useEffect } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // Default true to avoid flash

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
    }

    // Check if we are already in standalone mode (installed)
    const isStandAloneMatch = window.matchMedia('(display-mode: standalone)').matches;
    const isStandAloneNavigator = (window.navigator as any).standalone === true;
    const isCurrentlyStandalone = isStandAloneMatch || isStandAloneNavigator;
    setIsStandalone(isCurrentlyStandalone);

    if (isCurrentlyStandalone) return;

    // Check if it's iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Show prompt automatically for iOS after 2 seconds
      setTimeout(() => setShowPrompt(true), 2000);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show the install UI
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        // Just hide the prompt for iOS, they have to use the share menu
        setShowPrompt(false);
      }
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-4 border border-pink-100 dark:border-zinc-800 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950 flex items-center justify-center text-pink-600 dark:text-purple-300 text-2xl flex-shrink-0 shadow-inner">
          👑
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white">ثبت تطبيق كيك الأميرة!</h3>
          
          {isIOS ? (
            <div className="text-xs text-gray-500 mt-2 space-y-2">
              <p>لأفضل تجربة، أضف التطبيق لشاشتك الرئيسية:</p>
              <ol className="list-decimal list-inside space-y-1 bg-gray-50 dark:bg-zinc-800 p-2 rounded-lg">
                <li className="flex items-center gap-1 inline-flex">اضغط على زر المشاركة <Share className="w-3 h-3 mx-1 inline" /></li>
                <li className="flex items-center gap-1 inline-flex">اختر "إضافة للشاشة الرئيسية" <PlusSquare className="w-3 h-3 mx-1 inline" /></li>
              </ol>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">احصل على تجربة أسرع وأفضل مباشرة من شاشة هاتفك الرئيسية.</p>
          )}

          <div className="flex gap-2 mt-3">
            {!isIOS && (
              <button 
                onClick={handleInstallClick}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition"
              >
                <Download className="w-4 h-4" /> تثبيت الآن
              </button>
            )}
            <button 
              onClick={() => setShowPrompt(false)}
              className={`${isIOS ? 'flex-1' : ''} bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 p-2 rounded-lg transition font-medium text-sm`}
            >
              {isIOS ? 'حسناً، فهمت' : <X className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
