"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in -> Go to login
        router.push("/login");
      } else if (!isAdmin) {
        // Logged in but not admin -> Go to home
        router.push("/");
      } else {
        // Logged in and is admin
        setIsChecking(false);
      }
    }
  }, [user, isAdmin, loading, router]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  // Only render children if we are definitely an admin
  return <>{children}</>;
}
