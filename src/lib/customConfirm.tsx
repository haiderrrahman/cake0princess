import { toast } from "sonner";
import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ConfirmOptions {
  confirmText?: string;
  cancelText?: string;
  title?: string;
}

export const customConfirm = (
  message = "هل تريد الحذف؟",
  options?: ConfirmOptions
): Promise<boolean> => {
  const confirmText = options?.confirmText || "نعم";
  const cancelText = options?.cancelText || "لا";
  const title = options?.title;

  return new Promise((resolve) => {
    toast.custom((t) => {
      const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto" dir="rtl">
          <div className="animate-in zoom-in-95 duration-200 max-w-md w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/10 shadow-2xl rounded-3xl flex flex-col p-6 text-right">
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center flex-shrink-0 text-rose-500 shadow-xs border border-rose-100 dark:border-rose-900/30">
                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                {title && (
                  <h4 className="font-black text-gray-900 dark:text-white text-base mb-1">
                    {title}
                  </h4>
                )}
                <p className="font-bold text-gray-800 dark:text-gray-200 text-sm leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2.5 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t as string | number);
                  resolve(true);
                }}
                className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-md shadow-rose-500/25 text-white rounded-2xl py-3 text-sm font-black transition active:scale-95 cursor-pointer"
              >
                {confirmText}
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(t as string | number);
                  resolve(false);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-2xl py-3 text-sm font-black transition active:scale-95 cursor-pointer"
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      );

      return (
        <>
          {typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
        </>
      );
    }, { 
      duration: Infinity, 
      unstyled: true,
    });
  });
};
