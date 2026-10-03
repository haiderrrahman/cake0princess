"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function InventoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/hub?tab=inventory");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f4f8] dark:bg-zinc-950 p-6 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
      <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
        جاري توجيهك إلى إدارة المخزن الموحدة...
      </p>
    </div>
  );
}
