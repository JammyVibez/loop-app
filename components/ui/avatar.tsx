"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { getDiceBearUrl } from "@/lib/dicebear";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => {
  // Don't render <img> at all when src is null/undefined —
  // this lets AvatarFallback show instead of a broken image icon
  if (!src) return null
  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={src}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  )
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  /** Seed for DiceBear Adventurer avatar. When provided, shows a unique cartoon avatar instead of initials. */
  seed?: string | null
}

/**
 * Extract a stable seed string from arbitrary React children.
 * Strips whitespace and special chars, then lowercases so the same
 * name always produces the same DiceBear character.
 */
function seedFromChildren(children: React.ReactNode): string | null {
  if (typeof children === "string") return children.trim().toLowerCase() || null
  if (typeof children === "number") return String(children)
  return null
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, children, seed, ...props }, ref) => {
  const [diceFailed, setDiceFailed] = React.useState(false)
  const effectiveSeed = seed || seedFromChildren(children)
  const initials = (typeof children === "string" ? children : "?").charAt(0).toUpperCase()

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full overflow-hidden",
        className
      )}
      {...props}
    >
      {effectiveSeed && !diceFailed ? (
        /* DiceBear cartoon avatar — unique per user, animated breathing effect */
        <div className="animate-[dicebear-breathe_3s_ease-in-out_infinite] h-full w-full">
          <img
            src={getDiceBearUrl(effectiveSeed)}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setDiceFailed(true)}
          />
        </div>
      ) : (
        /* Initials fallback — shown when no seed or DiceBear fails */
        <span
          className={cn(
            "font-bold text-white",
            "bg-gradient-to-br from-violet-600 to-cyan-500",
            "flex h-full w-full items-center justify-center"
          )}
        >
          {initials}
        </span>
      )}
    </AvatarPrimitive.Fallback>
  )
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
