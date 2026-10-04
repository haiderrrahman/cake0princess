"use client";

import React, { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { 
  Sparkles, X, ArrowLeft, Eye, Clock, Phone, MapPin, 
  CheckCircle2, MessageSquare, AlertTriangle, ExternalLink,
  ShoppingBag, Coins
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ══════════════════════════════════════════════════════════════
// THEATRICAL WEB AUDIO SYNTHESIZER (ZERO-DEPENDENCY NATIVE AUDIO)
// ══════════════════════════════════════════════════════════════
class TheatricalSoundManager {
  private audioCtx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * نغمة مسرحية فاخرة (Theatrical Cinematic Chime)
   * نغمة ثلاثية متصاعدة وفخمة (E5 -> A5 -> C#6)
   */
  playTheatricalChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [659.25, 880.00, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.95);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.0);
      });
    } catch (e) {
      console.warn("Audio not available:", e);
    }
  }

  /**
   * نغمة الإنجاز والتسليم الفوري
   */
  playSuccessChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16); // G5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }
}

const theatricalAudio = new TheatricalSoundManager();

export interface SocialOrderAlertItem {
  id: string;
  customerName: string;
  customerPhone?: string;
  cakeName: string;
  price: number | string;
  paidAmount?: number | string;
  platform?: string;
  deliveryDate?: string;
  address?: string;
  notes?: string;
  image?: string;
  status: string;
  isDebtSettled?: boolean;
}

