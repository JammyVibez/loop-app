/**
 * Fix existing users who have null avatar_url by setting DiceBear URLs.
 * This ensures all users have a valid avatar from the start.
 */
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://cgtjjowhlyyrfljarfgd.supabase.co"
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndGpqb3dobHl5cmZsamFyZmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYzOTU2OCwiZXhwIjoyMDkxMjE1NTY4fQ.fHLOYpC9qV-ogmNCxxzs9v-sCxJL5HKn-7lWD8qFFU0"

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function getDiceBearUrl(seed) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed || "default")}`
}

async function main() {
  // Get all users with null or empty avatar_url
  const { data: users, error: fetchError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .or("avatar_url.is.null,avatar_url.eq.")

  if (fetchError) {
    console.error("Fetch error:", fetchError)
    return
  }

  console.log(`Found ${users.length} users without avatar_url`)

  let updated = 0
  let errors = 0

  // Batch update in chunks of 50
  for (let i = 0; i < users.length; i += 50) {
    const batch = users.slice(i, i + 50)
    const updates = batch.map(u => ({
      id: u.id,
      avatar_url: getDiceBearUrl(u.username),
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: update.avatar_url })
        .eq("id", update.id)

      if (error) {
        console.error(`Error updating ${update.id}:`, error.message)
        errors++
      } else {
        updated++
      }
    }

    console.log(`Progress: ${Math.min(i + 50, users.length)}/${users.length}`)
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`)
}

main().catch(console.error)
