"use client";

import Link from "next/link";
import {
  LayoutGrid, Grid3x3, Minimize2, ArrowRightLeft, Maximize,
  Crop, Square, Circle, RotateCw, FlipHorizontal,
  Wand2, Scissors, Type, Image as ImageIcon, Layout,
  Printer, FileVideo, Columns, ChevronRight, Frame, Smile, Sparkles
} from "lucide-react";

type Tool = {
  title: string;
  icon: React.ElementType;
  href: string;
  bg: string;
  shadow: string;
  textColor?: string;
  badge?: string;
};

const TOOLS: Tool[] = [
  {
    title: "كولاج الصور",
    icon: Layout,
    href: "/admin/custom-orders/grid-maker/collage",
    bg: "bg-gradient-to-br from-[#4b6cb7] to-[#182848]",
    shadow: "shadow-indigo-500/30",
  },
  {
    title: "صورة دائرية",
    icon: Circle,
    href: "/admin/custom-orders/grid-maker/round",
    bg: "bg-gradient-to-br from-[#ee0979] to-[#ff6a00]",
    shadow: "shadow-rose-500/30",
  },
  {
    title: "قلب الصورة",
    icon: FlipHorizontal,
    href: "/admin/custom-orders/grid-maker/flip",
    bg: "bg-gradient-to-br from-[#3CA55C] to-[#B5AC49]",
    shadow: "shadow-lime-500/30",
  },
  {
    title: "استوديو الألوان",
    icon: Sparkles,
    href: "/admin/custom-orders/grid-maker/enhance",
    bg: "bg-gradient-to-br from-[#7F00FF] to-[#E100FF]",
    shadow: "shadow-fuchsia-500/30",
    badge: "جديد",
  },
  {
    title: "إطارات الصور",
    icon: Frame,
    href: "/admin/custom-orders/grid-maker/frames",
    bg: "bg-gradient-to-br from-[#d4a017] to-[#f5e642]",
    shadow: "shadow-yellow-500/30",
    textColor: "text-slate-800",
    badge: "جديد",
  },
  {
    title: "ملصقات",
    icon: Smile,
    href: "/admin/custom-orders/grid-maker/stickers",
    bg: "bg-gradient-to-br from-[#f9a8d4] to-[#c084fc]",
    shadow: "shadow-pink-500/30",
    badge: "جديد",
  },
  {
    title: "علامة مائية",
    icon: Type,
    href: "/admin/custom-orders/grid-maker/watermark",
    bg: "bg-gradient-to-br from-[#1D976C] to-[#93F9B9]",
    shadow: "shadow-green-500/30",
    textColor: "text-slate-800",
  },
  {
    title: "إزالة الخلفية",
    icon: Scissors,
    href: "/admin/custom-orders/grid-maker/remove-bg",
    bg: "bg-gradient-to-br from-[#ED213A] to-[#93291E]",
    shadow: "shadow-red-500/30",
  },
  {
    title: "قص الصورة",
    icon: Crop,
    href: "/admin/custom-orders/grid-maker/crop",
    bg: "bg-gradient-to-br from-[#ff9966] to-[#ff5e62]",
    shadow: "shadow-orange-500/30",
  },
  {
    title: "تغيير الحجم",
    icon: Maximize,
    href: "/admin/custom-orders/grid-maker/resize",
    bg: "bg-gradient-to-br from-[#2193b0] to-[#6dd5ed]",
    shadow: "shadow-cyan-500/30",
  },
  {
    title: "صورة مربعة",
    icon: Square,
    href: "/admin/custom-orders/grid-maker/square",
    bg: "bg-gradient-to-br from-[#1fa2ff] to-[#12d8fa]",
    shadow: "shadow-blue-500/30",
  },
  {
    title: "شبكة GIF",
    icon: LayoutGrid,
    href: "/admin/custom-orders/grid-maker/gif-grid",
    bg: "bg-gradient-to-br from-[#11998e] to-[#38ef7d]",
    shadow: "shadow-green-500/30",
  },
  {
    title: "تقسيم GIF",
    icon: FileVideo,
    href: "/admin/custom-orders/grid-maker/gif-split",
    bg: "bg-gradient-to-br from-[#fc4a1a] to-[#f7b733]",
    shadow: "shadow-orange-500/30",
  },
  {
    title: "صورة شبكية",
    icon: Grid3x3,
    href: "/admin/custom-orders/grid-maker/split",
    bg: "bg-gradient-to-br from-[#8E2DE2] to-[#4A00E0]",
    shadow: "shadow-purple-500/30",
  },
  {
    title: "ضغط الصور",
    icon: Minimize2,
    href: "/admin/custom-orders/grid-maker/compress",
    bg: "bg-gradient-to-br from-[#b20a2c] to-[#fffbd5]",
    shadow: "shadow-red-500/30",
    textColor: "text-slate-800",
  },
  {
    title: "تحويل الصور",
    icon: ArrowRightLeft,
    href: "/admin/custom-orders/grid-maker/convert",
    bg: "bg-gradient-to-br from-[#00b09b] to-[#96c93d]",
    shadow: "shadow-emerald-500/30",
  },
  {
    title: "تدوير الصورة",
    icon: RotateCw,
    href: "/admin/custom-orders/grid-maker/rotate",
    bg: "bg-gradient-to-br from-[#f12711] to-[#f5af19]",
    shadow: "shadow-orange-500/30",
  },
  {
    title: "تقسيم بانوراما",
    icon: Columns,
    href: "/admin/custom-orders/grid-maker/panorama",
    bg: "bg-gradient-to-br from-[#654ea3] to-[#eaafc8]",
    shadow: "shadow-fuchsia-500/30",
  },
  {
    title: "تقسيم للطباعة",
    icon: Printer,
    href: "/admin/custom-orders/grid-maker/print-split",
    bg: "bg-gradient-to-br from-[#00c6ff] to-[#0072ff]",
    shadow: "shadow-blue-500/30",
  },
  {
    title: "صانع الميمات",
    icon: ImageIcon,
    href: "/admin/custom-orders/grid-maker/meme",
    bg: "bg-gradient-to-br from-[#FDC830] to-[#F37335]",
    shadow: "shadow-amber-500/30",
  },
];

