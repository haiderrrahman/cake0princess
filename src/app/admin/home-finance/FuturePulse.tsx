"use client";

// لوحة "المستقبل": كل هدف شكد باقيله، وشكد لازم تحوش بالشهر حتى توصل بوقتك،
// ومقارنة هذا المبلغ بالحر عندك هذه الدورة

export interface PlanLite {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string;
}

interface Props {
  plans: PlanLite[];
  freeThisCycle: number;
  activeTrips: { id: string; name: string; spent: number }[];
  onOpen: (tab: "futurePlans" | "travel") => void;
  today?: Date;
  className?: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function planMonthly(p: PlanLite, today: Date) {
  const remaining = Math.max(0, (Number(p.targetAmount) || 0) - (Number(p.savedAmount) || 0));
  const t = p.targetDate ? new Date(p.targetDate) : null;
  let months = 12;
  if (t && !isNaN(t.getTime())) {
    months = (t.getFullYear() - today.getFullYear()) * 12 + (t.getMonth() - today.getMonth());
    if (t.getDate() < today.getDate()) months -= 1;
  }
  const late = months <= 0 && remaining > 0;
  const monthly = remaining <= 0 ? 0 : Math.ceil(remaining / Math.max(1, months));
  const pct = p.targetAmount > 0 ? Math.min(100, Math.round(((Number(p.savedAmount) || 0) / p.targetAmount) * 100)) : 0;
  return { remaining, months: Math.max(0, months), monthly, late, pct };
}

export function FuturePulse({ plans, freeThisCycle, activeTrips, onOpen, today = new Date(), className = "" }: Props) {
  const rows = plans
    .map(p => ({ p, m: planMonthly(p, today) }))
    .filter(r => r.m.remaining > 0)
    .sort((a, b) => a.m.months - b.m.months);
  const needMonthly = rows.reduce((s, r) => s + r.m.monthly, 0);
  const done = plans.length - rows.length;
  const enough = freeThisCycle >= needMonthly;

  if (plans.length === 0 && activeTrips.length === 0) return null;

  return (
    <section dir="rtl" className={`rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">🚀 طريقك للأهداف</h3>
        {done > 0 && <span className="text-[11px] font-black text-emerald-600">✅ {done} هدف مكتمل</span>}
      </div>

      {rows.length > 0 && (
        <div className={`mt-3 rounded-2xl p-3 ${enough ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-amber-50 dark:bg-amber-950/40"}`}>
          <p className="text-xs font-bold text-gray-600 dark:text-gray-300">حتى توصل لكل أهدافك بوقتها لازم تحوش بالشهر</p>
          <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{fmt(needMonthly)} <span className="text-xs">د.ع</span></p>
          <p className={`text-[11px] font-black mt-0.5 ${enough ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {enough
              ? `✓ الحر عندك هذه الدورة (${fmt(freeThisCycle)}) يكفي`
              : `⚠️ الحر عندك هذه الدورة ${fmt(Math.max(0, freeThisCycle))} — ينقصك ${fmt(needMonthly - Math.max(0, freeThisCycle))}، أجّل هدف أو مدّد موعده`}
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {rows.slice(0, 4).map(({ p, m }) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen("futurePlans")} className="w-full text-right rounded-2xl border border-gray-100 dark:border-zinc-800 p-2.5 active:scale-[0.98] transition">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black text-gray-800 dark:text-gray-100">{p.title}</span>
                <span className={`text-[10px] font-black shrink-0 ${m.late ? "text-rose-600" : "text-gray-500"}`}>
                  {m.late ? "فات موعده" : `${fmt(m.monthly)} بالشهر · ${m.months} شهر`}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${m.pct}%` }} />
              </div>
              <p className="mt-1 text-[10px] font-bold text-gray-500">{m.pct}% · باقي {fmt(m.remaining)}</p>
            </button>
          </li>
        ))}
      </ul>

      {activeTrips.length > 0 && (
        <button type="button" onClick={() => onOpen("travel")} className="mt-2 w-full flex flex-wrap gap-2 text-right">
          {activeTrips.map(t => (
            <span key={t.id} className="text-[11px] font-black px-2 py-1 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              ✈️ {t.name} · صرفت {fmt(t.spent)}
            </span>
          ))}
        </button>
      )}
    </section>
  );
}
