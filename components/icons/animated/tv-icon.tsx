import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const TvIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className = "" }, ref) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        ".screen",
        { opacity: [1, 0.45, 1] },
        { duration: 0.5, ease: "easeInOut" },
      );

      await animate(
        ".antenna",
        { rotate: [0, -7, 7, 0] },
        { duration: 0.5, ease: "easeInOut" },
      );
    }, [animate]);

    const stop = useCallback(() => {
      animate(
        ".screen, .antenna",
        { opacity: 1, rotate: 0 },
        { duration: 0.2, ease: "easeInOut" },
      );
    }, [animate]);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <motion.svg
        ref={scope}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cursor-pointer ${className}`}
        onHoverStart={start}
        onHoverEnd={stop}
      >
        <motion.path
          className="antenna"
          d="m17 2-5 5-5-5"
          style={{ transformOrigin: "12px 7px" }}
        />
        <rect x="2" y="7" width="20" height="15" rx="2.5" />
        <motion.path
          className="screen"
          d="M8 11h8M8 15h5"
          style={{ transformOrigin: "12px 13px" }}
        />
      </motion.svg>
    );
  },
);

TvIcon.displayName = "TvIcon";
export default TvIcon;
