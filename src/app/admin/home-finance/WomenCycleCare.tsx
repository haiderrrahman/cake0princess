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
  Check
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

  // Active view tab inside WomenCycleCare: "overview" | "predictions" | "history"
  const [activeTab, setActiveTab] = useState<"overview" | "predictions" | "history">("overview");

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCorrectDateModal, setShowCorrectDateModal] = useState(false);
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showSimulateAlert, setShowSimulateAlert] = useState(false);

  // Edit history item modal
  const [editingHistoryItem, setEditingHistoryItem] = useState<CycleHistoryItem | null>(null);

  // Form states for settings modal
  const [formDuration, setFormDuration] = useState<number>(settings.periodDuration || 5);
  const [formCycleLength, setFormCycleLength] = useState<number>(settings.cycleLength || 28);
  const [formLastDate, setFormLastDate] = useState<string>(settings.lastPeriodDate || formatToDateString(new Date()));
  const [formEmail, setFormEmail] = useState<string>(settings.customEmail || "");
  const [formNotes, setFormNotes] = useState<string>(settings.notes || "");
  const [isSaving, setIsSaving] = useState(false);

  // State for correcting start date
  const [correctedDate, setCorrectedDate] = useState<string>(settings.lastPeriodDate || formatToDateString(new Date()));

  // State for new custom period modal
  const [newPeriodDate, setNewPeriodDate] = useState<string>(formatToDateString(new Date()));
  const [newPeriodDuration, setNewPeriodDuration] = useState<number>(settings.periodDuration || 5);
  const [newPeriodNotes, setNewPeriodNotes] = useState<string>("");

  // Real-time subscription to active member
  useEffect(() => {
    const unsub = subscribeToMemberCycleSettings(activeMember, (newSettings) => {
      setSettings(newSettings);
      setFormDuration(newSettings.periodDuration || 5);
      setFormCycleLength(newSettings.cycleLength || 28);
      setFormLastDate(newSettings.lastPeriodDate || formatToDateString(new Date()));
      setFormEmail(newSettings.customEmail || "");
      setFormNotes(newSettings.notes || "");
      setCorrectedDate(newSettings.lastPeriodDate || formatToDateString(new Date()));
      setNewPeriodDuration(newSettings.periodDuration || 5);
    });
    return () => unsub();
  }, [activeMember]);

  // Calculate live status insights and predictions
  const status = useMemo(() => {
    return calculateCycleStatus(settings);
  }, [settings]);

  // 1. Correct / Fix Start Date (if made a mistake)
  const handleConfirmCorrectDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctedDate) {
      toast.error("يرجى اختيار تاريخ صالح");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateCycleStartDate(settings, correctedDate);
      setSettings(updated);
      setShowCorrectDateModal(false);
      toast.success(`تم تصحيح تاريخ بداية دورة ${activeMember} بنجاح إلى: ${formatArabicFriendlyDate(correctedDate)} ✨`);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ التاريخ المصحح");
    } finally {
      setIsSaving(false);
    }
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
      toast.info("تم تسجيل بداية الدورة اليوم مسبقاً 🌸 يمكنك تعديل التاريخ إذا أخطأتِ.");
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

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-purple-500/10 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-purple-950/30 border border-pink-200/80 dark:border-pink-900/50 shadow-sm p-4 sm:p-5">
      
      {/* Decorative Aura */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400/10 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/2" />

      {/* ─── Header: Member Switcher & Main Controls ─── */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 mb-4 pb-3.5 border-b border-pink-100 dark:border-pink-900/40">
        
        {/* Title & Active Member Badge */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-pink-500/20">
            <Flower2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>ركن الصحة والعناية الشهرية</span>
                <span className="text-pink-500">🌸</span>
              </h3>
              
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60 flex items-center gap-1">
                <span>{activeMember === "إيمان" ? "👩🏻 إيمان" : "👧🏻 رقية"}</span>
                {activeMember === "إيمان" && (
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping inline-block" />
                )}
              </span>
            </div>

            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
              متابعة دقيقة: {settings.periodDuration} أيام نزول • دورة كل {settings.cycleLength} يوماً • نظام تنبؤ ذكي
            </p>
          </div>
        </div>

        {/* Member Selector + Settings Cogs */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          {onMemberChange && (
            <div className="flex bg-white/90 dark:bg-zinc-900/90 p-1 rounded-2xl border border-pink-200/80 dark:border-pink-900/60 shadow-xs">
              <button
                type="button"
                onClick={() => onMemberChange("إيمان")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  activeMember === "إيمان"
                    ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400"
                }`}
              >
                <span>👩🏻 إيمان</span>
                {activeMember === "إيمان" && <Check className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => onMemberChange("رقية")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  activeMember === "رقية"
                    ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-pink-600 dark:hover:text-pink-400"
                }`}
              >
                <span>👧🏻 رقية</span>
                {activeMember === "رقية" && <Check className="w-3 h-3" />}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 hover:bg-pink-50 dark:hover:bg-pink-950/50 border border-pink-200/80 dark:border-pink-900/60 text-gray-700 dark:text-gray-300 transition shadow-xs cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="تعديل مدة الدورة وعدد الأيام"
          >
            <Settings className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            <span className="hidden sm:inline">إعدادات</span>
          </button>
        </div>
      </div>

      {/* ─── Sub-Navigation Tabs: Overview / Predictions / History ─── */}
      <div className="relative z-10 flex items-center gap-1.5 p-1 bg-white/70 dark:bg-zinc-900/70 border border-pink-200/60 dark:border-pink-900/40 rounded-2xl mb-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "overview"
              ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-pink-600"
          }`}
        >
          <Flower2 className="w-3.5 h-3.5" />
          <span>الحالة الحالية والمرحلة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("predictions")}
          className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "predictions"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-purple-600"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>التنبؤ بالمواعيد القادمة ({status.predictedCycles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "history"
              ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-pink-600"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>السجل السابق ({settings.history?.length || 0})</span>
        </button>
      </div>

      {/* ─── TAB 1: OVERVIEW & LIVE STATUS ─── */}
      {activeTab === "overview" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Main Status Cards Grid */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Card 1: Hero Status & Countdown */}
            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between transition-all ${
              status.isCurrentlyInPeriod
                ? "bg-gradient-to-br from-rose-500/20 via-pink-500/15 to-white dark:to-zinc-900 border-rose-300 dark:border-rose-800 shadow-md"
                : status.isDueTomorrow
                  ? "bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-white dark:to-zinc-900 border-amber-300 dark:border-amber-700 shadow-md animate-pulse"
                  : status.isLate
                    ? "bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-white dark:to-zinc-900 border-orange-300 dark:border-orange-800 shadow-md"
                    : "bg-white/95 dark:bg-zinc-900/95 border-pink-200/80 dark:border-pink-900/50 shadow-xs"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    الحالة اللحظية لدورة {activeMember}
                  </span>
                  <span className="text-2xl">
                    {status.isCurrentlyInPeriod ? "🌸" : status.isDueTomorrow ? "⏰" : status.isLate ? "⏳" : "🗓️"}
                  </span>
                </div>

                {status.isCurrentlyInPeriod ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <h4 className="text-base sm:text-lg font-black text-rose-700 dark:text-rose-300">
                        الدورة نشطة حالياً 🌸
                      </h4>
                    </div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1.5 leading-relaxed">
                      أنتِ الآن في <span className="text-rose-600 dark:text-rose-400 font-black text-sm">اليوم {status.currentPeriodDay}</span> من أصل {status.periodDuration} أيام
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900">
                        متبقي {status.periodDaysRemaining} {status.periodDaysRemaining === 1 ? "يوم واحد" : "أيام"} 🌿
                      </span>
                    </div>
                  </div>
                ) : status.isDueToday ? (
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
                      <span>اليوم هو الموعد المتوقع 🌸</span>
                    </h4>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1.5">
                      يمكنك تأكيد بدئها بنقرة واحدة بالأسفل
                    </p>
                  </div>
                ) : status.isDueTomorrow ? (
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-300">
                      الموعد المتوقع غداً! ⏰
                    </h4>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1.5 leading-relaxed">
                      تنبيه استباقي: موعد الدورة الشهرية يبدأ غداً بإذن الله
                    </p>
                    <span className="mt-2.5 inline-block text-[11px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-xl border border-amber-200">
                      كوني مستعدة ومرتاحة 🌸
                    </span>
                  </div>
                ) : status.isLate ? (
                  <div>
                    <h4 className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-300">
                      متأخرة بـ {status.daysLate} {status.daysLate === 1 ? "يوم" : "أيام"} ⏳
                    </h4>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                      كان الموعد المتوقع في {formatArabicFriendlyDate(status.nextPeriodDate)}. إذا بدأت، يمكنك تسجيلها فوراً أو تصحيح التاريخ.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">
                        {Math.max(0, status.daysUntilNextPeriod)}
                      </span>
                      <span className="text-xs font-bold text-gray-500">يوم متبقي</span>
                    </div>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-1">
                      على الموعد القادم: <span className="font-black text-pink-600 dark:text-pink-400">{formatArabicFriendlyDate(status.nextPeriodDate)}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Tracker */}
              <div className="mt-4 pt-3 border-t border-pink-100 dark:border-pink-900/40">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>اليوم {status.cycleDay} من الدورة ({status.cycleLength} يوم)</span>
                  <span className="font-black text-pink-600 dark:text-pink-400">{status.progressPercentage}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-pink-200/40">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${status.progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Current Biological Phase & Dates */}
            <div className="bg-white/95 dark:bg-zinc-900/95 p-4 sm:p-5 rounded-2xl border border-pink-200/80 dark:border-pink-900/50 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    المرحلة البيولوجية الحالية
                  </span>
                  <span className="text-2xl">{status.currentPhase.icon}</span>
                </div>

                <div className="mb-2">
                  <span className={`inline-block text-xs font-black px-3 py-1.5 rounded-xl border ${status.currentPhase.badgeColor}`}>
                    {status.currentPhase.title}
                  </span>
                </div>

                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                  {status.currentPhase.description}
                </p>
              </div>

              {/* Detailed Dates & Fast Edit Trigger */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-bold">بداية الدورة الحالية:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-gray-900 dark:text-white">
                      {formatArabicFriendlyDate(status.lastPeriodDate)}
                    </span>
                    {/* Quick Button to Change Start Date if Mistaken */}
                    <button
                      type="button"
                      onClick={() => {
                        setCorrectedDate(status.lastPeriodDate);
                        setShowCorrectDateModal(true);
                      }}
                      className="text-[10px] font-black text-pink-600 dark:text-pink-400 hover:text-pink-700 bg-pink-50 dark:bg-pink-950/60 px-2 py-0.5 rounded-lg border border-pink-200 dark:border-pink-800/60 transition cursor-pointer"
                      title="إذا أخطأتِ في التاريخ يمكنك تغييره هنا"
                    >
                      ✏️ تعديل
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400 font-bold">نافذة التبويض المتوقعة:</span>
                  <span className="font-black text-purple-600 dark:text-purple-400">
                    {formatArabicFriendlyDate(status.fertileWindow.start)} - {formatArabicFriendlyDate(status.fertileWindow.end)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Care, Rest & Nutrition Tips */}
            <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/70 dark:from-purple-950/20 dark:to-pink-950/20 p-4 sm:p-5 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-black text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>إرشادات العناية والراحة 🍵</span>
                  </span>
                  <span className="text-xl">✨</span>
                </div>

                <ul className="text-xs space-y-2 text-gray-700 dark:text-gray-300 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>تناول المشروبات الدافئة المهدئة (شاي القرفة، البابونج، النعناع).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>الحرص على أطعمة غنية بالحديد، المغنيسيوم، وفيتامين B6.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>الراحة الكافية وتقليل المجهود البدني الشديد خلال أول يومين.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-xs font-bold">
                <span className="text-purple-700 dark:text-purple-300 text-[11px]">
                  متابعة شخصية لـ {activeMember}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("predictions")}
                  className="text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 cursor-pointer font-black text-xs"
                >
                  <span>عرض التنبؤات القادمة</span>
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>

          </div>

          {/* ─── Hero Quick Action Buttons ─── */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 pt-1">
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Log Today */}
              <button
                type="button"
                onClick={handleQuickLogToday}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs shadow-md shadow-pink-500/25 active:scale-95 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Flower2 className="w-4 h-4" />
                <span>تسجيل بدء الدورة اليوم 🌸</span>
              </button>

              {/* Log with Custom Date */}
              <button
                type="button"
                onClick={() => {
                  setNewPeriodDate(formatToDateString(new Date()));
                  setShowNewPeriodModal(true);
                }}
                className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-pink-200 dark:border-pink-800/80 text-gray-800 dark:text-gray-200 font-bold text-xs hover:bg-pink-50 dark:hover:bg-zinc-800 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-pink-500" />
                <span>تسجيل بتاريخ مخصص...</span>
              </button>

              {/* Correct Date if Made Mistake */}
              <button
                type="button"
                onClick={() => {
                  setCorrectedDate(status.lastPeriodDate);
                  setShowCorrectDateModal(true);
                }}
                className="px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-black text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>تغيير بداية الدورة إذا خطأت ✏️</span>
              </button>
            </div>

            {/* Simulation Preview Button for Iman */}
            {activeMember === "إيمان" && (
              <button
                type="button"
                onClick={() => setShowSimulateAlert(true)}
                className="text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 bg-pink-100/70 dark:bg-pink-950/40 px-3 py-1.5 rounded-xl border border-pink-200 dark:border-pink-800/50 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>معاينة تنبيه إيمان الحصري 👁️</span>
              </button>
            )}

          </div>

        </div>
      )}

      {/* ─── TAB 2: PREDICTIONS & UPCOMING CYCLES FORECAST ─── */}
      {activeTab === "predictions" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="bg-white/90 dark:bg-zinc-900/90 p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                  جدول التنبؤ الذكي بالدورات القادمة لـ {activeMember} 🔮
                </h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                تنبؤ بيولوجي دقيق محسوب بناءً على دورة {settings.cycleLength} يوماً وفترة نزول {settings.periodDuration} أيام
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 self-start sm:self-auto">
              <span>تاريخ آخر بداية:</span>
              <span className="font-black">{formatArabicFriendlyDate(status.lastPeriodDate)}</span>
            </div>
          </div>

          {/* Predictions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {status.predictedCycles.map((pred, idx) => (
              <div
                key={pred.cycleIndex || idx}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  idx === 0
                    ? "bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-white dark:to-zinc-900 border-pink-300 dark:border-pink-800 shadow-md ring-1 ring-pink-400/30"
                    : "bg-white/90 dark:bg-zinc-900/90 border-gray-200/80 dark:border-zinc-800 hover:border-pink-300 shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                      الدورة المتوقعة #{pred.cycleIndex}
                    </span>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      {pred.statusLabel}
                    </span>
                  </div>

                  <h5 className="text-sm font-black text-gray-900 dark:text-white mt-2">
                    دورة {pred.monthName}
                  </h5>

                  <div className="mt-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-bold">تاريخ البداية:</span>
                      <span className="font-black text-pink-600 dark:text-pink-400">
                        {formatArabicFriendlyDate(pred.startDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 font-bold">تاريخ الانتهاء:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {formatArabicFriendlyDate(pred.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-zinc-800 text-[11px]">
                      <span className="text-purple-600 dark:text-purple-400 font-bold">ذروة التبويض:</span>
                      <span className="font-black text-purple-700 dark:text-purple-300">
                        {formatArabicFriendlyDate(pred.ovulationDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] font-medium text-gray-400 dark:text-gray-500 flex items-center justify-between">
                  <span>نافذة الخصوبة: {formatArabicFriendlyDate(pred.fertileWindowStart)} إلى {formatArabicFriendlyDate(pred.fertileWindowEnd)}</span>
                  <span>🌸</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Notice */}
          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-2xl border border-purple-200/60 text-xs text-purple-900 dark:text-purple-200 font-bold flex items-center gap-2">
            <Info className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              ملاحظة: يتم تحديث كافة مواعيد التنبؤ تلقائياً بمجرد تسجيل أي دورة جديدة أو تصحيح تاريخ البداية.
            </span>
          </div>

        </div>
      )}

      {/* ─── TAB 3: HISTORY & PREVIOUS CYCLES MANAGEMENT ─── */}
      {activeTab === "history" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 dark:bg-zinc-900/90 p-4 rounded-2xl border border-pink-100 dark:border-pink-900/40">
            <div>
              <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                <History className="w-5 h-5 text-pink-600" />
                <span>سجل دورات {activeMember} السابقة 📜</span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                يمكنك مراجعة السجلات، وتعديل أي تاريخ أو حذفه في حال حدوث خطأ
              </p>
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
              <span>إضافة دورة سابقة</span>
            </button>
          </div>

          {(settings.history || []).length === 0 ? (
            <div className="p-10 text-center bg-white/70 dark:bg-zinc-900/70 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-800">
              <Flower2 className="w-10 h-10 text-pink-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500">
                لا توجد دورات مسجلة في السجل حتى الآن. اضغطي على زر "إضافة دورة" للبدء.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {(settings.history || []).map((h, idx) => (
                <div 
                  key={h.id || idx}
                  className="p-3.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-gray-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-pink-300 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-50 dark:bg-pink-950/80 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100 dark:border-pink-900">
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
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setEditingHistoryItem(h)}
                      className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-pink-50 dark:hover:bg-pink-950/50 text-gray-600 dark:text-gray-300 hover:text-pink-600 transition cursor-pointer"
                      title="تعديل هذا السجل"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistoryItem(h.id)}
                      className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-gray-600 dark:text-gray-300 hover:text-rose-600 transition cursor-pointer"
                      title="حذف هذا السجل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ─── MODAL 1: Quick Correct Start Date (إذا أخطأت) ─── */}
      {showCorrectDateModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 w-full max-w-md border border-amber-200 dark:border-amber-900 shadow-2xl relative text-right" dir="rtl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  تغيير بداية الدورة (تصحيح الخطأ) ✏️
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectDateModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCorrectDate} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
                إذا سجلتِ موعداً غير دقيق أو أردتِ تقديم/تأخير بداية الدورة الحالية لـ {activeMember}، حددي التاريخ الحقيقي وسيقوم النظام بتحديث كافة الحسابات والتنبؤات فوراً:
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                  التاريخ الصحيح لبداية الدورة:
                </label>
                <input
                  type="date"
                  value={correctedDate}
                  onChange={(e) => setCorrectedDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  الموعد المسجل حالياً: {formatArabicFriendlyDate(status.lastPeriodDate)}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectDateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 text-white font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
                >
                  {isSaving ? "جاري الحفظ..." : "حفظ التاريخ المصحح ✨"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Log Period with Custom Date ─── */}
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

      {/* ─── MODAL 3: Edit History Item ─── */}
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

      {/* ─── MODAL 4: General Settings Form ─── */}
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
                <p className="text-[10px] text-gray-400 mt-0.5">الافتراضي: 5 أيام (يمكن زيادتها أو تقليلها)</p>
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

      {/* ─── MODAL 5: Simulation Alert Preview for Iman ─── */}
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
