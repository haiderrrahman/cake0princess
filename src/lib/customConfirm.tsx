import { toast } from "sonner";
import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';

export const customConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    toast.custom((t) => {
      const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="animate-in zoom-in-95 duration-200 max-w-md w-full bg-white dark:bg-zinc-900 shadow-2xl rounded-3xl flex flex-col p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-relaxed">
                {message}
              </p>
            </div>
            
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => {
                  toast.dismiss(t as string | number);
                  resolve(true);
                }}
                className="flex-1 bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30 text-white rounded-2xl py-3 text-md font-black transition active:scale-95"
              >
                نعم، تأكيد
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t as string | number);
                  resolve(false);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-2xl py-3 text-md font-black transition active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      );

      return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
    }, { 
      duration: Infinity, 
      unstyled: true,
    });
  });
};
