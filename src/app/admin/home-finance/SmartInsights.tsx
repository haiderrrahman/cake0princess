"use client";

/**
 * واجهات التنبؤ الذكي:
 *   • SmartForecastPanel — بطاقة الواجهة الرئيسية للمنزل
 *   • DraftInsightsList   — تحذيرات لحظية داخل نافذة إضافة مصروف
 * الحسابات كلها في expenseInsights.ts
 */

import { HomeInsights, Insight, InsightLevel } from "./expenseInsights";

const fmt = (n: number) => Math.round(n || 0).toLocaleString("en-US");

const LEVEL_STYLE: Record<InsightLevel, string> = {
  danger: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200",
  warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-200",
  tip: "bg-sky-50 border-sky-100 text-sky-900 dark:bg-sky-950/30 dark:border-sky-900/40 dark:text-sky-200",
  good: "bg-emerald-50 border-emerald-100 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-200",
};

function InsightRow({ i, compact = false }: { i: Insight; compact?: boolean }) {
  return (
    <li className={`flex items-start gap-2.5 rounded-2xl border px-3 ${compact ? "py-2" : "py-2.5"} ${LEVEL_STYLE[i.level]}`}>
      <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden>{i.icon}</span>
      <div className="min-w-0">
        <p className={`${compact ? "text-[11px]" : "text-xs"} font-black leading-snug`}>{i.title}</p>
        <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-bold opacity-80 leading-relaxed mt-0.5`}>{i.text}</p>
      </div>
    </li>
  );
}

export function SmartForecastPanel({
  data,
  onShuffle,
  className = "",
}: {
  data: HomeInsights;
  onShuffle: () => void;
  className?: string;
}) {
  const c = data.cycle;
  const nonEssential = c.optional + c.waste;
  const total = Math.max(1, c.essential + nonEssential);
  const hasData = c.spent > 0;
  const balanceTone =
    c.income <= 0 ? "text-slate-800 dark:text-white" : c.projectedBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <section className={`bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-[1.8rem] p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">🔮 التنبؤ الذكي</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            يوم {c.daysElapsed} من {c.daysTotal} بالدورة{c.hasHistory ? " · مقارنة بدوراتك السابقة" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onShuffle}
          className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition active:scale-95"
        >
          ✨ نصيحة أخرى
        </button>
      </div>

      {/* الأرقام الأساسية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Metric label="متوقع تصرف بالدورة" value={`${fmt(c.projectedSpend)}`} />
        <Metric label={c.income > 0 ? "متوقع يبقى" : "صرفت لحد الآن"} value={c.income > 0 ? fmt(c.projectedBalance) : fmt(c.spent)} tone={balanceTone} />
        <Metric label="الحد اليومي الآمن" value={c.income > 0 && c.daysLeft > 0 ? fmt(c.safeDailyLimit) : "—"} hint={c.daysLeft > 0 ? `لـ${c.daysLeft} يوم` : undefined} />
        <Metric label="معدل صرفك اليومي" value={fmt(c.dailyAvg)} />
      </div>

      {/* مهم مقابل كماليات */}
      {hasData && (
        <div className="mb-3">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
            <div className="bg-emerald-500" style={{ width: `${(c.essential / total) * 100}%` }} />
            <div className="bg-amber-400" style={{ width: `${(c.optional / total) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(c.waste / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-black text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> مهم {fmt(c.essential)}</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> مال داعي {fmt(c.optional)}</span>
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> تبذير {fmt(c.waste)}</span>
          </div>
        </div>
      )}

      {/* التحذيرات المهمة */}
      {data.alerts.length > 0 && (
        <ul className="space-y-2 mb-2">
          {data.alerts.map((i) => <InsightRow key={i.id} i={i} />)}
        </ul>
      )}

      {/* نصائح وتنبؤات متنوعة */}
      {data.tips.length > 0 && (
        <ul className="space-y-2">
          {data.tips.map((i) => <InsightRow key={i.id} i={i} compact />)}
        </ul>
      )}

      {!hasData && data.alerts.length === 0 && (
        <p className="text-xs font-bold text-slate-400 text-center py-3">سجّل مصاريف هذه الدورة حتى تبدأ التنبؤات والتحذيرات.</p>
      )}

      {/* 💸 مراقبة الأسعار */}
      {data.priceWatch.length > 0 && (
        <div className="mt-3 rounded-2xl border border-rose-100 dark:border-rose-900/40 p-3">
          <p className="text-[11px] font-black text-slate-800 dark:text-white mb-1.5">💸 مراقبة الأسعار — اشتريت أغلى من قبل</p>
          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {data.priceWatch.map((w) => {
              const better = w.cheapest < w.prev ? { price: w.cheapest, place: w.cheapestPlace } : { price: w.prev, place: w.prevPlace };
              return (
                <li key={w.name} className="py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black">
                    <span className="text-slate-800 dark:text-slate-100 truncate">{w.name}</span>
                    <span className="text-rose-600 dark:text-rose-400 shrink-0">⬆️ {w.pct}%</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    هسه {fmt(w.last)}{w.lastPlace ? ` من ${w.lastPlace}` : ""} · قبل {fmt(w.prev)}{w.prevPlace ? ` من ${w.prevPlace}` : ""}
                    {better.place && better.price < w.last && (
                      <span className="text-emerald-700 dark:text-emerald-400"> · الأفضل {fmt(better.price)} من {better.place}</span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ابتعد عنه / حافظ عليه */}
      {(data.avoid.length > 0 || data.keep.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <GroupList title="🚫 ابتعد عنه / قلّله" groups={data.avoid} tone="text-rose-600 dark:text-rose-400" empty="ماكو كماليات هذه الدورة 👏" />
          <GroupList title="✅ أساسيات حافظ عليها" groups={data.keep} tone="text-emerald-600 dark:text-emerald-400" empty="—" />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone = "text-slate-900 dark:text-white", hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-zinc-800/60 px-3 py-2">
      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm sm:text-base font-black ${tone}`}>
        {value} <span className="text-[9px] font-bold text-slate-400">{value === "—" ? "" : "د.ع"}</span>
      </p>
      {hint && <p className="text-[9px] font-bold text-slate-400">{hint}</p>}
    </div>
  );
}

function GroupList({ title, groups, tone, empty }: { title: string; groups: { label: string; amount: number; count: number }[]; tone: string; empty: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-zinc-800 p-3">
      <p className="text-[11px] font-black text-slate-800 dark:text-white mb-1.5">{title}</p>
      {groups.length === 0 ? (
        <p className="text-[10px] font-bold text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => (
            <li key={g.label} className="flex items-center justify-between gap-2 text-[11px] font-bold">
              <span className="text-slate-600 dark:text-slate-300 truncate">{g.label} <span className="text-slate-400">×{g.count}</span></span>
              <span className={`font-black shrink-0 ${tone}`}>{fmt(g.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DraftInsightsList({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1">🔮 قبل ما تحفظ</p>
      <ul className="space-y-1.5">
        {insights.map((i) => <InsightRow key={i.id} i={i} compact />)}
      </ul>
    </div>
  );
}
