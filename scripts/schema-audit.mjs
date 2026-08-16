// Schema audit: compares the live Supabase (public) schema against every
// table / column referenced by supabase .from(...) queries in the codebase.
//
// Usage:
//   DATABASE_URL="postgresql://..." node scripts/schema-audit.mjs
//
// Heuristic parser — flags anything it can't prove exists, so a report needs
// human review before acting on it (it deliberately over-reports rather than
// missing a broken query). Known safe patterns that are filtered:
//   - Supabase alias joins: `author:profiles!author_id(...)`, `loop:loops!loop_id(...)`
//     (nested selects recurse and attribute inner columns to the real table)
//   - Dead lib/ helpers with no importers (e.g. legacy enhanced-supabase.ts)
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!databaseUrl) {
  console.error("DATABASE_URL or SUPABASE_DB_URL is required.")
  process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()

const { rows: columns } = await client.query(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
)
const schema = {}
for (const c of columns) {
  ;(schema[c.table_name] ||= new Set()).add(c.column_name)
}
const tables = new Set(Object.keys(schema))

// ---- column extraction helpers ---------------------------------------------

/** Parse a .select("a, b(c, d), e:f(g)") string into { table: [cols] } pairs.
 *
 * Supabase embeds child tables with alias syntax: `loop:loops!loop_id(
 *   *, author:profiles!author_id(id, username), loop_stats(likes_count)
 * )`. This recurses so the inner columns are attributed to their real
 * table (loops / profiles / loop_stats) instead of the outer table.
 */
function parseSelectString(str, parentTable = null) {
  const result = []
  for (const raw of splitTopLevel(str)) {
    const token = raw.trim()
    if (!token || token === "*") continue
    const paren = token.indexOf("(")
    if (paren >= 0) {
      // "author:profiles!author_id" -> table "profiles" (strip alias + FK hint)
      const tablePart = token.slice(0, paren).trim().split(":").pop().split("!")[0].trim()
      const inner = token.slice(paren + 1, token.lastIndexOf(")")).trim()
      // Nested child selects recurse; plain columns inside them belong to the
      // nested table (e.g. profiles / loop_stats), not the outer one.
      result.push(...parseSelectString(inner, tablePart || parentTable))
      continue
    }
    // Alias reference without parens (e.g. a bare "author:profiles" inside a
    // larger token) is a table join, not a column — skip it entirely.
    if (token.includes(":")) continue
    const col = token.split(":").pop().trim()
    if (col && col !== "count") result.push({ table: parentTable, column: col })
  }
  return result
}

function splitTopLevel(str) {
  const parts = []
  let depth = 0
  let current = ""
  let inStr = null
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (inStr) {
      if (ch === "\\") { current += ch + (str[i + 1] || ""); i++ }
      else if (ch === inStr) inStr = null
      current += ch
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; current += ch; continue }
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) { parts.push(current); current = ""; continue }
    current += ch
  }
  if (current.trim()) parts.push(current)
  return parts
}

/** Collect top-level keys of an object literal (text starts AFTER the '{').
 *
 * After matching a `key:` pair, jump past the whole value (to the next
 * top-level comma / closing brace) so a ternary like `x: a ? null : b` is
 * never mistaken for a `null:` key.
 */
function collectTopLevelKeys(text) {
  const keys = []
  let depth = 1
  let i = 0
  let inStr = null
  while (i < text.length && depth > 0) {
    const ch = text[i]
    if (inStr) {
      if (ch === "\\") i++
      else if (ch === inStr) inStr = null
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; i++; continue }
    if (ch === "{" || ch === "[") depth++
    else if (ch === "}" || ch === "]") { depth--; if (depth === 0) break }
    else if (depth === 1 && /[a-zA-Z_$]/.test(ch)) {
      const m = /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/.exec(text.slice(i))
      if (m) {
        keys.push(m[1])
        // Skip the key AND its value: advance past the next top-level comma
        // or the closing brace, tracking nested braces/brackets/strings.
        let vDepth = 0
        let vStr = null
        while (i < text.length) {
          const c = text[i]
          if (vStr) {
            if (c === "\\") i++
            else if (c === vStr) vStr = null
            i++
            continue
          }
          if (c === '"' || c === "'" || c === "`") { vStr = c; i++; continue }
          if (c === "{" || c === "[") vDepth++
          else if (c === "}" || c === "]") {
            if (vDepth === 0) { i++; return keys }
            vDepth--
          } else if (c === "," && vDepth === 0) { i++; break }
          i++
        }
        continue
      }
    }
    i++
  }
  return keys
}

