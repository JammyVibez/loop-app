import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton rounded-md bg-muted",
        className
      )}
      {...props}
    />
  )
}

/* Pre-built skeleton patterns for common layouts */

function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  }
  return <Skeleton className={cn("rounded-full", sizeClasses[size])} />
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded-md"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-2.5 w-16 rounded-md" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-3.5 w-12 rounded-md" />
        <Skeleton className="h-3.5 w-12 rounded-md" />
        <Skeleton className="h-3.5 w-12 rounded-md" />
      </div>
    </div>
  )
}

function SkeletonProfile() {
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col items-center gap-4">
        <SkeletonAvatar size="xl" />
        <div className="space-y-2 text-center">
          <Skeleton className="h-5 w-32 mx-auto rounded-md" />
          <Skeleton className="h-3.5 w-24 mx-auto rounded-md" />
        </div>
      </div>
      <div className="flex justify-center gap-6">
        <Skeleton className="h-3.5 w-16 rounded-md" />
        <Skeleton className="h-3.5 w-16 rounded-md" />
        <Skeleton className="h-3.5 w-16 rounded-md" />
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

function SkeletonFeed({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-0 divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonAvatar, SkeletonText, SkeletonCard, SkeletonProfile, SkeletonFeed }
