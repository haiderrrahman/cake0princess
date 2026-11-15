"use client";

/**
 * متابعة الدورة الشهرية — واجهة مبنية على محرك cycleEngine.
 *
 * ما تغيّر عن النسخة السابقة:
 *  - لا تواريخ وهمية افتراضية؛ تبدأ فارغة حتى تُسجَّل دورة حقيقية.
 *  - طول الدورة ومدة الحيض يُحسبان من السجل الفعلي.
 *  - تسجيل «بدأت» ثم «انتهت» بدل تخمين مدة ثابتة.
 *  - التوقع يُعرض كنطاق، والخصوبة موسومة بأنها تقديرية.
 *  - ملاحظات صحية عند الخروج عن الحدود المتعارف عليها طبياً.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Info,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { customConfirm } from "@/lib/customConfirm";
import {
  CYCLE_MEMBERS,
  CycleInsight,
  CycleMemberName,
  CycleMemberSettings,
  FLOW_LABELS,
  FlowLevel,
  PAIN_LABELS,
  PainLevel,
  PeriodEntry,
  PhaseKey,
  SYMPTOM_OPTIONS,
  addDaysToDateString,
  buildDayMarks,
  calculateCycleStatus,
  confirmAllEntries,
  daysLabel,
  deleteEntry,
  diffInDays,
  emptyCycleSettings,
  endPeriod,
  entryDuration,
  formatArabicFriendlyDate,
  formatArabicShortDate,
  formatToDateString,
  getArabicMonthYear,
  isUnconfirmedSeed,
  MutationResult,
  normalizeMemberName,
  parseDateString,
  removeUnconfirmedEntries,
  saveMemberCycleSettings,
  startPeriod,
  subscribeToMemberCycleSettings,
  todayString,
  upsertEntry,
} from "@/lib/cycleTracker";

interface WomenCycleCareProps {
  currentMember: "إيمان" | "رقية" | string;
  onMemberChange?: (member: "إيمان" | "رقية") => void;
  /** غير مستخدم حالياً؛ مُبقى للتوافق مع الاستدعاءات القديمة */
  isImanLoggedIn?: boolean;
}