// ---- source scanning -------------------------------------------------------

const files = []
function walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(p)
  }
}
for (const dir of ["app", "lib", "components"]) walk(dir)

// Dead-code filter: lib/ helpers are only relevant when something imports
// them. app/ and components/ are entry points by convention. A lib file with
// no importer (e.g. the legacy lib/enhanced-supabase.ts) can reference tables
// that no longer exist without being a production risk.
// Imports come in two forms — `@/lib/foo` (alias, anywhere) and `./foo`
// (relative, inside lib/). Scan every scanned file for both.
const importedLibs = new Set()
const tryAdd = (base) => {
  // Normalize to a file path: strip ./ and extension, try .ts/.tsx/index.
  let p = base.replace(/^\.[\\/]/, "").replace(/^\.\//, "")
  for (const ext of [".ts", ".tsx", ".mjs", ""]) {
    if (importedLibs.has(p + ext)) return
  }
  for (const ext of [".ts", ".tsx", ".mjs", ""]) importedLibs.add(p + ext)
}
for (const file of files) {
  const src = readFileSync(file, "utf8")
  // Static: `from "@/lib/x"` / `from "./x"`
  const re = /from\s+["'](@\/lib\/[^"']+|\.[^"']*)["']/g
  let m
  while ((m = re.exec(src))) {
    const spec = m[1]
    if (spec.startsWith("@/lib/")) {
      tryAdd("lib/" + spec.slice("@/lib/".length))
    } else {
      // Resolve relative imports against the importing file's dir.
      const dir = join(file.split("/").slice(0, -1).join("/"), spec)
      tryAdd(dir)
    }
  }
  // Dynamic: `import("@/lib/x")` (code-split server helpers)
  const dynRe = /import\(\s*["'](@\/lib\/[^"']+)["']/g
  let d
  while ((d = dynRe.exec(src))) {
    tryAdd("lib/" + d[1].slice("@/lib/".length))
  }
}
const deadLibFiles = new Set(
  files.filter((f) => f.startsWith("lib/") && f !== "lib/supabase.ts" && !importedLibs.has(f)),
)
if (deadLibFiles.size) {
  console.log("SKIPPED dead lib files (nothing imports them):")
  for (const f of [...deadLibFiles].sort()) console.log(`  ${f}`)
  console.log()
}

const refs = new Map() // `${table}::${column}` -> Set of files
const missingTables = new Map() // table -> Set of files

function ref(table, column, file) {
  const key = `${table}::${column}`
  if (!refs.has(key)) refs.set(key, new Set())
  refs.get(key).add(file)
}

const COLUMN_OPS = /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|order|in|cs|cd|select|filter)\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]/g

