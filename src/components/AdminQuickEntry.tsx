"use client";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Smartphone, Receipt, Boxes, Package, Tag,
  GraduationCap, Megaphone, Flag, Users, Sparkles, Zap, SlidersHorizontal
} from "lucide-react";
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

interface TabItem {
  id: string;
  label: string;
  icon: any;
  desc: string;
  badge?: string;
  activeColor: string;
  iconColor: string;
}

const PRIMARY_TABS: TabItem[] = [
  {
    id: "sale",
    label: "سوشيال",
    icon: Smartphone,
    desc: "تسجيل فوري لطلبات واتساب وانستغرام والمكالمات",
    badge: "أساسي",
    activeColor: "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm shadow-emerald-500/20",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  {
    id: "expense",
    label: "مصروف",
    icon: Receipt,
    desc: "توثيق مصروفات وفواتير تشغيل كيك الأميرة",
    badge: "مالي",
    activeColor: "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 shadow-sm shadow-rose-500/20",
    iconColor: "text-rose-500 dark:text-rose-400",
  },
  {
    id: "product",
    label: "كيكة",
    icon: Package,
    desc: "إضافة كيكة جديدة لمعرض ومنتجات التطبيق",
    badge: "متجر",
    activeColor: "border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/15 shadow-sm shadow-fuchsia-500/20",
    iconColor: "text-fuchsia-500 dark:text-fuchsia-400",
  },
  {
    id: "inventory",
    label: "مخزن",
    icon: Boxes,
    desc: "إضافة مادة جديدة إلى جرد مخزن الكيك",
    badge: "مخزون",
    activeColor: "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/15 shadow-sm shadow-cyan-500/20",
    iconColor: "text-cyan-500 dark:text-cyan-400",
  },
  {
    id: "supply",
    label: "مواد",
    icon: Sparkles,
    desc: "إضافة مادة أو منتج لقسم مواد الكيك والتغليف",
    badge: "مشتريات",
    activeColor: "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 shadow-sm shadow-amber-500/20",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
];

const SECONDARY_TABS: TabItem[] = [
  {
    id: "course",
    label: "دورة",
    icon: GraduationCap,
    desc: "نشر دورة أو ورشة عمل جديدة في الأكاديمية",
    badge: "أكاديمية",
    activeColor: "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 shadow-sm shadow-indigo-500/20",
    iconColor: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "category",
    label: "تصنيف",
    icon: Tag,
    desc: "إضافة تصنيف أو قسم جديد لتنظيم المتجر",
    badge: "تنظيم",
    activeColor: "border-violet-500 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/15 shadow-sm shadow-violet-500/20",
    iconColor: "text-violet-500 dark:text-violet-400",
  },
  {
    id: "ad",
    label: "إعلان",
    icon: Megaphone,
    desc: "نشر إعلان ترويجي أو خصم للزبائن",
    badge: "ترويج",
    activeColor: "border-lime-500 text-lime-600 dark:text-lime-400 bg-lime-50 dark:bg-lime-500/15 shadow-sm shadow-lime-500/20",
    iconColor: "text-lime-500 dark:text-lime-400",
  },
  {
    id: "banner",
    label: "بنر",
    icon: Flag,
    desc: "إضافة بنر ترويجي سلايدر في الواجهة الرئيسية",
    badge: "واجهة",
    activeColor: "border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/15 shadow-sm shadow-sky-500/20",
    iconColor: "text-sky-500 dark:text-sky-400",
  },
  {
    id: "competition",
    label: "مسابقة",
    icon: Users,
    desc: "إنشاء مسابقة تفاعلية وجوائز لمتابعي التطبيق",
    badge: "تفاعل",
    activeColor: "border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/15 shadow-sm shadow-yellow-500/20",
    iconColor: "text-yellow-500 dark:text-yellow-400",
  },
];

export default function AdminQuickEntry({ onClose, onSuccess, initialTab, hideTabs }: AdminQuickEntryProps) {
  const isInitialSecondary = SECONDARY_TABS.some(t => t.id === initialTab);
  const [sectionGroup, setSectionGroup] = useState<"operations" | "marketing">(isInitialSecondary ? "marketing" : "operations");
  const [tab, setTab] = useState(initialTab || "sale");

  const currentTabs = sectionGroup === "operations" ? PRIMARY_TABS : SECONDARY_TABS;
  const activeTabInfo = [...PRIMARY_TABS, ...SECONDARY_TABS].find(t => t.id === tab) || PRIMARY_TABS[0];

  const handleSelectTab = (tabId: string) => {
    setTab(tabId);
  };

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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog with Full Light & Dark Mode Separation */}
      <div className="bg-white dark:bg-[#0D0A1A] border border-gray-200 dark:border-white/15 w-full max-w-xl rounded-t-[36px] sm:rounded-[36px] shadow-2xl relative z-10 flex flex-col max-h-[92vh] text-gray-900 dark:text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modern Header: Light & Dark Aware */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-pink-50/80 via-purple-50/50 to-slate-50/80 dark:from-purple-950/80 dark:via-[#160d29]/90 dark:to-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 p-[1.5px] shadow-lg shadow-pink-500/20">
              <div className="w-full h-full bg-white dark:bg-[#10081d] rounded-[14px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-pink-500 dark:text-pink-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">الإدخال الفوري السريع</h2>
                <span className="text-[10px] font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30 px-2 py-0.5 rounded-full">
                  ⚡ ذكي
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-bold mt-0.5">
                إضافة العمليات والطلبات والمصاريف بلمسة واحدة
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-full flex items-center justify-center transition active:scale-90 border border-gray-200 dark:border-white/10"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls & Category Switcher */}
        {!hideTabs && (
          <div className="px-6 pt-4 pb-3 border-b border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-[#0d0718]/90">
            {/* 2-Category Segmented Switcher */}
            <div className="grid grid-cols-2 p-1 bg-gray-200/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl mb-3 text-xs font-black">
              <button
                type="button"
                onClick={() => {
                  setSectionGroup("operations");
                  if (SECONDARY_TABS.some(t => t.id === tab)) {
                    setTab("sale");
                  }
                }}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
                  sectionGroup === "operations"
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/25"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>العمليات اليومية (5)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSectionGroup("marketing");
                  if (PRIMARY_TABS.some(t => t.id === tab)) {
                    setTab("course");
                  }
                }}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
                  sectionGroup === "marketing"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>التسويق والإدارة (5)</span>
              </button>
            </div>

            {/* Individual Sub-Tabs Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {currentTabs.map((t) => {
                const isActive = tab === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTab(t.id)}
                    className={`flex flex-col items-center justify-center py-2 sm:py-2.5 px-1 rounded-2xl font-black text-[11px] sm:text-xs transition active:scale-95 border ${
                      isActive
                        ? `${t.activeColor} shadow-md`
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 mb-1 ${isActive ? t.iconColor : "text-gray-400 dark:text-slate-400"}`} />
                    <span className="truncate max-w-full">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Context Hint Banner */}
        <div className="px-6 py-2 bg-pink-50/50 dark:bg-purple-950/30 border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-gray-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
            <span className="font-bold text-gray-900 dark:text-slate-200">{activeTabInfo.label}:</span>
            <span className="text-gray-500 dark:text-slate-400 font-medium truncate">{activeTabInfo.desc}</span>
          </div>
          {activeTabInfo.badge && (
            <span className="text-[10px] font-black bg-white dark:bg-white/10 text-pink-600 dark:text-pink-300 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 shadow-sm shrink-0">
              {activeTabInfo.badge}
            </span>
          )}
        </div>

        {/* Form Body with Light & Dark container */}
        <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 bg-gray-50 dark:bg-[#0c0817]">
          <div className="bg-white dark:bg-[#140e24]/90 border border-gray-200 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-sm dark:shadow-inner text-gray-900 dark:text-slate-100">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
