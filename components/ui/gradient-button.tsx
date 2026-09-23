"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Signature gradients — one per intent, all built from the Loop design
 * tokens (lib/design-tokens.ts → --grad-* vars in app/globals.css).
 * No per-component hue pairs: components only pick a token class.
 */
export const gradientThemes = {
  /** Primary CTA — Linear brand indigo → accent */
  primary: "loop-grad-primary",
  /** Messaging / DMs — signal blue → brand indigo */
  messaging: "loop-grad-messaging",
  /** Communities / social — signal orange → yellow */
  social: "loop-grad-social",
  /** Commerce / shop — signal green → teal */
  commerce: "loop-grad-commerce",
  /** Creative / media — accent indigo → teal */
  creative: "loop-grad-creative",
  /** Neutral / secondary — ink ramp */
  neutral: "loop-grad-neutral",
  /** Warning / alerts — signal yellow → red */
  warning: "loop-grad-warning",
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
          "relative inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5",
          "text-white font-semibold text-sm shadow-low",
          "transition-all duration-200",
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
