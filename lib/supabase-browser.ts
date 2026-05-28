"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return browserClient
}
