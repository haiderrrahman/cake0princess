export default function HomeFinanceLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 sm:p-6 animate-pulse">
      {/* Top Bar Skeleton */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="space-y-1.5">
            <div className="h-6 w-36 bg-slate-200 dark:bg-zinc-800 rounded-lg" />
            <div className="h-3.5 w-24 bg-slate-100 dark:bg-zinc-900 rounded-md" />
          </div>
        </div>
        <div className="h-10 w-28 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>

      {/* Financial Health / Wallet Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-3xl bg-slate-200/70 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 p-4 flex flex-col justify-between" />
        ))}
      </div>

      {/* Navigation Tabs Pill Skeleton */}
      <div className="h-12 w-full bg-slate-200/60 dark:bg-zinc-900 rounded-2xl mb-6" />

      {/* Main Tab Content Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-3xl bg-slate-200/60 dark:bg-zinc-900/80 p-4 border border-slate-200/40 dark:border-zinc-800" />
        ))}
      </div>
    </div>
  );
}
