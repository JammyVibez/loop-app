"use client";

import { cn } from "@/lib/utils";

/**
 * Reusable skeleton shapes to replace the 225+ identical Loader2 spinners.
 * Use these for content that's loading — they feel much more polished than spinners.
 */

/** A pulsing rectangle placeholder */
export function SkeletonBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** A pulsing circle placeholder (for avatars, icons) */
export function SkeletonCircle({
  className,
  size = 40,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: number }) {
  return (
    <div
      className={cn("animate-pulse rounded-full bg-muted shrink-0", className)}
      style={{ width: size, height: size }}
      {...props}
    />
  );
}

/** A full card skeleton for feed loading states */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/50 p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={36} />
        <div className="space-y-1.5 flex-1">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="h-2.5 w-16" />
        </div>
      </div>
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-48 w-full rounded-lg" />
      <div className="flex gap-4 pt-1">
        <SkeletonBlock className="h-3 w-12" />
        <SkeletonBlock className="h-3 w-12" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
    </div>
  );
}

/** A profile skeleton for profile page loading */
export function SkeletonProfile() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <SkeletonCircle size={64} />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-48" />
        </div>
      </div>
      <div className="flex gap-6 pt-2">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-3 w-16" />
      </div>
      <SkeletonBlock className="h-px w-full" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** A message list skeleton for chat loading */
export function SkeletonMessages() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}>
          {i % 2 === 0 && <SkeletonCircle size={28} />}
          <div className={cn("space-y-1", i % 2 === 0 ? "" : "items-end")}>
            <SkeletonBlock className={cn("h-9 rounded-2xl", i % 2 === 0 ? "w-48 rounded-tl-sm" : "w-40 rounded-tr-sm")} />
            <SkeletonBlock className="h-2 w-12" />
          </div>
          {i % 2 !== 0 && <SkeletonCircle size={28} />}
        </div>
      ))}
    </div>
  );
}

/**
 * A minimal inline spinner for buttons/small spaces.
 * Use this instead of importing Loader2 from lucide everywhere.
 */
export function Spinner({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={cn("animate-spin text-current", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