for (const file of files) {
  if (deadLibFiles.has(file)) continue
  const src = readFileSync(file, "utf8")
  const fromRe = /\.from\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]\s*\)/g
  let m
  while ((m = fromRe.exec(src))) {
    const table = m[1]
    const start = m.index
    if (!tables.has(table)) {
      if (!missingTables.has(table)) missingTables.set(table, new Set())
      missingTables.get(table).add(file)
      continue
    }
    // Window: until the next .from( or the end of this statement, capped at
    // 1200 chars. The statement boundary matters: a chain can be reassigned
    // to another query (`query = query.in(...)`), so ops from the next
    // statement must not be attributed here.
    const nextFrom = src.indexOf(".from(", start + 8)
    let windowEnd = nextFrom > start && nextFrom - start < 1200 ? nextFrom : Math.min(src.length, start + 1200)
    // Scan forward from the end of .from(...): a statement ends at a
    // top-level ';' or at a newline where the next non-space char isn't a
    // chain dot (and isn't a comment). Nested parens/braces/strings keep
    // depth > 0, so multi-line select strings and insert objects stay intact.
    let depth = 0
    let inStr = null
    for (let i = start + m[0].length; i < windowEnd; i++) {
      const c = src[i]
      if (inStr) {
        if (c === "\\") i++
        else if (c === inStr) inStr = null
        continue
      }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue }
      if (c === "(" || c === "{" || c === "[") depth++
      else if (c === ")" || c === "}" || c === "]") depth--
      else if (c === ";" && depth === 0) { windowEnd = i; break }
      else if (c === "\n" && depth === 0) {
        // Look ahead past spaces/tabs; if the next line isn't a chain
        // continuation (dot) or a comment, this statement is over.
        let j = i + 1
        while (j < windowEnd && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++
        const nxt = src[j]
        if (nxt !== undefined && nxt !== "." && nxt !== "/" && nxt !== "*" && nxt !== ";" && nxt !== ")" && nxt !== "}") {
          windowEnd = i
          break
        }
      }
    }
    const window = src.slice(start + m[0].length, windowEnd)

    // select("...")
    const selRe = /\.select\(\s*["'`]([^"'`]+)["'`]/g
    let s
    while ((s = selRe.exec(window))) {
      for (const { table: nestedTable, column } of parseSelectString(s[1])) {
        ref(nestedTable || table, column, file)
      }
    }
    // insert / upsert / update object keys
    const objRe = /\.(insert|upsert|update)\(\s*(?:\[\s*)?\{/g
    let o
    while ((o = objRe.exec(window))) {
      const open = window.indexOf("{", o.index)
      for (const key of collectTopLevelKeys(window.slice(open + 1))) ref(table, key, file)
    }
    // match({...}) keys
    const matchRe = /\.match\(\s*\{/g
    let mc
    while ((mc = matchRe.exec(window))) {
      const open = window.indexOf("{", mc.index)
      for (const key of collectTopLevelKeys(window.slice(open + 1))) ref(table, key, file)
    }
    // column ops
    let op
    COLUMN_OPS.lastIndex = 0
    while ((op = COLUMN_OPS.exec(window))) {
      if (op[2] !== "null" && op[2] !== "count") ref(table, op[2], file)
    }
    // postgres_changes table + filter (either order)
    const filterPair = /(?:table|filter):\s*["'`]([^"'`]+)["'`][\s\S]{0,140}?(?:table|filter):\s*["'`]([^"'`]+)["'`]/g
    let fp
    while ((fp = filterPair.exec(window))) {
      const t = fp[1].startsWith("=") || fp[1].includes(".") || fp[1].includes("eq") ? fp[2] : fp[1]
      const filterStr = t === fp[1] ? fp[2] : fp[1]
      const cleanTable = t.split("!")[0].trim()
      if (!tables.has(cleanTable)) {
        if (!missingTables.has(cleanTable)) missingTables.set(cleanTable, new Set())
        missingTables.get(cleanTable).add(file)
        continue
      }
      for (const clause of filterStr.split(",")) {
        const eq = clause.indexOf("=")
        if (eq > 0) {
          const col = clause.slice(0, eq).trim()
          if (col && col !== "null") ref(cleanTable, col, file)
        }
      }
    }
  }
}

// ---- report ----------------------------------------------------------------

const missingColumns = []
for (const [key, filesSet] of refs) {
  const [table, column] = key.split("::")
  if (!schema[table]?.has(column)) missingColumns.push({ table, column, files: [...filesSet] })
}

console.log("=== TABLES referenced but NOT in live schema ===")
if (missingTables.size === 0) console.log("(none)")
for (const [table, filesSet] of [...missingTables.entries()].sort()) {
  console.log(`  ${table}  <- ${[...filesSet].slice(0, 4).join(", ")}`)
}

console.log("\n=== COLUMNS referenced but NOT in live schema ===")
if (missingColumns.length === 0) console.log("(none)")
for (const { table, column, files } of missingColumns.sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column))) {
  console.log(`  ${table}.${column}  <- ${files.slice(0, 4).join(", ")}`)
}

await client.end()
