"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type AnimatedIconComponent = ComponentType<any>;

interface AnimatedIconViewProps {
  component: AnimatedIconComponent;
  size?: number;
  color?: string;
  className?: string;
  iconClassName?: string;
}

export function AnimatedIconView({
  component: Icon,
  size = 18,
  color = "currentColor",
  className,
  iconClassName,
}: AnimatedIconViewProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      whileTap={reducedMotion ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      <Icon size={size} className={iconClassName} style={{ color }} />
    </motion.span>
  );
}
