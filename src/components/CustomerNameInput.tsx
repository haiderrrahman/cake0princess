"use client";

import { useMemo, useRef, useState } from "react";
import { CustomerSuggestion, searchCustomers } from "@/lib/socialOrders";

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** يُستدعى عند اختيار زبون من القائمة */
  onPick: (customer: CustomerSuggestion) => void;
  directory: CustomerSuggestion[];
  placeholder?: string;
  required?: boolean;
  /** تنسيق حقل الإدخال (كل نموذج يمرر تنسيقه الخاص) */
  inputClassName?: string;
  /** أقصى عدد اقتراحات */
  limit?: number;
}

/**
 * حقل اسم الزبون مع اقتراح الأسماء السابقة.
 * - يقترح فور التركيز (أحدث الزبائن) ثم يضيّق مع الكتابة.
 * - المطابقة تتجاهل الهمزات/التاء المربوطة/التشكيل وتبحث برقم الهاتف أيضاً.
 * - المصدر: طلبات السوشيال السابقة + مجموعة customers.
 */
export default function CustomerNameInput({
  value,
  onChange,
  onPick,
  directory,
  placeholder = "اسم الزبون",
  required,
  inputClassName = "",
  limit = 8,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => searchCustomers(directory, value, limit), [directory, value, limit]);

  const pick = (c: CustomerSuggestion) => {
    onChange(c.name);
    onPick(c);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        required={required}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 w-full min-w-[240px] mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-60 overflow-y-auto text-right"
        >
          {!value.trim() && (
            <li className="px-3 py-1.5 text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-zinc-800">
              آخر الزبائن
            </li>
          )}
          {results.map((c, i) => (
            <li
              key={c.key}
              role="option"
              aria-selected={i === active}
              // onMouseDown حتى يسبق blur الحقل ولا تُغلق القائمة قبل الاختيار
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              className={`px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-zinc-800 last:border-0 transition ${
                i === active ? "bg-emerald-50 dark:bg-emerald-900/30" : "hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{c.name}</span>
                {c.ordersCount > 0 && (
                  <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-md">
                    {c.ordersCount} طلب
                  </span>
                )}
              </div>
              {(c.phone || c.platform || c.address) && (
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  {c.phone && <span dir="ltr">{c.phone}</span>}
                  {c.platform && <span>{c.platform}</span>}
                  {c.address && <span className="truncate">{c.address}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
