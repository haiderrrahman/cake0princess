"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { normalizeArabicText } from "./productCategories";

// بحث سريع واحد بكل قوائم البيت: الموجودات، النواقص، السيارة، السفر، طلبات العائلة
// تكتب أول حروف المادة ويطلعلك وينها وشكد متوفر منها وشكد ناقص

export interface FindEntry {
  key: string;
  name: string;
  where: "البيت" | "النواقص" | "السيارة" | "السفر" | "العائلة";
  tab: "inventory" | "needs" | "car" | "travel" | "familyNeeds";
  have?: number;
  need?: number;
  unit?: string;
  extra?: string;
}

interface Props {
  entries: FindEntry[];
  onPick: (e: FindEntry) => void;
  className?: string;
}

const WHERE_STYLE: Record<FindEntry["where"], string> = {
  "البيت": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "النواقص": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "السيارة": "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "السفر": "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "العائلة": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
};

export function HouseQuickFind({ entries, onPick, className = "" }: Props) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);

  const indexed = useMemo(() => entries.map(e => ({ e, n: normalizeArabicText(e.name) })), [entries]);

  const results = useMemo(() => {
    const nq = normalizeArabicText(dq.trim());
    if (!nq) return [];
    const starts: FindEntry[] = [];
    const wordStarts: FindEntry[] = [];
    const contains: FindEntry[] = [];
    for (const { e, n } of indexed) {
      if (n.startsWith(nq)) starts.push(e);
      else if (n.split(" ").some(w => w.startsWith(nq))) wordStarts.push(e);
      else if (n.includes(nq)) contains.push(e);
    }
    return [...starts, ...wordStarts, ...contains].slice(0, 12);
  }, [dq, indexed]);

  return (
    <div dir="rtl" className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-400">
        <span className="text-lg">🔎</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="دوّر بكل البيت… (اكتب أول حروف المادة)"
          className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="text-gray-400 text-sm font-black px-1" aria-label="مسح">✕</button>
        )}
      </div>

      {q.trim() && (
        <div className="mt-2 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="p-3 text-xs font-bold text-gray-500">ما لگيت "{q.trim()}" بأي قائمة — ضيفها من زر الإضافة بالقسم.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
              {results.map(r => (
                <li key={r.key}>
                  <button type="button" onClick={() => { onPick(r); setQ(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-right hover:bg-gray-50 dark:hover:bg-zinc-800 active:scale-[0.99] transition">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${WHERE_STYLE[r.where]}`}>{r.where}</span>
                    <span className="flex-1 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{r.name}</span>
                    {r.extra && <span className="text-[10px] font-bold text-gray-400 shrink-0">{r.extra}</span>}
                    {typeof r.have === "number" && (
                      <span className={`text-[10px] font-black shrink-0 ${r.have > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {r.have > 0 ? `متوفر ${r.have}${r.unit ? " " + r.unit : ""}` : "خلصان"}
                      </span>
                    )}
                    {!!r.need && r.need > 0 && (
                      <span className="text-[10px] font-black text-orange-600 shrink-0">ناقص {r.need}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
