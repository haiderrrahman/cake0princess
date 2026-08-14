"use client";
import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial status
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="absolute top-0 left-0 w-full z-[100] bg-red-500 text-white text-center py-2 shadow-lg animate-slide-down flex items-center justify-center gap-2">
      <WifiOff className="w-5 h-5 animate-pulse" />
      <span className="font-bold text-sm">مقطوع الانترنت لديكم</span>
    </div>
  );
}
