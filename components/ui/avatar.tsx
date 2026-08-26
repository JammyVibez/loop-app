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

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, children, seed, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full overflow-hidden",
      seed && "animate-[dicebear-breathe_3s_ease-in-out_infinite]",
      className
    )}
    {...props}
  >
    {children || (
      <img
        src={seed ? getDiceBearUrl(seed) : "/default-avatar.svg"}
        alt=""
        className="w-full h-full object-cover"
        draggable={false}
      />
    )}
  </AvatarPrimitive.Fallback>
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
