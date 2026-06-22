export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-stone-500">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
        <div className="absolute inset-2 animate-spin-slow rounded-full border-2 border-transparent border-b-brand-300" />
      </div>
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </div>
  );
}
