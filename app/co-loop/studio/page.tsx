"use client"

import { Suspense } from "react"
import { CoLoopStudio } from "@/components/loops/co-loop-studio"
import { Loader2 } from "lucide-react"

export default function CoLoopStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      }
    >
      <CoLoopStudio />
    </Suspense>
  )
}
