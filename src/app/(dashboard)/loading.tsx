export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-rise">
      <div className="h-8 w-48 rounded-md bg-surface-2 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-surface animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-lg border border-border bg-surface animate-pulse" />
    </div>
  );
}
