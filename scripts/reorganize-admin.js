/**
 * Script to reorganize admin dashboard tabs into grouped categories.
 * Run with: node scripts/reorganize-admin.js
 */

const fs = require("fs")
const filePath = "components/admin/admin-dashboard.tsx"
let content = fs.readFileSync(filePath, "utf8")

// 1. Add new imports after existing imports
const importMarker = 'import { AdminFramesTab } from "@/components/admin/admin-frames-tab"'
if (!content.includes("AdminRevenueTab")) {
  content = content.replace(
    importMarker,
    importMarker + '\nimport { AdminRevenueTab } from "@/components/admin/admin-revenue-tab"\nimport { AuditLogPanel } from "@/components/admin/audit-log-panel"\nimport { AdminCommandPalette } from "@/components/admin/admin-command-palette"'
  )
}

// 2. Add command palette state after existing state declarations
const stateMarker = "const [stats, setStats] = useState<any>(null)"
if (!content.includes("commandPaletteOpen")) {
  content = content.replace(
    stateMarker,
    stateMarker + '\n  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)'
  )
}

// 3. Replace the TabsList with grouped categories
const oldTabsList = `        <TabsList className="flex h-auto w-full max-w-6xl flex-wrap gap-1">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="events">Global Events</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="catalog">Themes & Effects</TabsTrigger>
          <TabsTrigger value="featured">Featured</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="gifs">GIFs</TabsTrigger>
          <TabsTrigger value="emojis">Emojis</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="awards">Awards</TabsTrigger>
          <TabsTrigger value="procircle">Pro Circle</TabsTrigger>
          <TabsTrigger value="checkmarks">Checkmarks</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="appeals">Ban Appeals</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="coloops">Co-Loops</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="circle-themes">Circle Themes</TabsTrigger>
          <TabsTrigger value="pfp-frames">PFP Frames</TabsTrigger>
        </TabsList>`

const newTabsList = `        {/* Command Palette Trigger */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors w-full sm:w-auto"
          >
            <Search className="h-4 w-4" />
            <span>Quick actions...</span>
            <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>

        {/* Grouped Tab Navigation */}
        <div className="space-y-2">
          {/* Primary Tabs */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="analytics" className="text-xs">
              <BarChart3 className="mr-1 h-3 w-3" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs">
              <Coins className="mr-1 h-3 w-3" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs">
              <Users className="mr-1 h-3 w-3" /> Users
            </TabsTrigger>
            <TabsTrigger value="moderation" className="text-xs">
              <Shield className="mr-1 h-3 w-3" /> Moderation
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs">
              <Clock className="mr-1 h-3 w-3" /> Audit Log
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs">
              <Zap className="mr-1 h-3 w-3" /> Health
            </TabsTrigger>
          </TabsList>

          {/* Secondary Tabs (collapsed by default on mobile) */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="economy" className="text-xs">Economy</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs">Payouts</TabsTrigger>
            <TabsTrigger value="catalog" className="text-xs">Themes</TabsTrigger>
            <TabsTrigger value="featured" className="text-xs">Featured</TabsTrigger>
            <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
            <TabsTrigger value="broadcast" className="text-xs">Broadcast</TabsTrigger>
            <TabsTrigger value="ads" className="text-xs">Ads</TabsTrigger>
            <TabsTrigger value="support" className="text-xs">Support</TabsTrigger>
            <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
            <TabsTrigger value="organizations" className="text-xs">Orgs</TabsTrigger>
          </TabsList>

          {/* Tertiary Tabs */}
          <TabsList className="flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="gifs" className="text-xs">GIFs</TabsTrigger>
            <TabsTrigger value="emojis" className="text-xs">Emojis</TabsTrigger>
            <TabsTrigger value="awards" className="text-xs">Awards</TabsTrigger>
            <TabsTrigger value="checkmarks" className="text-xs">Checkmarks</TabsTrigger>
            <TabsTrigger value="procircle" className="text-xs">Pro Circle</TabsTrigger>
            <TabsTrigger value="appeals" className="text-xs">Ban Appeals</TabsTrigger>
            <TabsTrigger value="coloops" className="text-xs">Co-Loops</TabsTrigger>
            <TabsTrigger value="circle-themes" className="text-xs">Circle Themes</TabsTrigger>
            <TabsTrigger value="pfp-frames" className="text-xs">PFP Frames</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
          </TabsList>
        </div>`

if (content.includes("TabsTrigger value=\"analytics\"")) {
  content = content.replace(oldTabsList, newTabsList)
}

// 4. Add new TabsContent for revenue and audit log
const analyticsContentMarker = '<TabsContent value="analytics" className="mt-6">'
if (!content.includes('TabsContent value="revenue"')) {
  const revenueContent = `
        <TabsContent value="revenue" className="mt-6">
          <AdminRevenueTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogPanel />
        </TabsContent>

`
  content = content.replace(analyticsContentMarker, revenueContent + analyticsContentMarker)
}

// 5. Add CommandPalette before closing div
const closingDivMarker = "      </div>\n    </div>\n  )\n}"
if (!content.includes("AdminCommandPalette")) {
  content = content.replace(
    "    </div>\n  )\n}",
    `      <AdminCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />\n    </div>\n  )\n}`
  )
}

fs.writeFileSync(filePath, content, "utf8")
console.log("✅ Admin dashboard reorganized:")
console.log("  - Added grouped tab categories")
console.log("  - Added Revenue Dashboard tab")
console.log("  - Added Audit Log tab")
console.log("  - Added Command Palette (⌘K)")
console.log("  - Improved mobile tab layout")
