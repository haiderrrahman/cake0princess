"use client";
import React, { useState, useEffect, useRef } from "react";
import { Tag } from "lucide-react";

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  required?: boolean;
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  icon,
  className,
  required,
}: AutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter suggestions. Must type at least 1 character.
  const filtered = value.length >= 1 
    ? Array.from(new Set(suggestions)).filter(s => s.includes(value))
    : [];

  return (
    <div className="relative" ref={wrapperRef}>
      {icon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
          {icon}
        </div>
      )}
      <input
        required={required}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(e.target.value.length >= 1);
        }}
        onFocus={() => {
          if (value.length >= 1) setShowSuggestions(true);
        }}
        placeholder={placeholder}
        className={className || "w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:border-blue-500 focus:outline-none pr-10"}
      />

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
          {filtered.map((s) => (
            <div
              key={s}
              onClick={() => {
                onChange(s);
                setShowSuggestions(false);
              }}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-700 cursor-pointer text-sm text-gray-800 dark:text-gray-200"
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