const PHASES: Record<PhaseKey, { label: string; hint: string; chip: string }> = {
  unknown: { label: "لا توجد بيانات", hint: "", chip: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300" },
  menstrual: {
    label: "أيام الحيض",
    hint: "الراحة والسوائل والدفء تساعد. الأطعمة الغنية بالحديد تعوّض ما يُفقد.",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  follicular: {
    label: "بعد الحيض (الطور الجُريبي)",
    hint: "الطاقة ترتفع تدريجياً في هذه الأيام عادةً.",
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  },
  fertile: {
    label: "نافذة الخصوبة (تقديرية)",
    hint: "تقدير بالتقويم فقط؛ يوم الإباضة الفعلي قد يتقدم أو يتأخر.",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  },
  luteal: {
    label: "قبل الدورة (الطور الأصفري)",
    hint: "قد تظهر أعراض ما قبل الدورة: انتفاخ، تعب، تقلب مزاج. النوم الكافي وتقليل الملح والكافيين يخففها.",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  late: {
    label: "بانتظار الدورة",
    hint: "تجاوزنا الموعد المتوقع. سجّلي البداية حال نزولها.",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
};

const WEEK_DAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"]; // الأسبوع يبدأ السبت

const card = "bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl shadow-sm";
const inputCls =
  "w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-400";

export default function WomenCycleCare({ currentMember, onMemberChange }: WomenCycleCareProps) {
  const [activeMember, setActiveMember] = useState<CycleMemberName>(() => normalizeMemberName(currentMember));
  const [settings, setSettings] = useState<CycleMemberSettings>(() => emptyCycleSettings(normalizeMemberName(currentMember)));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(() => todayString());

  const [entryModal, setEntryModal] = useState<{ entry: PeriodEntry | null } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => todayString().slice(0, 7));

  useEffect(() => {
    if (currentMember) setActiveMember(normalizeMemberName(currentMember));
  }, [currentMember]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setSettings(emptyCycleSettings(activeMember));
    return subscribeToMemberCycleSettings(activeMember, (next, meta) => {
      setSettings(next);
      setLoading(meta.loading);
      setLoadError(meta.error);
    });
  }, [activeMember]);

  // تحديث «اليوم» إذا بقيت الصفحة مفتوحة بعد منتصف الليل
  useEffect(() => {
    const t = setInterval(() => setToday(todayString()), 60_000);
    return () => clearInterval(t);
  }, []);

  const insight = useMemo(() => calculateCycleStatus(settings, today), [settings, today]);

  const switchMember = (m: CycleMemberName) => {
    setActiveMember(m);
    onMemberChange?.(m);
  };

  /** تطبيق تعديل على السجل ثم حفظه؛ عند فشل الحفظ نرجع للحالة السابقة */
  const apply = async (result: MutationResult, successMsg: string): Promise<boolean> => {
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    const previous = settings;
    setSettings(result.settings);
    setSaving(true);
    try {
      await saveMemberCycleSettings(result.settings);
      toast.success(successMsg);
      return true;
    } catch (err: any) {
      setSettings(previous);
      toast.error(`لم يُحفظ التعديل: ${err?.message || "خطأ غير معروف"}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStartToday = () => apply(startPeriod(settings, today, today), "تم تسجيل بداية الدورة");

  const handleEndToday = () => {
    if (!insight.currentEntryId) return;
    apply(endPeriod(settings, insight.currentEntryId, today, today), "تم تسجيل انتهاء الدورة");
  };

  const handleDelete = async (entry: PeriodEntry) => {
    const ok = await customConfirm(`حذف دورة ${formatArabicFriendlyDate(entry.startDate)} من السجل؟`, {
      confirmText: "حذف",
      cancelText: "إلغاء",
    });
    if (ok) apply(deleteEntry(settings, entry.id), "تم الحذف");
  };

  // الحيض الأخير مفتوح (بلا تاريخ انتهاء)
  const latestEntry = settings.history[0] || null;
  const latestIsOpen = !!latestEntry && !latestEntry.endDate;

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* ── الترويسة ── */}
      <div className={`${card} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">متابعة الدورة الشهرية</h2>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              تسجيل، توقع مبني على السجل، وملاحظات صحية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-zinc-800">
            {CYCLE_MEMBERS.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => switchMember(m.name)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${
                  activeMember === m.name
                    ? "bg-white dark:bg-zinc-950 text-rose-600 dark:text-rose-300 shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="الإعدادات"
            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs font-bold text-rose-700 dark:text-rose-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>تعذر تحميل البيانات: {loadError}</span>
        </div>
      )}

      {loading ? (
        <div className={`${card} p-10 flex justify-center`}>
          <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
        </div>
      ) : (
        <>
          {insight.unconfirmedCount > 0 && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200 leading-relaxed">
                يوجد {insight.unconfirmedCount === 1 ? "سجل واحد أضافه" : `${insight.unconfirmedCount} سجلات أضافها`} النظام
                القديم تلقائياً كقيم افتراضية. إذا كانت التواريخ صحيحة أكّديها، وإلا احذفيها حتى لا تُبنى التوقعات على
                بيانات غير حقيقية.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => apply(confirmAllEntries(settings), "تم تأكيد السجلات")}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition disabled:opacity-60"
                >
                  التواريخ صحيحة
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => apply(removeUnconfirmedEntries(settings), "تم حذف السجلات الافتراضية")}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-black transition disabled:opacity-60"
                >
                  احذفيها
                </button>
              </div>
            </div>
          )}

          <StatusCard
            member={activeMember}
            insight={insight}
            saving={saving}
            latestIsOpen={latestIsOpen}
            onStartToday={handleStartToday}
            onEndToday={handleEndToday}
            onLogOther={() => setEntryModal({ entry: null })}
            onEditCurrent={() => latestEntry && setEntryModal({ entry: latestEntry })}
          />

          {insight.isConfigured && <KeyDates insight={insight} />}

          <MonthCalendar
            settings={settings}
            insight={insight}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
          />

          {insight.isConfigured && <StatsCard insight={insight} />}

          {insight.healthNotes.length > 0 && (
            <div className={`${card} p-4`}>
              <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white mb-3">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                ملاحظات صحية
              </h3>
              <ul className="space-y-2">
                {insight.healthNotes.map((n, i) => (
                  <li
                    key={i}
                    className={`rounded-2xl p-3 border ${
                      n.level === "attention"
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/50"
                        : "bg-gray-50 border-gray-100 dark:bg-zinc-800/60 dark:border-zinc-800"
                    }`}
                  >
                    <p
                      className={`text-xs font-black ${
                        n.level === "attention" ? "text-orange-800 dark:text-orange-200" : "text-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">{n.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <HistoryList
            settings={settings}
            insight={insight}
            onAdd={() => setEntryModal({ entry: null })}
            onEdit={(entry) => setEntryModal({ entry })}
            onDelete={handleDelete}
          />

          <p className="px-2 text-[10px] font-medium leading-relaxed text-gray-400 dark:text-gray-500">
            هذه الصفحة للتوعية والمتابعة الشخصية وليست تشخيصاً طبياً. التوقعات وأيام الخصوبة تقديرات بالتقويم ولا يُعتمد
            عليها لمنع الحمل. عند نزيف غزير جداً، ألم شديد، أو انقطاع طويل راجعي طبيبة نسائية.
          </p>
        </>
      )}

      {entryModal && (
        <EntryModal
          entry={entryModal.entry}
          today={today}
          saving={saving}
          onClose={() => setEntryModal(null)}
          onSave={async (draft) => {
            const ok = await apply(upsertEntry(settings, draft, today), entryModal.entry ? "تم حفظ التعديل" : "تم تسجيل الدورة");
            if (ok) setEntryModal(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          insight={insight}
          saving={saving}
          onClose={() => setShowSettings(false)}
          onSave={async (patch) => {
            const ok = await apply({ settings: { ...settings, ...patch } }, "تم حفظ الإعدادات");
            if (ok) setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── بطاقة الحالة ─────────────────────────

function StatusCard({
  member,
  insight,
  saving,
  latestIsOpen,
  onStartToday,
  onEndToday,
  onLogOther,
  onEditCurrent,
}: {
  member: string;
  insight: CycleInsight;
  saving: boolean;
  latestIsOpen: boolean;
  onStartToday: () => void;
  onEndToday: () => void;
  onLogOther: () => void;
  onEditCurrent: () => void;
}) {
  const phase = PHASES[insight.phase];

  let headline = "لا توجد دورة مسجَّلة بعد";
  let sub = `سجّلي تاريخ بداية آخر دورة لـ${member} لتبدأ المتابعة.`;

  if (insight.isConfigured) {
    if (insight.isCurrentlyInPeriod) {
      headline = `اليوم ${insight.currentPeriodDay} من الحيض`;
      sub = insight.needsEndConfirmation
        ? "تجاوزت المدة المعتادة. سجّلي الانتهاء عند توقف النزول."
        : insight.periodDaysRemaining > 0
        ? `المتوقع أن يستمر ${daysLabel(insight.periodDaysRemaining)} أخرى تقريباً.`
        : "اليوم هو آخر يوم متوقع.";
    } else if (insight.isLate) {
      headline = `متأخرة ${daysLabel(insight.daysLate)}`;
      sub = `الموعد المتوقع كان ${formatArabicFriendlyDate(insight.nextPeriodDate, true)}.`;
    } else if (insight.isDueToday) {
      headline = "الدورة متوقعة اليوم";
      sub = "سجّلي البداية حال نزولها.";
    } else {
      headline = `الدورة القادمة بعد ${daysLabel(insight.daysUntilNextPeriod)}`;
      sub = `الأرجح ${formatArabicFriendlyDate(insight.nextPeriodDate, true)}.`;
    }
  }

  const progress = insight.isConfigured
    ? Math.min(100, Math.max(3, Math.round((insight.cycleDay / Math.max(insight.cycleLength, 1)) * 100)))
    : 0;

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-black ${phase.chip}`}>{phase.label}</span>
          <h3 className="mt-2 text-2xl font-black text-gray-900 dark:text-white leading-tight">{headline}</h3>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">{sub}</p>
        </div>
        {insight.isConfigured && (
          <div className="text-center shrink-0">
            <p className="text-[10px] font-bold text-gray-400">يوم الدورة</p>
            <p className="text-3xl font-black text-rose-500 leading-none mt-1">{insight.cycleDay}</p>
            <p className="text-[10px] font-bold text-gray-400 mt-1">من ~{insight.cycleLength}</p>
          </div>
        )}
      </div>

      {insight.isConfigured && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${insight.isLate ? "bg-orange-400" : "bg-rose-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {phase.hint && <p className="mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">{phase.hint}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {insight.isCurrentlyInPeriod && latestIsOpen ? (
          <button
            type="button"
            disabled={saving}
            onClick={onEndToday}
            className="flex-1 min-w-[150px] px-4 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> انتهت الدورة اليوم
          </button>
        ) : !insight.isCurrentlyInPeriod ? (
          <button
            type="button"
            disabled={saving}
            onClick={onStartToday}
            className="flex-1 min-w-[150px] px-4 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-black transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Droplet className="w-4 h-4" /> بدأت الدورة اليوم
          </button>
        ) : null}

        {insight.isConfigured && (insight.isCurrentlyInPeriod || insight.needsEndConfirmation) && (
          <button
            type="button"
            onClick={onEditCurrent}
            className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 text-sm font-black transition hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" /> {latestIsOpen ? "تسجيل الانتهاء / التفاصيل" : "تفاصيل هذه الدورة"}
          </button>
        )}

        <button
          type="button"
          onClick={onLogOther}
          className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 text-sm font-black transition hover:bg-gray-200 dark:hover:bg-zinc-700 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> تسجيل بتاريخ آخر
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── التواريخ المهمة ─────────────────────────

function KeyDates({ insight }: { insight: CycleInsight }) {
  const sameRange = insight.nextPeriodEarliest === insight.nextPeriodLatest;
  const hidePrediction = insight.daysLate > 14;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className={`${card} p-4`}>
        <p className="text-[11px] font-bold text-gray-400">الدورة القادمة (الأرجح)</p>
        <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">
          {formatArabicFriendlyDate(insight.nextPeriodDate, true)}
        </p>
        <p className="mt-1 text-[11px] font-bold text-rose-500">
          {sameRange
            ? "لا تفاوت في الدورات المسجَّلة"
            : `المدى: ${formatArabicShortDate(insight.nextPeriodEarliest)} – ${formatArabicShortDate(insight.nextPeriodLatest)}`}
        </p>
      </div>

      <div className={`${card} p-4`}>
        <p className="text-[11px] font-bold text-gray-400">نافذة الخصوبة (تقديرية)</p>
        {insight.fertileWindow && !hidePrediction ? (
          <>
            <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">
              {formatArabicShortDate(insight.fertileWindow.start)} – {formatArabicShortDate(insight.fertileWindow.end)}
            </p>
            <p className="mt-1 text-[11px] font-bold text-violet-500">
              الإباضة التقديرية: {formatArabicShortDate(insight.ovulationDate || "")}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">لا يمكن تقديرها من البيانات الحالية</p>
        )}
      </div>

      <div className={`${card} p-4`}>
        <p className="text-[11px] font-bold text-gray-400">آخر دورة</p>
        <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">
          {formatArabicFriendlyDate(insight.lastPeriodDate, true)}
        </p>
        <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">قبل {daysLabel(insight.daysSinceLastPeriod)}</p>
      </div>
    </div>
  );
}

// ───────────────────────── التقويم ─────────────────────────

function MonthCalendar({
  settings,
  insight,
  month,
  onMonthChange,
}: {
  settings: CycleMemberSettings;
  insight: CycleInsight;
  month: string; // YYYY-MM
  onMonthChange: (m: string) => void;
}) {
  const first = `${month}-01`;
  const firstDate = parseDateString(first);
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
  const last = addDaysToDateString(first, daysInMonth - 1);
  // إزاحة أول يوم بحيث يبدأ الأسبوع السبت
  const offset = (firstDate.getDay() + 1) % 7;

  const marks = useMemo(() => buildDayMarks(settings, insight, first, last), [settings, insight, first, last]);

  const shift = (delta: number) => {
    const d = new Date(firstDate.getFullYear(), firstDate.getMonth() + delta, 1, 12);
    onMonthChange(formatToDateString(d).slice(0, 7));
  };

  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDaysToDateString(first, i)),
  ];

  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
          <CalendarDays className="w-4 h-4 text-rose-500" />
          {getArabicMonthYear(first)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="الشهر السابق"
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-gray-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(insight.today.slice(0, 7))}
            className="px-2.5 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 text-[11px] font-black text-gray-600 dark:text-gray-300"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="الشهر التالي"
            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-[10px] font-black text-gray-400 py-1">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />;
          const m = marks[date] || {};
          const isToday = date === insight.today;
          let cls = "text-gray-700 dark:text-gray-200";
          if (m.period) cls = "bg-rose-500 text-white";
          else if (m.predicted) cls = "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-dashed border-rose-300 dark:border-rose-800";
          else if (m.ovulation) cls = "bg-violet-500 text-white";
          else if (m.fertile) cls = "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300";
          return (
            <div
              key={date}
              className={`aspect-square max-h-11 rounded-xl flex items-center justify-center text-xs font-black ${cls} ${
                isToday ? "ring-2 ring-offset-1 ring-gray-900 dark:ring-white dark:ring-offset-zinc-900" : ""
              }`}
              title={formatArabicFriendlyDate(date, true)}
            >
              {Number(date.slice(8))}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
        <Legend swatch="bg-rose-500" label="حيض مسجَّل" />
        <Legend swatch="bg-rose-50 dark:bg-rose-950/40 border border-dashed border-rose-300" label="حيض متوقع" />
        <Legend swatch="bg-violet-100 dark:bg-violet-950/50" label="خصوبة تقديرية" />
        <Legend swatch="bg-violet-500" label="إباضة تقديرية" />
        <Legend swatch="ring-2 ring-gray-900 dark:ring-white" label="اليوم" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded ${swatch}`} />
      {label}
    </span>
  );
}

// ───────────────────────── الإحصاءات ─────────────────────────

function StatsCard({ insight }: { insight: CycleInsight }) {
  const { stats } = insight;
  const cycleOk = stats.avgCycle >= 21 && stats.avgCycle <= 35;
  const periodOk = stats.avgPeriod <= 7;
  const confidence = { low: "منخفضة", medium: "متوسطة", high: "جيدة" }[stats.confidence];

  const items = [
    {
      label: "متوسط طول الدورة",
      value: `${stats.avgCycle} يوماً`,
      note: stats.basis === "manual" ? "مُدخل يدوياً" : cycleOk ? "ضمن المعتاد (21–35)" : "خارج المعتاد (21–35)",
      ok: stats.basis === "manual" || cycleOk,
    },
    {
      label: "متوسط مدة الحيض",
      value: daysLabel(stats.avgPeriod),
      note: periodOk ? "ضمن المعتاد (2–7)" : "أطول من المعتاد (2–7)",
      ok: periodOk,
    },
    {
      label: "أقصر / أطول دورة",
      value: stats.sampleSize > 0 ? `${stats.minCycle} / ${stats.maxCycle}` : "—",
      note: stats.sampleSize > 0 ? `من آخر ${stats.sampleSize === 1 ? "دورة" : `${stats.sampleSize} دورات`}` : "لا يوجد سجل كافٍ",
      ok: true,
    },
    { label: "دقة التوقع", value: confidence, note: "تزيد مع كل دورة تُسجَّل", ok: true },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.label} className={`${card} p-3.5`}>
          <p className="text-[11px] font-bold text-gray-400">{it.label}</p>
          <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{it.value}</p>
          <p className={`mt-0.5 text-[10px] font-bold ${it.ok ? "text-gray-500 dark:text-gray-400" : "text-orange-600 dark:text-orange-300"}`}>
            {it.note}
          </p>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── السجل ─────────────────────────

function HistoryList({
  settings,
  insight,
  onAdd,
  onEdit,
  onDelete,
}: {
  settings: CycleMemberSettings;
  insight: CycleInsight;
  onAdd: () => void;
  onEdit: (e: PeriodEntry) => void;
  onDelete: (e: PeriodEntry) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const history = settings.history;
  const visible = showAll ? history : history.slice(0, 6);

  // طول الدورة التي بدأت بكل سجل = الفرق حتى بداية السجل التالي زمنياً
  const lengthByStart = useMemo(() => {
    const map: Record<string, number> = {};
    insight.stats.cycles.forEach((c) => (map[c.startDate] = c.length));
    return map;
  }, [insight.stats.cycles]);

  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">
          سجل الدورات {history.length > 0 && <span className="text-gray-400 font-bold">({history.length})</span>}
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-black flex items-center gap-1 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition"
        >
          <Plus className="w-3.5 h-3.5" /> إضافة
        </button>
      </div>

      {history.length === 0 ? (
        <p className="py-6 text-center text-xs font-bold text-gray-400">لا توجد دورات مسجَّلة.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
          {visible.map((h) => {
            const dur = entryDuration(h);
            const len = lengthByStart[h.startDate];
            const lenOdd = len !== undefined && (len < 21 || len > 35);
            return (
              <li key={h.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    {formatArabicFriendlyDate(h.startDate, true)}
                    {isUnconfirmedSeed(h) && (
                      <span className="mr-2 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-black align-middle">
                        غير مؤكد
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300">
                      {dur ? `الحيض ${daysLabel(dur)}` : "لم يُسجَّل الانتهاء"}
                    </span>
                    {len !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          lenOdd
                            ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                            : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        طول الدورة {len} يوماً
                      </span>
                    )}
                    {h.flow && (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                        النزول {FLOW_LABELS[h.flow]}
                      </span>
                    )}
                    {h.pain !== undefined && h.pain > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                        ألم {PAIN_LABELS[h.pain]}
                      </span>
                    )}
                    {h.symptoms?.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                        {s}
                      </span>
                    ))}
                  </div>
                  {h.notes && <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{h.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(h)}
                    aria-label="تعديل"
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(h)}
                    aria-label="حذف"
                    className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-950/60 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 text-xs font-black text-gray-600 dark:text-gray-300"
        >
          {showAll ? "عرض أقل" : `عرض الكل (${history.length})`}
        </button>
      )}
    </div>
  );
}

// ───────────────────────── نافذة تسجيل/تعديل دورة ─────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto text-right">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 px-5 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between z-10">
          <h3 className="text-base font-black text-gray-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EntryModal({
  entry,
  today,
  saving,
  onClose,
  onSave,
}: {
  entry: PeriodEntry | null;
  today: string;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Omit<PeriodEntry, "id"> & { id?: string }) => void;
}) {
  const [startDate, setStartDate] = useState(entry?.startDate || today);
  const [ended, setEnded] = useState(!!entry?.endDate);
  const [endDate, setEndDate] = useState(entry?.endDate || "");
  const [flow, setFlow] = useState<FlowLevel | undefined>(entry?.flow);
  const [pain, setPain] = useState<PainLevel | undefined>(entry?.pain);
  const [symptoms, setSymptoms] = useState<string[]>(entry?.symptoms || []);
  const [notes, setNotes] = useState(entry?.notes || "");

  const duration = ended && endDate && endDate >= startDate ? diffInDays(startDate, endDate) + 1 : null;

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ended && !endDate) {
      toast.error("حدّدي تاريخ الانتهاء أو ألغي خيار «انتهت»");
      return;
    }
    onSave({
      ...(entry ? { id: entry.id, loggedAt: entry.loggedAt } : {}),
      startDate,
      ...(ended && endDate ? { endDate } : {}),
      flow,
      pain,
      symptoms,
      notes,
    });
  };

  return (
    <ModalShell title={entry ? "تعديل الدورة" : "تسجيل دورة"} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">أول يوم نزول</label>
          <input type="date" required max={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ended}
              onChange={(e) => {
                setEnded(e.target.checked);
                if (e.target.checked && !endDate) {
                  // اقتراح: 5 أيام أو اليوم أيهما أقرب
                  const guess = addDaysToDateString(startDate, 4);
                  setEndDate(guess > today ? today : guess);
                }
              }}
              className="w-4 h-4 accent-rose-500"
            />
            انتهت الدورة
          </label>
          {ended && (
            <>
              <input type="date" min={startDate} max={today} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              {duration && <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">المدة: {daysLabel(duration)}</p>}
            </>
          )}
          {!ended && (
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">اتركيها بلا تاريخ انتهاء إن كانت ما زالت مستمرة.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">كمية النزول (اختياري)</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FLOW_LABELS) as FlowLevel[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFlow(flow === f ? undefined : f)}
                className={`py-2 rounded-xl text-xs font-black border transition ${
                  flow === f
                    ? "bg-rose-500 border-rose-500 text-white"
                    : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {FLOW_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">شدة الألم (اختياري)</label>
          <div className="grid grid-cols-4 gap-2">
            {PAIN_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setPain(pain === i ? undefined : (i as PainLevel))}
                className={`py-2 rounded-xl text-[11px] font-black border transition ${
                  pain === i
                    ? "bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900"
                    : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">أعراض مرافقة (اختياري)</label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition ${
                  symptoms.includes(s)
                    ? "bg-teal-600 border-teal-600 text-white"
                    : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">ملاحظات (اختياري)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-black transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          حفظ
        </button>
      </form>
    </ModalShell>
  );
}

// ───────────────────────── نافذة الإعدادات ─────────────────────────

function SettingsModal({
  settings,
  insight,
  saving,
  onClose,
  onSave,
}: {
  settings: CycleMemberSettings;
  insight: CycleInsight;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<CycleMemberSettings>) => void;
}) {
  const [cycleLength, setCycleLength] = useState(String(settings.cycleLength));
  const [periodDuration, setPeriodDuration] = useState(String(settings.periodDuration));
  const [email, setEmail] = useState(settings.customEmail || "");
  const [notes, setNotes] = useState(settings.notes || "");

  const usingHistory = insight.stats.basis === "history";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = Math.round(Number(cycleLength));
    const p = Math.round(Number(periodDuration));
    if (!(c >= 15 && c <= 60)) {
      toast.error("طول الدورة يجب أن يكون بين 15 و60 يوماً");
      return;
    }
    if (!(p >= 1 && p <= 15)) {
      toast.error("مدة الحيض يجب أن تكون بين 1 و15 يوماً");
      return;
    }
    onSave({ cycleLength: c, periodDuration: p, customEmail: email.trim().toLowerCase(), notes: notes.trim() });
  };

  return (
    <ModalShell title={`إعدادات ${settings.memberName}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="rounded-2xl bg-gray-50 dark:bg-zinc-800/60 p-3 text-[11px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
          {usingHistory
            ? `التوقعات تُحسب الآن من السجل الفعلي (متوسط ${insight.stats.avgCycle} يوماً). القيم أدناه تُستخدم فقط إذا لم يتوفر سجل كافٍ.`
            : "لا يوجد سجل كافٍ بعد، لذلك تُستخدم القيم أدناه للتوقع حتى تُسجَّل دورتان."}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">طول الدورة المعتاد (يوم)</label>
            <input type="number" inputMode="numeric" min={15} max={60} value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">مدة الحيض المعتادة (يوم)</label>
            <input type="number" inputMode="numeric" min={1} max={15} value={periodDuration} onChange={(e) => setPeriodDuration(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">بريد الحساب الذي يستلم التذكير (اختياري)</label>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={`${inputCls} text-left`} />
          <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            التذكير (قبل الموعد بيوم، يوم الموعد، وأثناء الحيض) يظهر مرة يومياً عند الدخول بهذا الحساب فقط، ويجب أن يكون من حسابات العائلة.
          </p>
        </div>

        <div>
          <label className="block text-xs font-black text-gray-700 dark:text-gray-200 mb-1.5">ملاحظات عامة (اختياري)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          حفظ الإعدادات
        </button>
      </form>
    </ModalShell>
  );
}
