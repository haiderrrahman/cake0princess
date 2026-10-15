"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Heart, 
  Calendar, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Settings, 
  History, 
  Plus, 
  AlertCircle, 
  ChevronRight, 
  Moon, 
  Sun, 
  ShieldCheck, 
  Edit3, 
  X, 
  Flower2, 
  BellRing,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { 
  CycleMemberSettings, 
  calculateCycleStatus, 
  subscribeToMemberCycleSettings, 
  saveMemberCycleSettings, 
  formatToDateString,
  addDaysToDateString,
  DEFAULT_CYCLE_SETTINGS
} from "@/lib/cycleTracker";

interface WomenCycleCareProps {
  currentMember: "إيمان" | "رقية" | string;
  onMemberChange?: (member: "إيمان" | "رقية") => void;
  isImanLoggedIn?: boolean;
}

export default function WomenCycleCare({
  currentMember,
  onMemberChange,
  isImanLoggedIn = false
}: WomenCycleCareProps) {
  const activeMember: "إيمان" | "رقية" = currentMember === "رقية" ? "رقية" : "إيمان";

  const [settings, setSettings] = useState<CycleMemberSettings>(
    DEFAULT_CYCLE_SETTINGS[activeMember] || DEFAULT_CYCLE_SETTINGS["إيمان"]
  );
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSimulateAlert, setShowSimulateAlert] = useState(false);

  // Form states for settings modal
  const [formDuration, setFormDuration] = useState<number>(settings.periodDuration || 5);
  const [formCycleLength, setFormCycleLength] = useState<number>(settings.cycleLength || 28);
  const [formLastDate, setFormLastDate] = useState<string>(settings.lastPeriodDate || formatToDateString(new Date()));
  const [formEmail, setFormEmail] = useState<string>(settings.customEmail || "");
  const [formNotes, setFormNotes] = useState<string>(settings.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // Subscribe to real-time updates for active member
  useEffect(() => {
    const unsub = subscribeToMemberCycleSettings(activeMember, (newSettings) => {
      setSettings(newSettings);
      setFormDuration(newSettings.periodDuration || 5);
      setFormCycleLength(newSettings.cycleLength || 28);
      setFormLastDate(newSettings.lastPeriodDate || formatToDateString(new Date()));
      setFormEmail(newSettings.customEmail || "");
      setFormNotes(newSettings.notes || "");
    });
    return () => unsub();
  }, [activeMember]);

  // Calculate live status insights
  const status = useMemo(() => {
    return calculateCycleStatus(settings);
  }, [settings]);

  // Log today as the start of a new period
  const handleLogPeriodToday = async () => {
    const todayStr = formatToDateString(new Date());
    if (settings.lastPeriodDate === todayStr) {
      toast.info("تم تسجيل بداية الدورة اليوم مسبقاً 🌸");
      return;
    }

    const newHistoryItem = {
      id: `cycle-${Date.now()}`,
      startDate: todayStr,
      duration: settings.periodDuration || 5,
      notes: `بدء دورة ${new Date().toLocaleDateString("ar-IQ", { month: "long" })}`,
      loggedAt: new Date().toISOString()
    };

    const updated: CycleMemberSettings = {
      ...settings,
      lastPeriodDate: todayStr,
      history: [newHistoryItem, ...(settings.history || [])].slice(0, 24)
    };

    setSettings(updated);
    await saveMemberCycleSettings(updated);
    toast.success(`تم تسجيل بدء الدورة لـ ${activeMember} اليوم بنجاح 🌸 اعتني بنفسك!`);
  };

  // Save settings form
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: CycleMemberSettings = {
        ...settings,
        periodDuration: Number(formDuration) || 5,
        cycleLength: Number(formCycleLength) || 28,
        lastPeriodDate: formLastDate,
        customEmail: formEmail.trim(),
        notes: formNotes.trim()
      };
      setSettings(updated);
      await saveMemberCycleSettings(updated);
      setShowSettingsModal(false);
      toast.success("تم حفظ إعدادات الدورة بنجاح ✨");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-purple-500/10 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-purple-950/30 border border-pink-200/80 dark:border-pink-900/50 shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-5">
      
      {/* Decorative Aura */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/10 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/2" />

      {/* Top Header: Title + Member Switcher */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-pink-100 dark:border-pink-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-500/25">
            <Flower2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>ركن الصحة والعناية الشهرية</span>
                <span className="text-pink-500">🌸</span>
              </h3>
              {activeMember === "إيمان" && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60 flex items-center gap-1">
                  <BellRing className="w-3 h-3 text-pink-600 animate-bounce" />
                  <span>تنبيه حصري مفعل</span>
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              متابعة مواعيد الدورة ({settings.periodDuration} أيام كل {settings.cycleLength} يوماً) وإرشادات الراحة
            </p>
          </div>
        </div>

        {/* Member Switcher Buttons & Settings Trigger */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {onMemberChange && (
            <div className="flex bg-white/80 dark:bg-zinc-900/80 p-1 rounded-2xl border border-pink-200/60 dark:border-pink-900/50 shadow-xs">
              <button
                type="button"
                onClick={() => onMemberChange("إيمان")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                  activeMember === "إيمان"
                    ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-pink-600"
                }`}
              >
                👩🏻 إيمان
              </button>
              <button
                type="button"
                onClick={() => onMemberChange("رقية")}
                className={`px-3 py-1 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer ${
                  activeMember === "رقية"
                    ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-pink-600"
                }`}
              >
                👧🏻 رقية
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-white/80 dark:bg-zinc-900/80 hover:bg-pink-50 dark:hover:bg-pink-950/50 border border-pink-200/60 dark:border-pink-900/50 text-gray-600 dark:text-gray-300 transition shadow-xs cursor-pointer"
            title="تعديل مدة الدورة وعدد الأيام"
          >
            <Settings className="w-4 h-4 text-pink-600 dark:text-pink-400" />
          </button>
        </div>
      </div>

      {/* Main Status Cards Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        
        {/* Card 1: Live Status Hero */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
          status.isCurrentlyInPeriod
            ? "bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-transparent border-rose-300 dark:border-rose-800 shadow-sm"
            : status.isDueTomorrow
              ? "bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent border-amber-300 dark:border-amber-700/80 shadow-sm animate-pulse"
              : "bg-white/90 dark:bg-zinc-900/90 border-pink-100 dark:border-pink-900/40 shadow-xs"
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">الحالة الحالية</span>
              <span className="text-xl">
                {status.isCurrentlyInPeriod ? "🌸" : status.isDueTomorrow ? "⏰" : "🗓️"}
              </span>
            </div>

            {status.isCurrentlyInPeriod ? (
              <div>
                <h4 className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
                  الدورة نشطة حالياً 🌸
                </h4>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1">
                  أنتِ في <span className="text-rose-600 dark:text-rose-400 font-black">اليوم {status.currentPeriodDay}</span> من أصل {status.periodDuration} أيام
                </p>
                <div className="mt-2 text-[11px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-xl w-max border border-rose-200 dark:border-rose-900">
                  متبقي {status.periodDaysRemaining} {status.periodDaysRemaining === 1 ? "يوم واحد" : "أيام"} 🌿
                </div>
              </div>
            ) : status.isDueTomorrow ? (
              <div>
                <h4 className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-300">
                  الموعد المتوقع غداً! ⏰
                </h4>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  تنبيه استباقي: موعد الدورة الشهرية يبدأ غداً بإذن الله
                </p>
                <span className="mt-2 inline-block text-[11px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-xl border border-amber-200">
                  كوني مستعدة ومرتاحة 🌸
                </span>
              </div>
            ) : status.isDueToday ? (
              <div>
                <h4 className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-300">
                  اليوم هو الموعد المتوقع 🌸
                </h4>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  يمكنك تأكيد بدئها بنقرة واحدة بالأسفل
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-gray-900 dark:text-white">
                    {Math.max(0, status.daysUntilNextPeriod)}
                  </span>
                  <span className="text-xs font-bold text-gray-500">يوم متبقي</span>
                </div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  على الموعد القادم: <span className="font-black text-pink-600 dark:text-pink-400">{status.nextPeriodDate}</span>
                </p>
              </div>
            )}
          </div>

          {/* Micro Progress Bar */}
          <div className="mt-4 pt-2 border-t border-pink-100 dark:border-pink-900/30">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-1">
              <span>تقدم الدورة (اليوم {status.cycleDay} من {status.cycleLength})</span>
              <span>{status.progressPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${status.progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Current Biological Phase */}
        <div className="bg-white/90 dark:bg-zinc-900/90 p-4 rounded-2xl border border-pink-100 dark:border-pink-900/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">المرحلة الحيوية</span>
              <span className="text-xl">{status.currentPhase.icon}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${status.currentPhase.badgeColor}`}>
                {status.currentPhase.title}
              </span>
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-2.5 leading-relaxed">
              {status.currentPhase.description}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800 text-[11px] text-gray-500 dark:text-gray-400 font-bold flex items-center justify-between">
            <span>تاريخ آخر بداية:</span>
            <span className="font-black text-gray-800 dark:text-gray-200">{status.lastPeriodDate}</span>
          </div>
        </div>

        {/* Card 3: Quick Care Tips & Nourishment */}
        <div className="bg-gradient-to-br from-purple-50/60 to-pink-50/60 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-purple-900 dark:text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>نصائح الراحة والعناية 🍵</span>
              </span>
            </div>
            <ul className="text-xs space-y-1.5 text-gray-700 dark:text-gray-300 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>شرب شاي الأعشاب الدافئة (قرفة، نعناع، بابونج).</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>التركيز على الأطعمة الغنية بالحديد والمغنيسيوم.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>أخذ قسط كافٍ من النوم والراحة وتجنب التوتر.</span>
              </li>
            </ul>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold">
              متابعة مخصصة لـ {activeMember}
            </span>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="text-[11px] font-black text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>السجل ({settings.history?.length || 0})</span>
              <ChevronRight className="w-3 h-3 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLogPeriodToday}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs shadow-md shadow-pink-500/25 active:scale-95 transition flex items-center gap-2 cursor-pointer"
          >
            <Flower2 className="w-4 h-4" />
            <span>تسجيل بدء الدورة اليوم 🌸</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-800/60 text-gray-800 dark:text-gray-200 font-bold text-xs hover:bg-pink-50 dark:hover:bg-zinc-800 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-pink-500" />
            <span>تعديل الأيام والمواعيد ({settings.periodDuration} أيام / {settings.cycleLength} يوماً)</span>
          </button>
        </div>

        {/* Simulation / Preview Button for testing exclusive Iman alert */}
        {activeMember === "إيمان" && (
          <button
            type="button"
            onClick={() => setShowSimulateAlert(true)}
            className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 bg-pink-100/60 dark:bg-pink-950/40 px-3 py-1.5 rounded-xl border border-pink-200 dark:border-pink-800/40 transition flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>معاينة تنبيه إيمان الحصري 👁️</span>
          </button>
        )}
      </div>

      {/* ─── Settings Modal (Adjust days more or less) ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-pink-100 dark:border-pink-900 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  إعدادات دورة {activeMember} 🌸
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-right" dir="rtl">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  مدة الدورة (عدد أيام نزول الدورة):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="14"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                    required
                  />
                  <span className="text-xs font-bold text-gray-500 shrink-0">أيام (الافتراضي: 5)</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">يمكن زيادتها أو تقليلها حسب طبيعة الجسم</p>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  طول الدورة الكاملة (الفترة بين بداية كل دورتين):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="20"
                    max="45"
                    value={formCycleLength}
                    onChange={(e) => setFormCycleLength(Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                    required
                  />
                  <span className="text-xs font-bold text-gray-500 shrink-0">يوماً (الافتراضي: 28)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  تاريخ بداية آخر دورة:
                </label>
                <input
                  type="date"
                  value={formLastDate}
                  onChange={(e) => setFormLastDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                  required
                />
              </div>

              {activeMember === "إيمان" && (
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                    البريد الإلكتروني لحساب إيمان (للتنبيه الحصري):
                  </label>
                  <input
                    type="email"
                    placeholder="اختياري: مثال iman@... أو يكتشف تلقائياً"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30 text-left"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-pink-600 dark:text-pink-400 mt-1 font-bold">
                    * يتم إرسال التنبيه قبل يوم وأثناء أيام الدورة لحساب إيمان فقط فور تسجيل الدخول.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات إضافية:
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="أي ملاحظات حول الأعراض، المسكنات المفضلة..."
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-xs shadow-md shadow-pink-500/20 active:scale-95 transition"
                >
                  {isSaving ? "جاري الحفظ..." : "حفظ التغييرات ✨"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── History Modal ─── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-pink-100 dark:border-pink-900 shadow-2xl relative max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-pink-600" />
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  سجل دورات {activeMember} السابقة 📜
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(settings.history || []).length === 0 ? (
              <p className="text-center py-8 text-xs font-bold text-gray-400">
                لا يوجد سجلات سابقة مسجلة حتى الآن
              </p>
            ) : (
              <div className="space-y-2">
                {(settings.history || []).map((h, idx) => (
                  <div 
                    key={h.id || idx}
                    className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200">{h.startDate}</span>
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-950/60 px-2 py-0.5 rounded-md border border-pink-200">
                          {h.duration} أيام
                        </span>
                      </div>
                      {h.notes && (
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">{h.notes}</p>
                      )}
                    </div>
                    <span className="text-xs">🌸</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Simulation Alert Modal for Iman ─── */}
      {showSimulateAlert && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-pink-50 via-white to-rose-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-pink-950/40 rounded-3xl p-6 w-full max-w-sm border-2 border-pink-400 dark:border-pink-800 shadow-2xl relative text-right" dir="rtl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md">
                <Flower2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300">
                  تنبيه خاص بحساب إيمان فقط 🌸
                </span>
                <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                  معاينة إشعار الدورة الشهرية
                </h4>
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-pink-100 dark:border-zinc-800 text-xs font-bold text-gray-700 dark:text-gray-200 leading-relaxed mb-4">
              {status.isCurrentlyInPeriod ? (
                <>
                  🌸 <strong className="text-pink-600">مرحباً إيمان:</strong> أنتِ الآن في اليوم {status.currentPeriodDay} من الدورة الشهرية (متبقي {status.periodDaysRemaining} أيام). نتمنى لكِ الراحة والعافية، خذي قسطاً وافياً من النوم وتناولي مشروباتك الدافئة المفضلة 🍵.
                </>
              ) : status.isDueTomorrow ? (
                <>
                  🌸 <strong className="text-amber-600">تذكير لطيف يا إيمان:</strong> موعد الدورة الشهرية المتوقع غداً. جهزي مستلزماتك الخاصة واحرصي على الراحة والهدوء اليوم 🌸.
                </>
              ) : (
                <>
                  🌸 <strong className="text-pink-600">صباح الخير إيمان:</strong> باقي {status.daysUntilNextPeriod} يوم على موعد الدورة القادمة (المتوقع {status.nextPeriodDate}). يومكِ سعيد ومليء بالطاقة والإشراق ✨.
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSimulateAlert(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-xs shadow-md active:scale-95 transition"
            >
              فهمت، شكراً 🌸
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
