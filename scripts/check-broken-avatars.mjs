import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://cgtjjowhlyyrfljarfgd.supabase.co"
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNndGpqb3dobHl5cmZsamFyZmdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYzOTU2OCwiZXhwIjoyMDkxMjE1NTY4fQ.fHLOYpC9qV-ogmNCxxzs9v-sCxJL5HKn-7lWD8qFFU0"

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  // Get all users with avatar_url
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .not("avatar_url", "is", null)
    .neq("avatar_url", "")

  if (error) {
    console.error("Error:", error)
    return
  }

  console.log(`Total users with avatar_url: ${users.length}`)

  const categories = {
    dicebear: [],
    supabase: [],
    placeholder: [],
    other: [],
  }

  for (const u of users) {
    const url = u.avatar_url
    if (url.includes("dicebear.com")) {
      categories.dicebear.push(u)
    } else if (url.includes("supabase.co") || url.includes("storage")) {
      categories.supabase.push(u)
    } else if (url.includes("placeholder")) {
      categories.placeholder.push(u)
    } else {
      categories.other.push(u)
    }
  }

  console.log(`  DiceBear: ${categories.dicebear.length}`)
  console.log(`  Supabase storage: ${categories.supabase.length}`)
  console.log(`  Placeholder: ${categories.placeholder.length}`)
  console.log(`  Other: ${categories.other.length}`)

  if (categories.placeholder.length > 0) {
    console.log("\n⚠️ Users with placeholder URLs (need fixing):")
    for (const u of categories.placeholder) {
      console.log(`  ${u.username}: ${u.avatar_url}`)
    }
  }

  if (categories.other.length > 0) {
    console.log("\nOther URLs:")
    for (const u of categories.other.slice(0, 10)) {
      console.log(`  ${u.username}: ${u.avatar_url?.substring(0, 80)}`)
    }
  }
}

main().catch(console.error)
