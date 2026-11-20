"use client";

// لوحة "الراتب والأمور الخارجية": صورة واحدة واضحة لفلوس الدورة
// كم دخل، كم صرفت، كم التزامات باقية، وشكد يبقى حر فعلاً + المواعيد الجاية

export interface DueItem {
  id: string;
  kind: "فاتورة" | "قسط" | "دين";
  name: string;
  amount: number;
  daysLeft: number | null; // سالب = متأخر، null = بدون موعد
  overdueMonths?: number;
  tab: "bills" | "installments" | "debts";
}

interface Props {
  income: number;
  spent: number;
  unpaidBills: number;
  unpaidInstallments: number;
  debtsOnMe: number;
  debtsForMe: number;
  bank: number;
  cash: number;
  dues: DueItem[];
  onOpen: (tab: "income" | "bills" | "installments" | "debts") => void;
  className?: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function MoneyPulse({ income, spent, unpaidBills, unpaidInstallments, debtsOnMe, debtsForMe, bank, cash, dues, onOpen, className = "" }: Props) {
  const balance = income - spent;
  const obligations = unpaidBills + unpaidInstallments;
  const free = balance - obligations;
  const usedPct = income > 0 ? Math.min(100, Math.round((spent / income) * 100)) : 0;
  const obligPct = income > 0 ? Math.min(100 - usedPct, Math.round((obligations / income) * 100)) : 0;

  const sorted = [...dues].sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999)).slice(0, 6);

  const dueLabel = (d: DueItem) => {
    if (d.overdueMonths && d.overdueMonths > 0) return { t: `متأخر ${d.overdueMonths} شهر`, c: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" };
    if (d.daysLeft === null) return { t: "هذا الشهر", c: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300" };
    if (d.daysLeft < 0) return { t: `فات بـ${-d.daysLeft} يوم`, c: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" };
    if (d.daysLeft === 0) return { t: "اليوم", c: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
    if (d.daysLeft <= 5) return { t: `بعد ${d.daysLeft} يوم`, c: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" };
    return { t: `بعد ${d.daysLeft} يوم`, c: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" };
  };

  return (
    <section dir="rtl" className={`rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-gray-900 dark:text-white">💼 فلوس الدورة</h3>
        <span className={`text-[11px] font-black px-2 py-1 rounded-full ${free >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
          {free >= 0 ? "الوضع تمام" : "الالتزامات أكثر من المتبقي"}
        </span>
      </div>

      <div className="mt-3 text-center">
        <p className="text-[11px] font-bold text-gray-500">الحر فعلاً بعد الالتزامات الباقية</p>
        <p className={`text-3xl font-black tabular-nums ${free >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {fmt(free)} <span className="text-sm">د.ع</span>
        </p>
      </div>

      {/* شريط: مصروف | التزامات | حر */}
      <div className="mt-3 h-3 w-full rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden flex" aria-hidden>
        <div className="h-full bg-gray-700 dark:bg-gray-300" style={{ width: `${usedPct}%` }} />
        <div className="h-full bg-amber-400" style={{ width: `${obligPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-bold text-gray-500">
        <span>⬛ مصروف {usedPct}%</span>
        <span>🟨 التزامات {obligPct}%</span>
        <span>🟩 حر {Math.max(0, 100 - usedPct - obligPct)}%</span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: "الدخل", v: income, tab: "income" as const, c: "text-emerald-600 dark:text-emerald-400" },
          { l: "فواتير باقية", v: unpaidBills, tab: "bills" as const, c: "text-amber-600 dark:text-amber-400" },
          { l: "أقساط باقية", v: unpaidInstallments, tab: "installments" as const, c: "text-amber-600 dark:text-amber-400" },
          { l: "ديون عليّ", v: debtsOnMe, tab: "debts" as const, c: "text-rose-600 dark:text-rose-400" },
        ].map(k => (
          <button key={k.l} type="button" onClick={() => onOpen(k.tab)}
            className="rounded-2xl bg-gray-50 dark:bg-zinc-800/60 p-2.5 text-right active:scale-95 transition">
            <p className="text-[10px] font-bold text-gray-500">{k.l}</p>
            <p className={`text-sm font-black tabular-nums ${k.c}`}>{fmt(k.v)}</p>
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
        <span className="px-2 py-1 rounded-xl bg-gray-50 dark:bg-zinc-800/60">🏦 البنك {fmt(bank)}</span>
        <span className="px-2 py-1 rounded-xl bg-gray-50 dark:bg-zinc-800/60">💵 الكاش {fmt(cash)}</span>
        {debtsForMe > 0 && <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">🤝 إلك عند الناس {fmt(debtsForMe)}</span>}
      </div>

      {sorted.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 mb-1.5">📅 الجاي والمتأخر</p>
          <ul className="space-y-1.5">
            {sorted.map(d => {
              const lb = dueLabel(d);
              return (
                <li key={d.kind + d.id}>
                  <button type="button" onClick={() => onOpen(d.tab)}
                    className="w-full flex items-center gap-2 rounded-2xl border border-gray-100 dark:border-zinc-800 px-3 py-2 text-right active:scale-[0.98] transition">
                    <span className="text-[10px] font-black text-gray-400 w-10 shrink-0">{d.kind}</span>
                    <span className="flex-1 truncate text-xs font-bold text-gray-800 dark:text-gray-100">{d.name}</span>
                    <span className="text-xs font-black tabular-nums text-gray-700 dark:text-gray-200">{fmt(d.amount)}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${lb.c}`}>{lb.t}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
