export default function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Image skeleton */}
      <div className="aspect-square skeleton" />
      {/* Content skeleton */}
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="flex items-center justify-between mt-3">
          <div className="skeleton h-6 w-1/3 rounded" />
          <div className="skeleton h-6 w-1/4 rounded" />
        </div>
        <div className="skeleton h-8 w-full rounded-lg mt-2" />
      </div>
    </div>
  )
}

export function SkeletonList() {
  return (
    <div className="card flex gap-4">
      <div className="skeleton w-32 h-32 rounded-lg shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
        <div className="skeleton h-4 w-1/4 rounded" />
        <div className="skeleton h-7 w-1/3 rounded" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-4 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}
