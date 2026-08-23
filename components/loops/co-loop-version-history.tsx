"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  History,
  RotateCcw,
  Eye,
  Plus,
  Clock,
  ArrowLeftRight,
  GitCommit,
  Zap,
  FileText,
  Tag,
  ImageIcon,
  Users,
  CheckCircle2,
} from "lucide-react"

export interface CoLoopVersion {
  id: string
  versionNumber: number
  title: string
  content: string
  hashtags: string[]
  mediaUrl: string
  mediaUrls?: string[]
  mediaType: "text" | "image" | "video"
  coAuthors: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    role?: string
  }[]
  timestamp: string
  savedBy: {
    id: string
    name: string
    avatar?: string
  }
  label?: string
  changeSummary?: string
}

interface CoLoopVersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  versions: CoLoopVersion[]
  currentDraft: {
    title: string
    content: string
    hashtags: string[]
    mediaUrl: string
    mediaUrls?: string[]
    mediaType: "text" | "image" | "video"
    coAuthors: any[]
  }
  onSaveSnapshot: (label?: string) => void
  onRestoreVersion: (version: CoLoopVersion) => void
}

export function CoLoopVersionHistory({
  isOpen,
  onClose,
  versions,
  currentDraft,
  onSaveSnapshot,
  onRestoreVersion,
}: CoLoopVersionHistoryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"history" | "compare">("history")

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || versions[0] || null

  const handleManualSave = () => {
    onSaveSnapshot(customLabel.trim() || undefined)
    setCustomLabel("")
    setIsSaving(false)
  }

  // Simple diff generator for content
  const renderContentDiff = (oldText: string, newText: string) => {
    if (oldText === newText) {
      return <p className="text-xs text-muted-foreground italic">No content changes detected.</p>
    }

    const oldWords = oldText.split(/\s+/)
    const newWords = newText.split(/\s+/)

    return (
      <div className="space-y-3 font-mono text-xs">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-1">
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <span>- Removed / Previous Version</span>
          </p>
          <p className="text-rose-300 line-through leading-relaxed whitespace-pre-wrap">
            {oldText || "(empty content)"}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <span>+ Added / Current Draft</span>
          </p>
          <p className="text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {newText || "(empty content)"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg bg-card/95 border-l border-cyan-500/30 backdrop-blur-md p-0 flex flex-col h-full">
        {/* Header */}
        <SheetHeader className="p-5 border-b border-border/60 bg-gradient-to-r from-cyan-950/30 to-purple-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                <History className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                  Version History
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
                    {versions.length} Saved
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Compare snapshots & restore previous collaborative states.
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Action Bar: Create Snapshot */}
        <div className="p-4 border-b border-border/60 bg-muted/30">
          {isSaving ? (
            <div className="space-y-2">
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Name this snapshot (e.g., Pre-publish draft)..."
                className="rounded-xl text-xs bg-background border-cyan-500/40"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSaving(false)}
                  className="rounded-xl text-xs h-7"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleManualSave}
                  className="rounded-xl text-xs h-7 bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
                >
                  Save Version
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setIsSaving(true)}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Save Current State Snapshot
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <div className="px-4 pt-3 border-b border-border/40">
            <TabsList className="w-full bg-muted/60 p-1 rounded-xl h-9 grid grid-cols-2">
              <TabsTrigger value="history" className="rounded-lg text-xs font-semibold">
                <GitCommit className="h-3.5 w-3.5 mr-1.5 text-cyan-400" /> Timeline
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                disabled={!selectedVersion}
                className="rounded-lg text-xs font-semibold"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5 text-purple-400" /> Compare Diff
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Timeline Tab */}
          <TabsContent value="history" className="flex-1 p-0 m-0 overflow-hidden">
            <ScrollArea className="h-[calc(100vh-230px)] p-4">
              {versions.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No saved versions yet.</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Click "Save Current State Snapshot" to capture your first checkpoint!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-cyan-500/20">
                  {versions.map((v, index) => {
                    const isSelected = selectedVersionId === v.id || (!selectedVersionId && index === 0)
                    const isLatest = index === 0

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVersionId(v.id)}
                        className={`relative pl-8 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-500/10"
                            : "border-border/60 bg-card hover:border-cyan-500/40 hover:bg-muted/40"
                        }`}
                      >
                        {/* Timeline Node Icon */}
                        <div
                          className={`absolute left-2.5 top-4 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 ${
                            isLatest
                              ? "border-cyan-400 bg-cyan-500 animate-pulse"
                              : isSelected
                              ? "border-cyan-400 bg-cyan-400"
                              : "border-muted-foreground/40 bg-card"
                          }`}
                        />

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isLatest ? "default" : "outline"}
                                className={
                                  isLatest
                                    ? "bg-cyan-500 text-black font-bold text-[10px]"
                                    : "border-cyan-500/30 text-cyan-300 text-[10px]"
                                }
                              >
                                v{v.versionNumber} {isLatest && "(Current Latest)"}
                              </Badge>

                              {v.label && (
                                <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                                  {v.label}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-foreground/90 font-medium mt-1.5 line-clamp-2">
                              {v.title ? `"${v.title}" — ` : ""}
                              {v.content || "No text content"}
                            </p>
                          </div>
                        </div>

                        {/* Metadata Row */}
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <VideoAvatar src={v.savedBy?.avatar} videoSrc={(v.savedBy as any)?.video_avatar_url} isPremium={(v.savedBy as any)?.is_premium} fallback={v.savedBy?.name?.charAt(0) || "U"} size="sm" className="h-4 w-4 rounded-full" />
                            <span className="truncate max-w-[90px]">{v.savedBy?.name || "Collaborator"}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span>{v.timestamp}</span>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                onRestoreVersion(v)
                              }}
                              className="h-6 px-2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded-lg"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Restore
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="flex-1 p-4 m-0 overflow-y-auto">
            {selectedVersion ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
                  <div>
                    <span className="text-xs font-bold text-cyan-400">Comparing Version v{selectedVersion.versionNumber}</span>
                    <p className="text-[11px] text-muted-foreground">Saved by {selectedVersion.savedBy?.name} at {selectedVersion.timestamp}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onRestoreVersion(selectedVersion)}
                    className="rounded-xl text-xs bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore This
                  </Button>
                </div>

                {/* Title Diff */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-cyan-400" /> Title Comparison
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-border/60 bg-muted/30">
                      <p className="text-[10px] font-bold text-muted-foreground mb-1">Version v{selectedVersion.versionNumber}</p>
                      <p className="font-medium">{selectedVersion.title || "(No title)"}</p>
                    </div>
                    <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
                      <p className="text-[10px] font-bold text-cyan-400 mb-1">Current Active Draft</p>
                      <p className="font-medium">{currentDraft.title || "(No title)"}</p>
                    </div>
                  </div>
                </div>

                {/* Content Diff */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-purple-400" /> Content Visual Diff
                  </span>
                  {renderContentDiff(selectedVersion.content, currentDraft.content)}
                </div>

                {/* Hashtags Diff */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-teal-400" /> Hashtags Comparison
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl border border-border/60 bg-muted/30 flex flex-wrap gap-1">
                      {selectedVersion.hashtags.length === 0 ? (
                        <span className="text-muted-foreground italic text-[11px]">None</span>
                      ) : (
                        selectedVersion.hashtags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
                        ))
                      )}
                    </div>
                    <div className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-wrap gap-1">
                      {currentDraft.hashtags.length === 0 ? (
                        <span className="text-muted-foreground italic text-[11px]">None</span>
                      ) : (
                        currentDraft.hashtags.map((t) => (
                          <Badge key={t} className="bg-cyan-500/20 text-cyan-300 text-[10px]">#{t}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Select a version from the timeline to compare diff.</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
