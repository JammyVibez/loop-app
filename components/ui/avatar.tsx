"use client";
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { getDiceBearUrl } from "@/lib/dicebear";

/**
 * Proxy external image URLs through the server-side image proxy so broken
 * Cloudinary / Supabase storage URLs return a transparent pixel instead of
 * showing "image unavailable" in the browser.
 *
 * DiceBear, Gravatar, data URIs, blobs, and local paths are passed through
 * directly — they're either CORS-friendly or don't need proxying.
 */
function proxyImg(url: string | Blob | null | undefined): string | undefined {
  if (!url) return undefined;
  // Blobs are not supported by avatar components, return undefined
  if (typeof url !== "string") return undefined;
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/") ||
    url.includes("/api/")
  )
    return url;
  if (url.includes("dicebear.com") || url.includes("gravatar.com")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/")) return url;
  } catch {
    /* not a valid URL, proxy it */
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

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
  const [dicebearFailed, setDicebearFailed] = React.useState(false);

  // Derive a seed for the DiceBear fallback from the seed prop, children, or alt text
  const seed =
    fallbackSeed ||
    (typeof children === "string" ? children : "") ||
    (typeof alt === "string" ? alt : "") ||
    "user";

  // When src is provided and hasn't failed, show the real image
  // (proxied through /api/image-proxy so broken Cloudinary URLs get a
  // transparent pixel instead of showing "image unavailable")
  if (src && !imgFailed) {
    return (
      <AvatarPrimitive.Image
        ref={ref}
        src={proxyImg(src)}
        alt={alt}
        className={cn("aspect-square h-full w-full object-cover", className)}
        onError={() => setImgFailed(true)}
        {...props}
      />
    );
  }

  // No src or image failed — show DiceBear cartoon as placeholder
  const dicebearUrl = getDiceBearUrl(seed);

  // If DiceBear also failed, render a colored initial instead of a broken image.
  // This keeps the UI clean even when the DiceBear API is unreachable.
  if (dicebearFailed) {
    const initial = (seed || "?").charAt(0).toUpperCase();
    return (
      <span
        className={cn(
          "flex aspect-square h-full w-full items-center justify-center rounded-full font-bold text-white",
          "bg-gradient-to-br from-violet-600 to-cyan-500",
          className,
        )}
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dicebearUrl}
      alt={alt || "avatar"}
      className={cn("aspect-square h-full w-full object-cover", className)}
      draggable={false}
      onError={() => setDicebearFailed(true)}
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
