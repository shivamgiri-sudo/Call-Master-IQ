interface SkeletonProps {
  className?: string;
  rounded?: string;
}

/** Tiny shimmer building block. */
export function Skeleton({ className = '', rounded = 'rounded-lg' }: SkeletonProps) {
  return <div className={`skeleton ${rounded} ${className}`} aria-hidden />;
}

interface LoadingSkeletonProps {
  variant?: 'kpi' | 'chart' | 'table' | 'block';
  rows?: number;
}

export default function LoadingSkeleton({ variant = 'block', rows = 3 }: LoadingSkeletonProps) {
  if (variant === 'kpi') {
    return (
      <div className="glass p-5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-4 h-8 w-1/2" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>
    );
  }
  if (variant === 'chart') {
    return (
      <div className="glass p-5">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="mt-4 h-3 w-1/3" />
        <Skeleton className="mt-6 h-44 w-full" rounded="rounded-xl" />
      </div>
    );
  }
  if (variant === 'table') {
    return (
      <div className="glass p-1">
        <div className="flex flex-col gap-1 p-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}