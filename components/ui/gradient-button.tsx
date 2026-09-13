"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Themed gradient presets — each section of the app uses a different one
 * so the UI doesn't feel like one gradient copy-pasted everywhere.
 */
export const gradientThemes = {
  /** Primary CTA — deep violet → teal */
  primary: "from-violet-600 to-teal-500 hover:from-violet-500 hover:to-teal-400",
  /** Messaging / DMs — sky → indigo */
  messaging: "from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500",
  /** Communities / social — rose → amber */
  social: "from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400",
  /** Commerce / shop — emerald → cyan */
  commerce: "from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400",
  /** Creative / media — fuchsia → orange */
  creative: "from-fuchsia-500 to-orange-500 hover:from-fuchsia-400 hover:to-orange-400",
  /** Neutral / secondary — slate → zinc */
  neutral: "from-slate-600 to-zinc-600 hover:from-slate-500 hover:to-zinc-500",
  /** Warning / alerts — amber → red */
  warning: "from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400",
} as const;

export type GradientTheme = keyof typeof gradientThemes;

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Which color theme to use. Defaults to "primary". */
  theme?: GradientTheme;
  /** Show a loading spinner instead of children. */
  loading?: boolean;
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, theme = "primary", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5",
          "bg-gradient-to-r text-white font-semibold text-sm",
          "shadow-md transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "active:scale-[0.97]",
          gradientThemes[theme],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

GradientButton.displayName = "GradientButton";

export { GradientButton };
export default GradientButton;
