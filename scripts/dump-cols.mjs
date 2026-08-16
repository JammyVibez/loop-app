// Diagnostic: dump live columns for the tables the audit flagged.
import pg from "pg"

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const tables = (
  process.argv[2] ||
  "events,event_participants,event_messages,event_rsvps,event_mutes,events,conversations,messages,reels,loops,loop_stats,shop_items,media_uploads,live_streams,circle_members,circles,coin_transactions,profiles,achievements,user_achievements,stream_chat,user_inventory,gift_transactions,loop_duels,circle_posts,notifications,verification,subscription,invitations,circle_invitations,premium_requests,follows"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const { rows } = await client.query(
  `SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name, ordinal_position`,
  [tables],
)
const byTable = {}
for (const r of rows) (byTable[r.table_name] ||= []).push(`${r.column_name}${r.data_type === "timestamp with time zone" ? "*" : ""}`)
for (const t of tables) console.log(`${t}: ${(byTable[t] || []).join(", ")}`)

await client.end()
