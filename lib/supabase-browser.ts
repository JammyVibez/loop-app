"use client"

import { createClient } from "@/lib/supabase"
import type { Database } from "./database.types"

let browserClient: any = undefined

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient<Database>()
  }

  return browserClient
}
