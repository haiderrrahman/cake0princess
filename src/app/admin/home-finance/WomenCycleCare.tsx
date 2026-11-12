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
  Info,
  Trash2,
  CalendarDays,
  Sparkle,
  TrendingUp,
  AlertTriangle,
  Check,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { 
  CycleMemberSettings, 
  CycleHistoryItem,
  PredictedCycle,
  calculateCycleStatus, 
  subscribeToMemberCycleSettings, 
  saveMemberCycleSettings, 
  updateCycleStartDate,
  logCycleEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  formatToDateString,
  addDaysToDateString,
  formatArabicFriendlyDate,
  getArabicMonthYear,
  normalizeMemberName,
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
  // Independent, internal active member state with immediate fallback
  const [activeMember, setActiveMember] = useState<"إيمان" | "رقية">(() => {
    return normalizeMemberName(currentMember);
  });

  // Keep internal state synced if parent explicitly changes
  useEffect(() => {
    if (currentMember) {
      const norm = normalizeMemberName(currentMember);
      setActiveMember(norm);
    }
  }, [currentMember]);

  const handleSwitchMember = (member: "إيمان" | "رقية") => {
    setActiveMember(member);
    if (onMemberChange) {
      onMemberChange(member);
    }
  };

  const [settings, setSettings] = useState<CycleMemberSettings>(() => {
    return DEFAULT_CYCLE_SETTINGS[activeMember] || DEFAULT_CYCLE_SETTINGS["إيمان"];
  });

  // Direct Inline Date Editor on the Card
  const [inlineDate, setInlineDate] = useState<string>("");

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showSimulateAlert, setShowSimulateAlert] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<CycleHistoryItem | null>(null);

  // Form states for settings modal
  const [formDuration, setFormDuration] = useState<number>(settings.periodDuration || 5);
  const [formCycleLength, setFormCycleLength] = useState<number>(settings.cycleLength || 28);
  const [formLastDate, setFormLastDate] = useState<string>(settings.lastPeriodDate || formatToDateString(new Date()));
  const [formEmail, setFormEmail] = useState<string>(settings.customEmail || "");
  const [formNotes, setFormNotes] = useState<string>(settings.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // State for new custom period modal
  const [newPeriodDate, setNewPeriodDate] = useState<string>(formatToDateString(new Date()));
  const [newPeriodDuration, setNewPeriodDuration] = useState<number>(settings.periodDuration || 5);
  const [newPeriodNotes, setNewPeriodNotes] = useState<string>("");

  // Real-time subscription to active member
  useEffect(() => {
    const unsub = subscribeToMemberCycleSettings(activeMember, (newSettings) => {
      setSettings(newSettings);
      setInlineDate(newSettings.lastPeriodDate || formatToDateString(new Date()));
      setFormDuration(newSettings.periodDuration || 5);
      setFormCycleLength(newSettings.cycleLength || 28);
      setFormLastDate(newSettings.lastPeriodDate || formatToDateString(new Date()));
      setFormEmail(newSettings.customEmail || "");
      setFormNotes(newSettings.notes || "");
      setNewPeriodDuration(newSettings.periodDuration || 5);
    });
    return () => unsub();
  }, [activeMember]);

  // Calculate live status insights and predictions
  const status = useMemo(() => {
    return calculateCycleStatus(settings);
  }, [settings]);

  // Sync inlineDate if status lastPeriodDate updates
  useEffect(() => {
    if (status.lastPeriodDate) {
      setInlineDate(status.lastPeriodDate);
    }
  }, [status.lastPeriodDate]);

  // 1. Direct Inline Start Date Update (تعديل تاريخ بداية الدورة مباشرة وبنقرة واحدة)
  const handleSaveInlineDate = async (newDateToSave?: string) => {
    const targetDate = newDateToSave || inlineDate;
    if (!targetDate) {
      toast.error("يرجى اختيار تاريخ صالح");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateCycleStartDate(settings, targetDate);
      setSettings(updated);
      setInlineDate(targetDate);
      toast.success(`تم تحديث بداية دورة ${activeMember} إلى: ${formatArabicFriendlyDate(targetDate)} بنجاح ✨`);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ التاريخ");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Presets: اليوم، أمس، قبل يومين
  const handleQuickPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateStr = formatToDateString(d);
    setInlineDate(dateStr);
    handleSaveInlineDate(dateStr);
  };

  // 2. Log New Period (Today or custom date)
  const handleLogNewPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodDate) {
      toast.error("يرجى تحديد تاريخ البدء");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await logCycleEntry(
        settings,
        newPeriodDate,
        Number(newPeriodDuration) || 5,
        newPeriodNotes.trim()
      );
      setSettings(updated);
      setShowNewPeriodModal(false);
      setNewPeriodNotes("");
      toast.success(`تم تسجيل بداية الدورة لـ ${activeMember} بنجاح 🌸`);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick log for Today
  const handleQuickLogToday = async () => {
    const todayStr = formatToDateString(new Date());
    if (settings.lastPeriodDate === todayStr) {
      toast.info("تم تسجيل بداية الدورة اليوم مسبقاً 🌸 يمكنك تعديل التاريخ إذا أردتِ.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await logCycleEntry(
        settings,
        todayStr,
        settings.periodDuration || 5,
        `بدء دورة ${formatArabicFriendlyDate(todayStr)}`
      );
      setSettings(updated);
      toast.success(`تم تسجيل بدء الدورة لـ ${activeMember} اليوم بنجاح 🌸 اعتني بنفسك!`);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Save Settings Form
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

  // 4. Update History Item
  const handleSaveHistoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHistoryItem) return;
    setIsSaving(true);
    try {
      const updated = await updateHistoryEntry(settings, editingHistoryItem.id, {
        startDate: editingHistoryItem.startDate,
        duration: Number(editingHistoryItem.duration) || 5,
        notes: editingHistoryItem.notes || ""
      });
      setSettings(updated);
      setEditingHistoryItem(null);
      toast.success("تم تحديث بيانات الدورة في السجل بنجاح ✨");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء التحديث");
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Delete History Item
  const handleDeleteHistoryItem = async (itemId: string) => {
    if (!confirm("هل أنتِ متأكدة من حذف هذا السجل؟")) return;
    try {
      const updated = await deleteHistoryEntry(settings, itemId);
      setSettings(updated);
      toast.success("تم حذف السجل بنجاح 🗑️");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحذف");
    }
  };

  const isDateModified = inlineDate && inlineDate !== status.lastPeriodDate;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-purple-500/10 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-purple-950/30 border border-pink-200/80 dark:border-pink-900/50 shadow-sm p-4 sm:p-6 space-y-6">
      
      {/* Decorative Aura */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-pink-400/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-400/10 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2" />

      {/* ─── Header: Member Switcher & Main Controls ─── */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-pink-100 dark:border-pink-900/40">
        
        {/* Title & Active Member Badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-pink-500/25 shrink-0">
            <Flower2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>ركن الصحة والعناية الشهرية</span>
                <span className="text-pink-500">🌸</span>
              </h3>
              
              <span className="text-xs font-black px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60 flex items-center gap-1.5">
                <span>متابعة خاصة بـ: {activeMember === "إيمان" ? "👩🏻 إيمان" : "👧🏻 رقية"}</span>
              </span>
            </div>

            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
              إعدادات مستقلة: {settings.periodDuration} أيام نزول • دورة كل {settings.cycleLength} يوماً • جدول تنبؤ حي لـ 6 أشهر
            </p>
          </div>
        </div>

        {/* Large Prominent Member Switcher */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-white/95 dark:bg-zinc-900/95 p-1.5 rounded-2xl border-2 border-pink-300 dark:border-pink-800 shadow-sm">
            <button
              type="button"
              onClick={() => handleSwitchMember("إيمان")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition active:scale-95 cursor-pointer flex items-center gap-2 ${
                activeMember === "إيمان"
                  ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400"
              }`}
            >
              <span>👩🏻 دورة إيمان</span>
              {activeMember === "إيمان" && <Check className="w-4 h-4 stroke-[3]" />}
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMember("رقية")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition active:scale-95 cursor-pointer flex items-center gap-2 ${
                activeMember === "رقية"
                  ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400"
              }`}
            >
              <span>👧🏻 دورة رقية</span>
              {activeMember === "رقية" && <Check className="w-4 h-4 stroke-[3]" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 hover:bg-pink-50 dark:hover:bg-pink-950/50 border border-pink-200 dark:border-pink-800 text-gray-700 dark:text-gray-300 transition shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
            title="تعديل مدة الدورة وعدد الأيام"
          >
            <Settings className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            <span className="hidden sm:inline">الإعدادات</span>
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: LIVE STATUS HERO CARD WITH DIRECT INLINE DATE EDIT ─── */}
      <div className="relative z-10 bg-white/95 dark:bg-zinc-900/95 rounded-3xl p-5 sm:p-6 border-2 border-pink-200 dark:border-pink-900 shadow-md">
        
        {/* Top Badges & Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 border-b border-pink-100 dark:border-pink-900/40">
          
          {/* Col 1: Status Banner */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                الحالة المباشرة لدورة {activeMember}
              </span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${status.currentPhase.badgeColor}`}>
                {status.currentPhase.icon} {status.currentPhase.title}
              </span>
            </div>

            {status.isCurrentlyInPeriod ? (
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <span>الدورة نشطة حالياً 🌸</span>
                </h4>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-1">
                  أنتِ في <span className="text-rose-600 dark:text-rose-400 font-black text-base">اليوم {status.currentPeriodDay}</span> من أصل {status.periodDuration} أيام (متبقي {status.periodDaysRemaining} {status.periodDaysRemaining === 1 ? "يوم" : "أيام"})
                </p>
              </div>
            ) : status.isDueToday ? (
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-300">
                  اليوم هو الموعد المتوقع لبدء الدورة 🌸
                </h4>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  إذا بدأت بالفعل، يمكنك تأكيدها بنقرة واحدة عبر الزر بالأسفل.
                </p>
              </div>
            ) : status.isDueTomorrow ? (
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-300">
                  الموعد المتوقع غداً! ⏰
                </h4>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1">
                  تنبيه استباقي: موعد الدورة يبدأ غداً بإذن الله، احرصي على الراحة وتجهيز مستلزماتك 🌸
                </p>
              </div>
            ) : status.isLate ? (
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-orange-600 dark:text-orange-300">
                  متأخرة بـ {status.daysLate} {status.daysLate === 1 ? "يوم" : "أيام"} ⏳
                </h4>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  كان الموعد المتوقع في {formatArabicFriendlyDate(status.nextPeriodDate)}. إذا بدأت في يوم آخر يمكنك تصحيحه فوراً بالأسفل.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">
                    {Math.max(0, status.daysUntilNextPeriod)}
                  </span>
                  <span className="text-sm font-bold text-gray-500">يوم متبقي على الموعد القادم</span>
                </div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1">
                  الموعد المتوقع: <span className="font-black text-pink-600 dark:text-pink-400">{formatArabicFriendlyDate(status.nextPeriodDate, true)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Col 2: Progress & Cycle Day */}
          <div className="bg-pink-50/60 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-pink-200/60 dark:border-zinc-700 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
                <span>اليوم من الدورة:</span>
                <span className="font-black text-gray-900 dark:text-white text-sm">
                  اليوم {status.cycleDay} من {status.cycleLength}
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mt-2">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-600 rounded-full transition-all duration-500"
                  style={{ width: `${status.progressPercentage}%` }}
                />
              </div>
            </div>

            <div className="mt-2 text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center justify-between pt-2 border-t border-pink-100 dark:border-zinc-700/60">
              <span>نافذة الخصوبة والتبويض:</span>
              <span>{formatArabicFriendlyDate(status.fertileWindow.start)}</span>
            </div>
          </div>

        </div>

        {/* ─── DIRECT INLINE START DATE EDITING SECTION (تعديل تاريخ بداية الدورة مباشرة هنا) ─── */}
        <div className="pt-4 mt-2 bg-gradient-to-r from-pink-50/50 via-rose-50/30 to-purple-50/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 p-4 rounded-2xl border border-pink-200/80 dark:border-zinc-800">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 flex items-center justify-center shrink-0">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white">
                  تعديل تاريخ بداية دورة {activeMember} مباشرة (إذا أخطأتِ في التاريخ):
                </h5>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  يمكنكِ اختيار التاريخ الصحيح أو النقر على أزرار اليوم/أمس لتحديث الحسابات فوراً:
                </p>
              </div>
            </div>

            {/* Quick Preset Buttons: اليوم | أمس | قبل يومين */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-gray-400">اختيار سريع:</span>
              <button
                type="button"
                onClick={() => handleQuickPresetDate(0)}
                disabled={isSaving}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-pink-50 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-zinc-700 cursor-pointer transition active:scale-95"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickPresetDate(1)}
                disabled={isSaving}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-pink-50 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-zinc-700 cursor-pointer transition active:scale-95"
              >
                أمس
              </button>
              <button
                type="button"
                onClick={() => handleQuickPresetDate(2)}
                disabled={isSaving}
                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 hover:bg-pink-50 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-zinc-700 cursor-pointer transition active:scale-95"
              >
                قبل يومين
              </button>
            </div>

          </div>

          {/* Date Picker Input & Confirm Button */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 relative">
              <input
                type="date"
                value={inlineDate}
                onChange={(e) => setInlineDate(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border-2 border-pink-300 dark:border-pink-800 rounded-xl px-4 py-2.5 text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500 shadow-xs"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSaveInlineDate()}
              disabled={isSaving || !inlineDate}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                isDateModified
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25 animate-pulse"
                  : "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-pink-500/25"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isDateModified ? "تأكيد وحفظ التاريخ الجديد ✨" : "حفظ التاريخ"}</span>
            </button>

            <button
              type="button"
              onClick={handleQuickLogToday}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 font-black text-xs hover:bg-pink-50 dark:hover:bg-zinc-700 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Flower2 className="w-4 h-4" />
              <span>بدأت اليوم 🌸</span>
            </button>
          </div>

          <div className="mt-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>التاريخ المحفوظ حالياً: <strong className="text-gray-800 dark:text-gray-200">{formatArabicFriendlyDate(status.lastPeriodDate)}</strong></span>
            {activeMember === "إيمان" && (
              <button
                type="button"
                onClick={() => setShowSimulateAlert(true)}
                className="text-pink-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Info className="w-3 h-3" />
                <span>معاينة إشعار إيمان الخاص</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* ─── SECTION 2: UPCOMING CYCLES FORECAST (جدول التنبؤ بالدورات القادمة - ظاهر دائماً) ─── */}
      <div className="relative z-10 bg-white/95 dark:bg-zinc-900/95 rounded-3xl p-5 sm:p-6 border border-purple-200/80 dark:border-purple-900/50 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>جدول التنبؤ بالمواعيد القادمة لـ {activeMember}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                  6 أشهر قادمة
                </span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                مواعيد محسوبة بيولوجياً لكل دورة مع موعد ذروة التبويض ونافذة الخصوبة
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold text-gray-400 self-start sm:self-auto">
            دورة كل {settings.cycleLength} يوماً • مدة نزول {settings.periodDuration} أيام
          </span>
        </div>

        {/* 6 Predictions Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {status.predictedCycles.map((pred, idx) => (
            <div
              key={pred.cycleIndex || idx}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                idx === 0
                  ? "bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-white dark:to-zinc-900 border-pink-300 dark:border-pink-800 shadow-md ring-2 ring-pink-400/20"
                  : "bg-gray-50/80 dark:bg-zinc-950/80 border-gray-200/80 dark:border-zinc-800 hover:border-pink-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                    الدورة القادمة #{pred.cycleIndex}
                  </span>
                  <span className="text-xs font-black text-gray-600 dark:text-gray-300">
                    {pred.statusLabel}
                  </span>
                </div>

                <h5 className="text-sm font-black text-gray-900 dark:text-white mt-2">
                  دورة {pred.monthName}
                </h5>

                <div className="mt-2.5 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-bold">البداية المتوقعة:</span>
                    <span className="font-black text-pink-600 dark:text-pink-400">
                      {formatArabicFriendlyDate(pred.startDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-bold">الانتهاء المتوقع:</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      {formatArabicFriendlyDate(pred.endDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800 text-[11px]">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">ذروة التبويض:</span>
                    <span className="font-black text-purple-700 dark:text-purple-300">
                      {formatArabicFriendlyDate(pred.ovulationDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] font-medium text-gray-400 dark:text-gray-500 flex items-center justify-between">
                <span>الخصوبة: {formatArabicFriendlyDate(pred.fertileWindowStart)} - {formatArabicFriendlyDate(pred.fertileWindowEnd)}</span>
                <span>🌸</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ─── SECTION 3: CYCLE HISTORY (سجل الدورات السابقة مع أزرار التعديل والحذف) ─── */}
      <div className="relative z-10 bg-white/95 dark:bg-zinc-900/95 rounded-3xl p-5 sm:p-6 border border-pink-200/80 dark:border-pink-900/50 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>سجل دورات {activeMember} السابقة</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
                  {settings.history?.length || 0} دورات مسجلة
                </span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                يمكنكِ تعديل أي دورة سابقة أو حذف أي تسجيل خاطئ بنقرة واحدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewPeriodDate(formatToDateString(new Date()));
              setShowNewPeriodModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-xs shadow-xs active:scale-95 transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة دورة سابقة للسجل</span>
          </button>
        </div>

        {(settings.history || []).length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-zinc-950 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-800">
            <Flower2 className="w-8 h-8 text-pink-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500">
              لا توجد دورات مسجلة في السجل بعد. يمكنك تسجيل دورة عبر الزر بالأعلى.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(settings.history || []).map((h, idx) => (
              <div 
                key={h.id || idx}
                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-950 border border-gray-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-pink-300 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-950/80 text-pink-600 flex items-center justify-center shrink-0 border border-pink-200 dark:border-pink-900">
                    🌸
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {formatArabicFriendlyDate(h.startDate)}
                      </span>
                      <span className="text-[11px] font-bold text-pink-700 bg-pink-100 dark:bg-pink-950/80 px-2 py-0.5 rounded-lg border border-pink-200 dark:border-pink-800">
                        {h.duration} أيام
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-200">
                          الدورة الأحدث
                        </span>
                      )}
                    </div>
                    {h.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        {h.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Edit and Delete Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEditingHistoryItem(h)}
                    className="p-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-pink-50 dark:hover:bg-pink-950/50 text-gray-600 dark:text-gray-300 hover:text-pink-600 border border-gray-200 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="تعديل هذا السجل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHistoryItem(h.id)}
                    className="p-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-gray-600 dark:text-gray-300 hover:text-rose-600 border border-gray-200 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="حذف هذا السجل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ─── MODAL 1: Log Period with Custom Date ─── */}
      {showNewPeriodModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-pink-100 dark:border-pink-900 shadow-2xl relative text-right" dir="rtl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 flex items-center justify-center">
                  <Flower2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  تسجيل دورة جديدة لـ {activeMember} 🌸
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPeriodModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogNewPeriod} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  تاريخ بداية الدورة:
                </label>
                <input
                  type="date"
                  value={newPeriodDate}
                  onChange={(e) => setNewPeriodDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  مدة النزول المتوقعة (بالأيام):
                </label>
                <input
                  type="number"
                  min="2"
                  max="14"
                  value={newPeriodDuration}
                  onChange={(e) => setNewPeriodDuration(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="مثال: دورة شهر تشرين الثاني، أعراض خفيفة..."
                  value={newPeriodNotes}
                  onChange={(e) => setNewPeriodNotes(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPeriodModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-xs shadow-md shadow-pink-500/20 active:scale-95 transition"
                >
                  {isSaving ? "جاري التسجيل..." : "تأكيد التسجيل 🌸"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Edit History Item ─── */}
      {editingHistoryItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-pink-100 dark:border-pink-900 shadow-2xl relative text-right" dir="rtl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-pink-600" />
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  تعديل سجل الدورة السابقة ✏️
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingHistoryItem(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHistoryItem} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  تاريخ البداية:
                </label>
                <input
                  type="date"
                  value={editingHistoryItem.startDate}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, startDate: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  مدة النزول (أيام):
                </label>
                <input
                  type="number"
                  min="2"
                  max="14"
                  value={editingHistoryItem.duration}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, duration: Number(e.target.value) })}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات:
                </label>
                <input
                  type="text"
                  value={editingHistoryItem.notes || ""}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, notes: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500/30"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHistoryItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black text-xs shadow-md shadow-pink-500/20 active:scale-95 transition"
                >
                  {isSaving ? "جاري الحفظ..." : "حفظ التعديل ✨"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: General Settings Form ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-pink-100 dark:border-pink-900 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar text-right" dir="rtl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  إعدادات دورة {activeMember} ⚙️
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

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                  مدة النزول (عدد أيام الدورة):
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
                  <span className="text-xs font-bold text-gray-500 shrink-0">أيام</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">الافتراضي: 5 أيام</p>
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
                  <span className="text-xs font-bold text-gray-500 shrink-0">يوماً</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">الافتراضي: 28 يوماً</p>
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
                    * يتم إرسال التنبيه قبل يوم وأثناء أيام الدورة لحساب إيمان فور تسجيل الدخول.
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

      {/* ─── MODAL 4: Simulation Alert Preview for Iman ─── */}
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
                  🌸 <strong className="text-pink-600">صباح الخير إيمان:</strong> باقي {status.daysUntilNextPeriod} يوم على موعد الدورة القادمة (المتوقع {formatArabicFriendlyDate(status.nextPeriodDate)}). يومكِ سعيد ومليء بالطاقة والإشراق ✨.
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
