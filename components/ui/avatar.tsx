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

/**
 * AvatarImage — renders the user's profile photo.
 * If no src is provided, it generates a DiceBear Adventurer cartoon
 * as a client-side fallback so users without a PFP always see a
 * unique avatar instead of a broken image or plain initials.
 */
const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & {
    /** Seed for DiceBear fallback (typically username). Falls back to children/alt. */
    fallbackSeed?: string;
  }
>(({ className, src, fallbackSeed, children, alt, ...props }, ref) => {
  const [imgFailed, setImgFailed] = React.useState(false);

  // Derive a seed for the DiceBear fallback from the seed prop, children, or alt text
  const seed =
    fallbackSeed ||
    (typeof children === "string" ? children : "") ||
    (typeof alt === "string" ? alt : "") ||
    "user";

  // When src is provided and hasn't failed, show the real image
  if (src && !imgFailed) {
    return (
      <AvatarPrimitive.Image
        ref={ref}
        src={src}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onError={() => setImgFailed(true)}
        {...props}
      />
    );
  }

  // No src or image failed — show DiceBear cartoon as placeholder
  const dicebearUrl = getDiceBearUrl(seed);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dicebearUrl}
      alt={alt || "avatar"}
      className={cn("aspect-square h-full w-full object-cover", className)}
      draggable={false}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const initials = (typeof children === "string" ? children : "?").charAt(0).toUpperCase();

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full font-bold text-white",
        "bg-gradient-to-br from-violet-600 to-cyan-500",
        className
      )}
      {...props}
    >
      {initials}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
