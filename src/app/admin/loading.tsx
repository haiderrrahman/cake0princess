export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#07050e] p-4 sm:p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-36 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-4 w-48 bg-slate-100 dark:bg-zinc-900 rounded-lg" />
        </div>
        <div className="h-10 w-10 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
      </div>

      {/* 4 Pillars Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-3xl bg-slate-200/70 dark:bg-zinc-800/60 p-4 flex flex-col justify-between" />
        ))}
      </div>

      {/* Action Sections Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-40 bg-slate-200 dark:bg-zinc-800 rounded-lg mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-slate-200/60 dark:bg-zinc-800/50 p-4" />
          ))}
        </div>
      </div>
    </div>
  );
}
