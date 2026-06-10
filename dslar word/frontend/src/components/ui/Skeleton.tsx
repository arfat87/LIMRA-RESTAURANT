import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton rounded-xl ${className}`} />
);

export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl shadow-card overflow-hidden">
    <Skeleton className="h-52 w-full rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="h-9 w-full mt-2" />
    </div>
  </div>
);

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl shadow-card p-5 space-y-3">
    <div className="flex justify-between">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-20" />
    </div>
    <Skeleton className="h-3 w-24" />
    <div className="flex items-center gap-3 pt-2">
      <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="flex justify-between pt-2 border-t border-gray-100">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-28" />
    </div>
  </div>
);
