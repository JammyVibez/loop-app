"use client"

import { motion } from "framer-motion"
import { MessageCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface UnderConstructionProps {
  message?: string
  subtitle?: string
}

export function ShopUnderConstruction({
  message = "We're building something amazing!",
  subtitle = "Our shop is being redesigned with new features and items. Check back soon or chat with support.",
}: UnderConstructionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Animated Construction SVG */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-8"
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-2xl"
        >
          {/* Background circle */}
          <motion.circle
            cx="100"
            cy="100"
            r="90"
            fill="url(#bgGradient)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />

          {/* Animated gear */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "100px 100px" }}
          >
            <path
              d="M100 60 L105 75 L115 70 L112 85 L125 85 L118 95 L130 100 L118 105 L125 115 L112 115 L115 130 L105 125 L100 140 L95 125 L85 130 L88 115 L75 115 L82 105 L70 100 L82 95 L75 85 L88 85 L85 70 L95 75 Z"
              fill="white"
              fillOpacity={0.9}
            />
            <circle cx="100" cy="100" r="18" fill="url(#bgGradient)" />
          </motion.g>

          {/* Animated wrench */}
          <motion.g
            animate={{ rotate: [-10, 10, -10] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "140px 70px" }}
          >
            <path
              d="M130 50 L155 75 L145 85 L140 80 L135 85 L120 70 L125 65 Z"
              fill="white"
              fillOpacity={0.8}
              stroke="white"
              strokeWidth={1.5}
              strokeOpacity={0.9}
            />
          </motion.g>

          {/* Floating sparkles */}
          {[
            { cx: 50, cy: 50, delay: 0 },
            { cx: 150, cy: 40, delay: 0.5 },
            { cx: 160, cy: 150, delay: 1 },
            { cx: 40, cy: 140, delay: 1.5 },
            { cx: 100, cy: 30, delay: 0.8 },
          ].map((s, i) => (
            <motion.circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={2.5}
              fill="white"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: s.delay,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Animated progress bar */}
          <rect x="60" y="165" width="80" height="6" rx="3" fill="white" fillOpacity={0.3} />
          <motion.rect
            x="60"
            y="165"
            width={80}
            height="6"
            rx="3"
            fill="white"
            initial={{ width: 0 }}
            animate={{ width: [0, 60, 80, 40, 80] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Text */}
      <motion.h2
        className="text-2xl font-bold text-foreground mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {message}
      </motion.h2>

      <motion.p
        className="text-muted-foreground max-w-md mb-8 leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {subtitle}
      </motion.p>

      {/* Action buttons */}
      <motion.div
        className="flex gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Link href="/home">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </Link>
        <a href="mailto:support@loopapp.me" target="_blank" rel="noopener noreferrer">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90 transition-opacity text-sm font-medium">
            <MessageCircle className="h-4 w-4" />
            Chat Support
          </button>
        </a>
      </motion.div>
    </div>
  )
}
