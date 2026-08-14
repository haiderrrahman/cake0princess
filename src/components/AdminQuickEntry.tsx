"use client";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Smartphone, Receipt, Boxes, Package, Tag, GraduationCap, Megaphone, Flag, Users } from "lucide-react";
import QuickEntrySocial from "./quick-entry/QuickEntrySocial";
import QuickEntryExpense from "./quick-entry/QuickEntryExpense";
import QuickEntryInventory from "./quick-entry/QuickEntryInventory";
import QuickEntryProduct from "./quick-entry/QuickEntryProduct";
import QuickEntryCategory from "./quick-entry/QuickEntryCategory";
import QuickEntryCourse from "./quick-entry/QuickEntryCourse";
import QuickEntrySupply from "./quick-entry/QuickEntrySupply";
import QuickEntryAd from "./quick-entry/QuickEntryAd";
import QuickEntryBanner from "./quick-entry/QuickEntryBanner";
import QuickEntryCompetition from "./quick-entry/QuickEntryCompetition";

interface AdminQuickEntryProps {
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: string;
  hideTabs?: boolean;
}

const TABS = [
  { id: "sale", label: "سوشيال", icon: Smartphone },
  { id: "product", label: "كيكة", icon: Package },
  { id: "inventory", label: "مخزن", icon: Boxes },
  { id: "expense", label: "مصروف", icon: Receipt },
  { id: "category", label: "تصنيف", icon: Tag },
  { id: "course", label: "دورة", icon: GraduationCap },
  { id: "supply", label: "مواد", icon: Boxes },
  { id: "ad", label: "إعلان", icon: Megaphone },
  { id: "banner", label: "بنر", icon: Flag },
  { id: "competition", label: "مسابقة", icon: Users },
];

export default function AdminQuickEntry({ onClose, onSuccess, initialTab, hideTabs }: AdminQuickEntryProps) {
  const [tab, setTab] = useState(initialTab || "sale");

  const renderTabContent = () => {
    switch (tab) {
      case "sale": return <QuickEntrySocial onSuccess={onSuccess} />;
      case "expense": return <QuickEntryExpense onSuccess={onSuccess} />;
      case "inventory": return <QuickEntryInventory onSuccess={onSuccess} />;
      case "product": return <QuickEntryProduct onSuccess={onSuccess} />;
      case "category": return <QuickEntryCategory onSuccess={onSuccess} />;
      case "course": return <QuickEntryCourse onSuccess={onSuccess} />;
      case "supply": return <QuickEntrySupply onSuccess={onSuccess} />;
      case "ad": return <QuickEntryAd onSuccess={onSuccess} />;
      case "banner": return <QuickEntryBanner onSuccess={onSuccess} />;
      case "competition": return <QuickEntryCompetition onSuccess={onSuccess} />;
      default: return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-[#0D0A1A] w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">الإدخال السريع</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar flex-1 p-6">
          {/* Scrollable Tabs */}
          {!hideTabs && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-[11px] transition ${
                    tab === t.id 
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-md' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-[#0D0A1A] rounded-2xl">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
