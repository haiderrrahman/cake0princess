import { toast } from "sonner";
import { AlertTriangle } from 'lucide-react';

export const customConfirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    toast.custom((t) => (
      <div
        className={`animate-in slide-in-from-top-5 max-w-md w-full bg-white dark:bg-zinc-900 shadow-xl rounded-2xl pointer-events-auto flex flex-col ring-1 ring-black/5 p-4`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {message}
          </p>
        </div>
        
        <div className="flex gap-2 w-full">
          <button
            onClick={() => {
              toast.dismiss(t as string | number);
              resolve(true);
            }}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-2.5 text-sm font-bold transition"
          >
            نعم، تأكيد
          </button>
          <button
            onClick={() => {
              toast.dismiss(t as string | number);
              resolve(false);
            }}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl py-2.5 text-sm font-bold transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  });
};