export default function TheatricalSocialAlert() {
  const router = useRouter();
  const [activeAlertOrder, setActiveAlertOrder] = useState<SocialOrderAlertItem | null>(null);
  const [dismissedOrderIds, setDismissedOrderIds] = useState<string[]>([]);
  const [isDelivering, setIsDelivering] = useState(false);

  // استرجاع المعرفات المؤجلة في هذه الجلسة
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("cake_theatrical_dismissed_social");
      if (stored) {
        try {
          setDismissedOrderIds(JSON.parse(stored));
        } catch {}
      }
    }
  }, []);

  // الاستماع المباشر والحي للطلبات من Firestore
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SocialOrderAlertItem[];

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // البحث عن أول طلب سوشيال يستحق التسليم اليوم أو متأخر وغير مسلّم بعد
      const urgentOrder = allOrders.find(o => {
        // تخطي المؤجل في هذه الجلسة
        if (dismissedOrderIds.includes(o.id)) return false;

        // استبعاد الحالات المكتملة أو الملغية
        if (["delivered", "completed", "cancelled", "rejected"].includes(o.status)) return false;

        // فحص تاريخ التسليم
        if (!o.deliveryDate) return false;
        const dStr = o.deliveryDate.split("T")[0];

        // يستحق التسليم اليوم أو تاريخه سابق ولم يُسلّم
        return dStr <= todayStr;
      });

      if (urgentOrder) {
        // تشغيل الإشعار المسرحي الفاخر
        setActiveAlertOrder(urgentOrder);
        theatricalAudio.playTheatricalChime();
      } else {
        // إذا تم تسليم الطلب أو انتهى، إغلاق الإشعار آلياً
        setActiveAlertOrder(null);
      }
    }, (err) => {
      console.error("Theatrical alert snapshot error:", err);
    });

    return () => unsubscribe();
  }, [dismissedOrderIds]);

  const handleDismiss = () => {
    if (!activeAlertOrder) return;
    const newDismissed = [...dismissedOrderIds, activeAlertOrder.id];
    setDismissedOrderIds(newDismissed);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("cake_theatrical_dismissed_social", JSON.stringify(newDismissed));
    }
    setActiveAlertOrder(null);
  };

  // زر الإنجاز والتسليم الفوري من داخل الإشعار المسرحي نفسه!
  const handleMarkDeliveredInstantly = async () => {
    if (!activeAlertOrder) return;
    setIsDelivering(true);
    try {
      await updateDoc(doc(db, "orders", activeAlertOrder.id), {
        status: "delivered",
        isDebtSettled: true,
        deliveredAt: new Date().toISOString()
      });
      theatricalAudio.playSuccessChime();
      toast.success(`تم تسليم وتوثيق طلب ${activeAlertOrder.customerName} بنجاح! 🎉`);
      handleDismiss();
    } catch (e) {
      console.error("Failed to mark delivered:", e);
      toast.error("حدث خطأ أثناء تحديث حالة التسليم");
    } finally {
      setIsDelivering(false);
    }
  };

  const handleOpenInHub = () => {
    handleDismiss();
    router.push("/admin/hub?tab=external");
  };

  if (!activeAlertOrder) return null;

  const platform = activeAlertOrder.platform || "واتساب";
  const platformEmoji = platform === "انستغرام" || platform === "إنستجرام" ? "📸" : platform === "واتساب" ? "💬" : "📱";
  const priceNum = Number(activeAlertOrder.price || 0);
  const paidNum = Number(activeAlertOrder.paidAmount ?? priceNum);
  const remaining = Math.max(0, priceNum - paidNum);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-900 to-[#070b14] border-2 border-emerald-500/70 rounded-[2.5rem] shadow-[0_0_60px_rgba(16,185,129,0.35)] overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-300 max-h-[94vh] flex flex-col">
        {/* خلفيات هيدروليكية مشعة */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* زر الإغلاق / التأجيل */}
        <button 
          onClick={handleDismiss}
          className="absolute top-6 left-6 p-2 rounded-2xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-colors z-20 active:scale-95"
          title="تأجيل الإشعار"
          aria-label="تأجيل"
        >
          <X className="w-5 h-5" />
        </button>

        {/* رأس الإشعار المسرحي */}
        <div className="flex items-center gap-4 mb-4 flex-shrink-0">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-3xl animate-bounce">🎂</span>
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-lg text-white shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border mb-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse">
              <span>🚨 إشعار مسرحي عاجل: طلب يستحق التسليم اليوم!</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {activeAlertOrder.cakeName || "طلب كيك سوشيال"}
            </h2>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
              <span>الزبون:</span>
              <strong className="text-emerald-400 font-black">{activeAlertOrder.customerName}</strong>
              <span className="text-gray-500">•</span>
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-bold text-[10px]">
                {platformEmoji} {platform}
              </span>
            </p>
          </div>
        </div>

        {/* تفاصيل الطلب في بطاقات منسقة */}
        <div className="overflow-y-auto custom-scrollbar flex-1 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/60 text-xs sm:text-sm">
            {/* وقت التسليم */}
            <div className="flex items-center gap-2 text-slate-300 col-span-full bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-slate-400">موعد التسليم المقرر:</span>
              <span className="font-black text-emerald-300">
                {activeAlertOrder.deliveryDate 
                  ? new Date(activeAlertOrder.deliveryDate).toLocaleDateString("ar-IQ", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : "اليوم"}
              </span>
            </div>

            {/* السعر والواصل */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>السعر الإجمالي:</span>
              </div>
              <span className="font-black text-white">{priceNum.toLocaleString()} د.ع</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <ShoppingBag className="w-4 h-4 text-teal-400" />
                <span>المبلغ الواصل:</span>
              </div>
              <span className={`font-black ${remaining > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {paidNum.toLocaleString()} د.ع
                {remaining > 0 && <span className="text-[10px] text-rose-300 mr-1">(باقي {remaining.toLocaleString()})</span>}
              </span>
            </div>

            {/* رقم الهاتف وزر الواتساب المباشر */}
            {activeAlertOrder.customerPhone && (
              <div className="col-span-full flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/40">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-white text-sm" dir="ltr">{activeAlertOrder.customerPhone}</span>
                </div>
                <a 
                  href={`https://wa.me/${activeAlertOrder.customerPhone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 shadow-sm transition"
                >
                  <span>مراسلة واتساب</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* العنوان والملاحظات */}
            {activeAlertOrder.address && (
              <div className="col-span-full flex items-start gap-2 text-slate-300 p-2.5 bg-slate-900/60 rounded-xl border border-slate-700/40">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-400 text-xs block">عنوان التسليم:</span>
                  <span className="font-bold text-white text-xs">{activeAlertOrder.address}</span>
                </div>
              </div>
            )}

            {activeAlertOrder.notes && (
              <div className="col-span-full p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <span className="text-amber-400 font-black text-xs block mb-0.5">ملاحظات الطلب:</span>
                <p className="text-xs text-slate-200 font-bold leading-relaxed">{activeAlertOrder.notes}</p>
              </div>
            )}

            {/* معاينة صورة الكيكة إذا وجدت */}
            {activeAlertOrder.image && (
              <div className="col-span-full flex items-center gap-3 p-2 bg-slate-900/80 rounded-xl border border-slate-700/40">
                <img 
                  src={activeAlertOrder.image} 
                  alt="صورة الكيكة" 
                  className="w-16 h-16 rounded-lg object-cover border border-emerald-500/40 shrink-0" 
                />
                <div>
                  <span className="text-xs font-black text-emerald-400 block">صورة الكيكة المرفقة</span>
                  <span className="text-[10px] text-gray-400">تم حفظها وتوثيقها في سجل السوشيال</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* أزرار الإجراء المسرحي */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0 pt-2 border-t border-slate-800">
          <button
            onClick={handleMarkDeliveredInstantly}
            disabled={isDelivering}
            className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isDelivering ? "جاري التوثيق..." : "تم التسليم وتوثيق الإنجاز فوراً ✅"}</span>
          </button>

          <button
            onClick={handleOpenInHub}
            className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all active:scale-95"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>عرض بغرفة العمليات</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
