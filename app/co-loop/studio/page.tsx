"use client"

import { Suspense } from "react"
import { CoLoopStudio } from "@/components/loops/co-loop-studio"
import { } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

export default function CoLoopStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center">
          <Spinner className="h-8 w-8 text-cyan-400" />
        </div>
      }
    >
      <CoLoopStudio />
    </Suspense>
  )
}
