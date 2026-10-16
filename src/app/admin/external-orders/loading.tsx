export default function ExternalOrdersLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 sm:p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-52 bg-slate-100 dark:bg-zinc-900 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-12 flex-1 bg-slate-200/80 dark:bg-zinc-900 rounded-2xl" />
        <div className="h-12 w-28 bg-slate-200/80 dark:bg-zinc-900 rounded-2xl" />
      </div>

      {/* Order Cards List Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-24 h-24 rounded-2xl bg-slate-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-3 py-1">
              <div className="flex justify-between">
                <div className="h-5 w-40 bg-slate-200 dark:bg-zinc-800 rounded-md" />
                <div className="h-5 w-20 bg-slate-200 dark:bg-zinc-800 rounded-full" />
              </div>
              <div className="h-4 w-32 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
              <div className="h-4 w-48 bg-slate-100 dark:bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
