import { Download, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";
import React from "react";

export default function ToolHeader({
  title,
  description,
  icon,
  onAction,
  isProcessing,
  hasData,
  customActionLabel,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onAction: (action: "share" | "download") => void;
  isProcessing: boolean;
  hasData: boolean;
  customActionLabel?: string;
}) {
  return (
    <header className="sticky top-20 z-40 mt-16 mb-6 bg-gradient-to-l from-[#1e1450] to-[#2d1c6d] rounded-[24px] px-4 py-3 shadow-xl relative overflow-hidden border border-white/10">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

      <div className="relative z-10 flex items-center gap-3">
        {/* Back button - always visible */}
        <Link
          href="/admin/custom-orders/grid-maker"
          className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex shrink-0 items-center justify-center transition-all border border-white/20"
          aria-label="رجوع"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </Link>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-white flex items-center gap-1.5 leading-tight">
            {icon}
            <span className="truncate">{title}</span>
          </h1>
          {description && (
            <p className="text-white/50 text-[10px] font-medium mt-0.5 truncate">{description}</p>
          )}
        </div>

        {/* Save button only — no share */}
        <button
          onClick={() => onAction("download")}
          disabled={isProcessing || !hasData}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
            hasData && !isProcessing
              ? "bg-white text-violet-700 hover:bg-white/90 shadow-lg shadow-violet-900/30 active:scale-95"
              : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{customActionLabel || "حفظ"}</span>
        </button>
      </div>
    </header>
  );
}
