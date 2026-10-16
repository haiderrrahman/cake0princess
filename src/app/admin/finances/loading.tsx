export default function FinancesLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-950 p-4 sm:p-6 text-white animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-white/20 rounded-xl" />
          <div className="h-4 w-32 bg-white/10 rounded-lg" />
        </div>
        <div className="h-10 w-28 bg-white/15 rounded-2xl" />
      </div>

      {/* Main Stats Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/10 p-4" />
        ))}
      </div>

      {/* Net profit banner skeleton */}
      <div className="h-20 rounded-2xl bg-white/15 mb-4" />

      {/* Debt card skeleton */}
      <div className="h-20 rounded-2xl bg-white/10 mb-6" />

      {/* Recent expenses list skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
