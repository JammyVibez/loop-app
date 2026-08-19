"use client"

import { useState, useEffect } from "react"
import {
  Building2,
  ShieldCheck,
  Zap,
  Upload,
  Coins,
  Settings2,
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  Image as ImageIcon,
  Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { UserBadges } from "@/components/user-badge"
import { useToast } from "@/hooks/use-toast"

interface OrgConfig {
  coin_rate_multiplier: number
  custom_boost_discount: number
  circle_perk_price: number
  exclusive_rewards_enabled: boolean
}

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string
  email?: string
  is_verified?: boolean
  is_organization?: boolean
  organization_name?: string
  organization_badge_url?: string
  organization_config?: OrgConfig
  follower_count: number
}

export function OrgManagementPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [threshold, setThreshold] = useState(100)
  const [editingThreshold, setEditingThreshold] = useState(100)
  const [savingThreshold, setSavingThreshold] = useState(false)

  const [candidates, setCandidates] = useState<Profile[]>([])
  const [organizations, setOrganizations] = useState<Profile[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])

  // Modal states
  const [selectedOrg, setSelectedOrg] = useState<Profile | null>(null)
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  // Badge upload state
  const [badgeFile, setBadgeFile] = useState<File | null>(null)
  const [badgePreview, setBadgePreview] = useState<string | null>(null)
  const [uploadingBadge, setUploadingBadge] = useState(false)

  // Org config state
  const [orgName, setOrgName] = useState("")
  const [coinMultiplier, setCoinMultiplier] = useState(1.5)
  const [boostDiscount, setBoostDiscount] = useState(20)
  const [circlePerkPrice, setCirclePerkPrice] = useState(50)
  const [exclusiveRewards, setExclusiveRewards] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  const fetchOrgData = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/organizations", { cache: "no-store" })
      const data = await res.json()

      if (data.success) {
        setThreshold(data.threshold || 100)
        setEditingThreshold(data.threshold || 100)
        setCandidates(data.candidates || [])
        setOrganizations(data.organizations || [])
        setAllProfiles(data.allProfiles || [])
      } else {
        toast({ title: "Failed to load organizations", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrgData()
  }, [])

  const handleSaveThreshold = async () => {
    try {
      setSavingThreshold(true)
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_threshold", threshold: editingThreshold }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "Threshold Updated", description: `Organization threshold set to ${editingThreshold} followers` })
        setThreshold(editingThreshold)
        fetchOrgData()
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSavingThreshold(false)
    }
  }

  const handleUpgrade = async (userId: string, username: string) => {
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade_organization", user_id: userId }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "Account Upgraded!", description: `@${username} is now an Official Organization Account.` })
        fetchOrgData()
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleRevoke = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to revoke Organization status from @${username}?`)) return
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_organization", user_id: userId }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "Status Revoked", description: `Revoked organization status for @${username}.` })
        fetchOrgData()
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleBadgeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== "image/png") {
      toast({ title: "Invalid File Type", description: "Verification badge must be a PNG image file (image/png)", variant: "destructive" })
      return
    }

    if (file.size > 1024 * 1024) {
      toast({ title: "File Too Large", description: "Badge image must be under 1MB in size", variant: "destructive" })
      return
    }

    setBadgeFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setBadgePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUploadBadgeSubmit = async () => {
    if (!selectedOrg || !badgePreview) return
    try {
      setUploadingBadge(true)
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_badge",
          user_id: selectedOrg.id,
          badge_data_uri: badgePreview,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "Badge Uploaded!", description: "Custom verification badge PNG assigned successfully." })
        setIsBadgeModalOpen(false)
        setBadgeFile(null)
        setBadgePreview(null)
        fetchOrgData()
      } else {
        toast({ title: "Upload Failed", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setUploadingBadge(false)
    }
  }

  const openConfigModal = (org: Profile) => {
    setSelectedOrg(org)
    setOrgName(org.organization_name || org.display_name || org.username)
    setCoinMultiplier(org.organization_config?.coin_rate_multiplier || 1.5)
    setBoostDiscount(Math.round((org.organization_config?.custom_boost_discount || 0.2) * 100))
    setCirclePerkPrice(org.organization_config?.circle_perk_price || 50)
    setExclusiveRewards(org.organization_config?.exclusive_rewards_enabled ?? true)
    setIsConfigModalOpen(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedOrg) return
    try {
      setSavingConfig(true)
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_config",
          user_id: selectedOrg.id,
          organization_name: orgName,
          coin_rate_multiplier: Number(coinMultiplier),
          custom_boost_discount: Number(boostDiscount) / 100,
          circle_perk_price: Number(circlePerkPrice),
          exclusive_rewards_enabled: exclusiveRewards,
        }),
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "Configuration Saved", description: "Updated organization custom earning rates and perks." })
        setIsConfigModalOpen(false)
        fetchOrgData()
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSavingConfig(false)
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-[#0b1220] p-4 sm:p-6">
      {/* Header & Threshold Configuration */}
      <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Organization Tier & Partnerships</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Manage organization status, custom verification badge PNG uploads, configurable follower thresholds, and community earning rules.
            </p>
          </div>

          {/* Follower Threshold Admin Config */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="text-xs">
              <span className="text-slate-400 block font-semibold">Min Follower Threshold</span>
              <span className="text-emerald-400 text-xs font-mono">Admin Configurable</span>
            </div>
            <Input
              type="number"
              min="1"
              value={editingThreshold}
              onChange={(e) => setEditingThreshold(Number(e.target.value))}
              className="w-20 bg-slate-900 border-slate-700 text-white font-mono font-bold text-center h-9"
            />
            <Button
              onClick={handleSaveThreshold}
              disabled={savingThreshold || editingThreshold === threshold}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-3"
            >
              {savingThreshold ? "Saving..." : "Save Threshold"}
            </Button>
          </div>
        </div>
      </div>

      {/* Candidate Accounts Section (Approaching or Exceeding Follower Threshold) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Candidate Accounts ({candidates.length})</h3>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-xs">
              Approach/Exceed {threshold} Followers
            </Badge>
          </div>
          <span className="text-xs text-slate-400">Manual admin upgrade action required</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm animate-pulse">Loading candidate accounts...</div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">No candidates currently approaching or past the {threshold} follower threshold.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map((candidate) => {
              const progressPct = Math.min(100, Math.round((candidate.follower_count / threshold) * 100))
              const isEligible = candidate.follower_count >= threshold

              return (
                <div key={candidate.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={candidate.avatar_url || "/placeholder-user.jpg"}
                        alt={candidate.display_name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-sm">{candidate.display_name}</span>
                          <UserBadges is_verified={candidate.is_verified} size="sm" />
                        </div>
                        <span className="text-xs text-slate-400 font-mono">@{candidate.username}</span>
                      </div>
                    </div>

                    <Badge className={isEligible ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-800 text-slate-300"}>
                      {candidate.follower_count} / {threshold} Followers
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${isEligible ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-amber-500"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>{progressPct}% to Org Status</span>
                      <span>{isEligible ? " Eligible for Review" : `${threshold - candidate.follower_count} needed`}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleUpgrade(candidate.id, candidate.username)}
                    size="sm"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-1.5" />
                    Upgrade to Official Organization
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Active Organization Accounts */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Active Organization Partners ({organizations.length})</h3>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm animate-pulse">Loading organization partners...</div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">No active organization accounts yet. Upgrade candidates above to grant organization status.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {organizations.map((org) => (
              <div key={org.id} className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={org.avatar_url || "/placeholder-user.jpg"}
                    alt={org.display_name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/40"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{org.organization_name || org.display_name}</span>
                      <UserBadges
                        is_organization={true}
                        organization_badge_url={org.organization_badge_url}
                        organization_name={org.organization_name || org.display_name}
                        size="md"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span>@{org.username}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{org.follower_count} Followers</span>
                    </div>
                  </div>
                </div>

                {/* Per-Organization Perk Specs */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" />
                    {org.organization_config?.coin_rate_multiplier || 1.5}x Coin Rate
                  </span>
                  <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono font-semibold">
                    {Math.round((org.organization_config?.custom_boost_discount || 0.2) * 100)}% Boost Discount
                  </span>
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-semibold">
                    {org.organization_config?.circle_perk_price || 50} Coin Perk
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => {
                      setSelectedOrg(org)
                      setBadgePreview(org.organization_badge_url || null)
                      setIsBadgeModalOpen(true)
                    }}
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Upload Custom Badge PNG
                  </Button>

                  <Button
                    onClick={() => openConfigModal(org)}
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"
                  >
                    <Settings2 className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    Configure Perks
                  </Button>

                  <Button
                    onClick={() => handleRevoke(org.id, org.username)}
                    size="sm"
                    variant="ghost"
                    className="text-rose-400 hover:bg-rose-950/40 text-xs"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Verification Badge Upload Modal */}
      {isBadgeModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Upload Custom Badge PNG</h3>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsBadgeModalOpen(false)} className="h-8 w-8 text-slate-400">
                ✕
              </Button>
            </div>

            <p className="text-xs text-slate-400">
              Upload a unique custom verification badge PNG image for <strong className="text-white">@{selectedOrg.username}</strong>. This custom PNG will replace the default icon next to their name across the app.
            </p>

            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors">
                <input
                  type="file"
                  accept="image/png"
                  onChange={handleBadgeFileSelect}
                  className="hidden"
                  id="org-badge-upload"
                />
                <label htmlFor="org-badge-upload" className="cursor-pointer block space-y-2">
                  {badgePreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-slate-950 p-2 border border-emerald-500 flex items-center justify-center shadow-lg">
                        <img src={badgePreview} alt="Preview" className="w-12 h-12 object-contain rounded-full" />
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold">Click to replace PNG file</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                      <span className="text-xs text-slate-300 font-medium block">Click to select PNG file</span>
                      <span className="text-[11px] text-slate-500 block">PNG format only, max 512x512 recommended, &lt; 1MB</span>
                    </div>
                  )}
                </label>
              </div>

              {/* Preview alongside name */}
              {badgePreview && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">In-App Appearance Preview:</span>
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span className="font-bold text-white text-sm">{selectedOrg.organization_name || selectedOrg.display_name}</span>
                    <img src={badgePreview} alt="Badge" className="w-4 h-4 object-contain rounded-full" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsBadgeModalOpen(false)} className="text-slate-400 text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleUploadBadgeSubmit}
                disabled={uploadingBadge || !badgePreview}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                {uploadingBadge ? "Uploading..." : "Save Custom Badge"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Org Earnings & Perks Modal */}
      {isConfigModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Configure Organization Earnings & Perks</h3>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsConfigModalOpen(false)} className="h-8 w-8 text-slate-400">
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Organization Display Name</label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Gaming Studio"
                  className="bg-slate-950 border-slate-800 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Coin Rate Multiplier</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={coinMultiplier}
                    onChange={(e) => setCoinMultiplier(Number(e.target.value))}
                    className="bg-slate-950 border-slate-800 text-white text-sm font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">e.g. 1.5 = +50% coins earned</span>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1">Boost Discount (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="80"
                    value={boostDiscount}
                    onChange={(e) => setBoostDiscount(Number(e.target.value))}
                    className="bg-slate-950 border-slate-800 text-white text-sm font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Discount on post boosts</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Circle Perk Price (Coins)</label>
                <Input
                  type="number"
                  min="0"
                  value={circlePerkPrice}
                  onChange={(e) => setCirclePerkPrice(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-white text-sm font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Custom price for members to unlock exclusive Circle perks</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                {savingConfig ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
