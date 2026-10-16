export default function HubLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 sm:p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-40 bg-slate-100 dark:bg-zinc-900 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>

      {/* Tabs Skeleton */}
      <div className="h-12 w-full bg-slate-200/80 dark:bg-zinc-900 rounded-2xl mb-6" />

      {/* Content Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4" />
        ))}
      </div>
    </div>
  );
}
