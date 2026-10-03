"use client";
import React from "react";
import {
  Calendar,
  Clock,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Package,
  Store,
  X
} from "lucide-react";
import {
  CakeMaterialPurchase,
  calculateItemConsumption
} from "@/lib/cakeMaterialPurchases";

interface CakeMaterialTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  allPurchases: CakeMaterialPurchase[];
  onOpenPurchaseModal: (item: any) => void;
  onDeletePurchase?: (purchaseId: string) => void;
}

export default function CakeMaterialTimelineModal({
  isOpen,
  onClose,
  item,
  allPurchases,
  onOpenPurchaseModal,
  onDeletePurchase
}: CakeMaterialTimelineModalProps) {
  if (!isOpen || !item) return null;

  // Filter purchases for this material
  const itemPurchases = allPurchases
    .filter((p) => {
      if (item.id && p.itemId === item.id) return true;
      return (
        p.itemName &&
        item.name &&
        p.itemName.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
    })
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)); // Newest first

  const metrics = calculateItemConsumption(item, allPurchases);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/50";
      case "warning":
        return "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/50";
      case "safe":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/50";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200 dark:border-zinc-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl my-auto animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-2xl">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <span>📦</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">{item.name}</h3>
                <span className="bg-white/15 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.category}
                </span>
              </div>
              <p className="text-xs text-blue-200/80">
                المتوفر حالياً بالمخزن:{" "}
                <span className="font-black text-white">
                  {item.quantity} {item.unit}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Smart Consumption & Depletion Card */}
          <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-slate-50/50 dark:from-zinc-800/80 dark:to-zinc-800/40 border border-blue-100 dark:border-zinc-700/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                تحليل دورة الشراء ومعدل النفاد
              </h4>
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${getStatusColor(
                  metrics.depletionStatus
                )}`}
              >
                {metrics.depletionStatusText}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-gray-500 font-bold mb-1">آخر شراء</p>
                <p className="text-xs font-black text-gray-800 dark:text-gray-200">
                  {metrics.lastPurchaseDate ? metrics.lastPurchaseDate : "غير مسجل"}
                </p>
                {metrics.daysSinceLastPurchase !== null && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    قبل {metrics.daysSinceLastPurchase} يوم
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-gray-500 font-bold mb-1">دورة النفاد المعتادة</p>
                <p className="text-xs font-black text-gray-800 dark:text-gray-200">
                  {metrics.averageCycleDays ? (
                    <>
                      كل <span className="text-blue-600 font-black">~{metrics.averageCycleDays}</span> يوم
                    </>
                  ) : (
                    "تحت الحساب"
                  )}
                </p>
                <p className="text-[10px] text-gray-400">بين مرات الشراء</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-gray-500 font-bold mb-1">الاستهلاك اليومي</p>
                <p className="text-xs font-black text-gray-800 dark:text-gray-200">
                  {metrics.dailyConsumptionRate !== null ? (
                    <>
                      ~{metrics.dailyConsumptionRate}{" "}
                      <span className="text-[10px] font-normal">{item.unit}/يوم</span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="text-[10px] text-gray-400">معدل الاستخدام</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                <p className="text-[10px] text-gray-500 font-bold mb-1">المتبقي المتوقع</p>
                <p
                  className={`text-xs font-black ${
                    metrics.depletionStatus === "critical"
                      ? "text-red-600"
                      : metrics.depletionStatus === "warning"
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {metrics.estimatedDaysRemaining !== null ? (
                    <>~{metrics.estimatedDaysRemaining} يوم</>
                  ) : (
                    "كافية"
                  )}
                </p>
                {metrics.depletionEstimatedDate && (
                  <p className="text-[9px] text-gray-400">ينفد: {metrics.depletionEstimatedDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Purchases History Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                سجل المشتريات وتواريخ الشراء ({itemPurchases.length})
              </h4>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPurchaseModal(item);
                }}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> تسجيل شراء جديد
              </button>
            </div>

            {itemPurchases.length === 0 ? (
              <div className="bg-gray-50 dark:bg-zinc-800/40 rounded-2xl p-6 text-center border border-dashed border-gray-200 dark:border-zinc-700 text-gray-500 space-y-2">
                <p className="text-sm font-bold">لا يوجد سجل مشتريات مسجل لهذه المادة بعد</p>
                <p className="text-xs text-gray-400">
                  سجل عمليات الشراء (بفاتورة أو بدون فاتورة) لمتابعة تواريخ الشراء وحساب دورة الاستهلاك
                  تلقائياً
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
                {itemPurchases.map((purchase, idx) => {
                  const pDate = new Date(purchase.purchaseDate);
                  const daysAgo = Math.floor(
                    (new Date().getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={purchase.id || idx}
                      className="bg-gray-50 dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            purchase.hasInvoice
                              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {purchase.hasInvoice ? (
                            <Receipt className="w-4 h-4" />
                          ) : (
                            <ShoppingCart className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-900 dark:text-white">
                              {purchase.quantity} {purchase.unit}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                purchase.hasInvoice
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              }`}
                            >
                              {purchase.hasInvoice ? "بفاتورة 🧾" : "بدون فاتورة 🛒"}
                            </span>
                            {purchase.storeName && (
                              <span className="text-[11px] text-gray-500 font-bold flex items-center gap-0.5">
                                <Store className="w-3 h-3 text-gray-400" />
                                {purchase.storeName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span>{purchase.purchaseDate}</span>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">
                              {daysAgo === 0
                                ? "اليوم"
                                : daysAgo === 1
                                ? "أمس"
                                : `قبل ${daysAgo} يوم`}
                            </span>
                            {purchase.unitPrice > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  المفرد: {Number(purchase.unitPrice).toLocaleString()} د.ع
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <p className="font-black text-sm text-gray-900 dark:text-white">
                          {Number(purchase.totalPrice).toLocaleString()}{" "}
                          <span className="text-[10px] font-normal text-gray-400">د.ع</span>
                        </p>
                        {purchase.paymentSource && (
                          <span className="text-[10px] text-gray-400">
                            {purchase.paymentSource === "cake"
                              ? "أموال الكيك"
                              : purchase.paymentSource === "salary"
                              ? "دين من الراتب"
                              : purchase.paymentSource === "split"
                              ? "مقسم"
                              : "بدون تسجيل مصروف"}
                          </span>
                        )}
                        {onDeletePurchase && purchase.id && (
                          <button
                            type="button"
                            onClick={() => onDeletePurchase(purchase.id!)}
                            className="text-gray-400 hover:text-red-500 p-1 block mt-1 transition mr-auto"
                            title="حذف هذا الشراء"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-800/60 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