import React from "react";

export default function PhotoEditorHub() {
  return (
    <div className="min-h-screen bg-[#0d0d1a] p-4 md:p-6" dir="rtl">

      {/* Premium Dark Header */}
      <header className="mb-8 bg-gradient-to-l from-[#1e1450] to-[#2d1c6d] rounded-[28px] p-6 shadow-2xl relative overflow-hidden flex items-center justify-between border border-white/10">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="flex flex-col z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">استوديو كيك الأميرة</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-1.5">أدوات تعديل الصور</h1>
          <p className="text-white/50 text-sm font-medium">
            {TOOLS.length} أداة احترافية • تعمل بالكامل بدون انترنت ✈️
          </p>
        </div>

        <Link
          href="/admin/custom-orders"
          className="z-10 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex shrink-0 items-center justify-center transition-all border border-white/20"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </Link>
      </header>

      {/* New badge section label */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40 font-bold uppercase tracking-widest">كل الأدوات</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3">
        {TOOLS.map((tool, i) => (
          <Link
            key={i}
            href={tool.href}
            className={`
              relative group overflow-hidden rounded-2xl p-3 flex flex-col items-center justify-center gap-2
              ${tool.bg} shadow-lg hover:shadow-xl ${tool.shadow}
              active:scale-95 hover:-translate-y-1 transition-all duration-200
              aspect-square
            `}
          >
            {/* Glass shimmer */}
            <div className="absolute top-0 right-0 w-10 h-10 bg-white/15 rounded-full blur-xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

            {/* Badge */}
            {tool.badge && (
              <span className="absolute top-1.5 left-1.5 bg-white/90 text-violet-700 text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none z-10">
                {tool.badge}
              </span>
            )}

            <tool.icon
              className={`w-6 h-6 md:w-7 md:h-7 z-10 ${tool.textColor || "text-white"}`}
              strokeWidth={2}
            />

            <span className={`font-black text-[9px] md:text-[10px] text-center leading-tight z-10 ${tool.textColor || "text-white"}`}>
              {tool.title}
            </span>
          </Link>
        ))}
      </div>

      <p className="text-center text-white/20 text-xs mt-8 font-medium">
        كل الأدوات تعمل محلياً على جهازك • لا حاجة للانترنت
      </p>
    </div>
  );
}
