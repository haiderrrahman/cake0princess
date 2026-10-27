"use client";

import React from "react";
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName?: string;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemName = "طلب",
  className = "",
}: PaginationProps) {
  if (totalItems === 0) return null;

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Helper to generate page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 px-1 ${className}`}>
      {/* Items info */}
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 order-2 sm:order-1 text-center sm:text-right">
        عرض <span className="font-black text-gray-800 dark:text-gray-200">{startItem} - {endItem}</span> من أصل{" "}
        <span className="font-black text-emerald-600 dark:text-emerald-400">{totalItems}</span> {itemName}
        <span className="mx-2 text-gray-300 dark:text-zinc-700">•</span>
        الصفحة <span className="font-black text-gray-800 dark:text-gray-200">{safeCurrentPage}</span> من{" "}
        <span className="font-black text-gray-800 dark:text-gray-200">{totalPages}</span>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 sm:gap-1.5 order-1 sm:order-2 flex-wrap justify-center">
          {/* First Page button (only if > 5 pages) */}
          {totalPages > 5 && (
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={safeCurrentPage === 1}
              className="w-8 h-8 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              title="الصفحة الأولى"
              aria-label="الصفحة الأولى"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          )}

          {/* Previous Page (RTL: ChevronRight points to previous/back) */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage === 1}
            className="h-8 px-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-black flex items-center gap-1 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">السابق</span>
          </button>

          {/* Number Buttons */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 h-8 flex items-center justify-center text-xs font-bold text-gray-400 dark:text-zinc-500"
                  >
                    …
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === safeCurrentPage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center active:scale-95 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 scale-105"
                      : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page (RTL: ChevronLeft points forward/next) */}
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage === totalPages}
            className="h-8 px-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-black flex items-center gap-1 transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
            aria-label="الصفحة التالية"
          >
            <span className="hidden xs:inline">التالي</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Last Page button (only if > 5 pages) */}
          {totalPages > 5 && (
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="w-8 h-8 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              title="الصفحة الأخيرة"
              aria-label="الصفحة الأخيرة"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
