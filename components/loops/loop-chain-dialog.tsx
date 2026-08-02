"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GitBranch, Heart, Sparkles, ChevronRight, ExternalLink, Plus, RefreshCw, ZoomIn, ZoomOut } from "lucide-react"
import Link from "next/link"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"

interface ChainNode {
  id: string
  title: string
  content: string
  createdAt: string
  parentLoopId?: string
  depth: number
  author: {
    id: string
    username: string
    displayName: string
    avatar: string
    verified?: boolean
  }
  stats: {
    likes: number
    branches: number
  }
  children?: ChainNode[]
}

interface LoopChainDialogProps {
  loopId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onBranchSelect?: (node: ChainNode) => void
}

export function LoopChainDialog({ loopId, open, onOpenChange, onBranchSelect }: LoopChainDialogProps) {
  const [tree, setTree] = useState<ChainNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string>(loopId)
  const [zoomLevel, setZoomLevel] = useState<number>(100)

  const fetchChain = useCallback(async () => {
    if (!loopId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/loops/${loopId}/chain`)
      const data = await res.json()
      if (res.ok && data.tree) {
        setTree(data.tree)
        setSelectedNodeId(loopId)
      }
    } catch (err) {
      console.error("Failed to load loop chain:", err)
    } finally {
      setLoading(false)
    }
  }, [loopId])

  useEffect(() => {
    if (open) void fetchChain()
  }, [open, fetchChain])

  const countTotalNodes = (node: ChainNode | null): number => {
    if (!node) return 0
    let count = 1
    if (node.children) {
      for (const child of node.children) {
        count += countTotalNodes(child)
      }
    }
    return count
  }

  const renderTreeNode = (node: ChainNode, isRoot = false) => {
    const isSelected = node.id === selectedNodeId
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.id} className="flex flex-col items-center relative my-4">
        {/* Node Box */}
        <div
          onClick={() => setSelectedNodeId(node.id)}
          className={`group relative flex flex-col gap-2 p-4 rounded-2xl border transition-all duration-300 cursor-pointer w-72 sm:w-80 ${
            isSelected
              ? "bg-gradient-to-br from-cyan-950/80 to-indigo-950/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] ring-2 ring-cyan-400/50"
              : isRoot
              ? "bg-slate-900/90 border-cyan-500/50 shadow-lg"
              : "bg-slate-900/70 border-white/10 hover:border-cyan-500/40 hover:bg-slate-800/80"
          }`}
        >
          {/* Header & Avatar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 border border-cyan-500/30">
                <AvatarImage src={node.author.avatar} />
                <AvatarFallback>{node.author.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{node.author.displayName}</span>
                <span className="text-[10px] text-slate-400">@{node.author.username}</span>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                isRoot
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50"
                  : "bg-purple-500/20 text-purple-300 border-purple-400/40"
              }`}
            >
              {isRoot ? "ROOT SEED" : `BRANCH L${node.depth}`}
            </Badge>
          </div>

          {/* Title & Content */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-white line-clamp-1">{node.title}</h4>
            <p className="text-xs text-slate-300 line-clamp-2 leading-snug">{node.content}</p>
          </div>

          {/* Footer Stats & Links */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-rose-400">
                <Heart className="h-3 w-3 fill-rose-500/30" /> {node.stats.likes}
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <GitBranch className="h-3 w-3" /> {node.stats.branches}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <FreshnessTimestamp date={node.createdAt} className="text-[10px]" />
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-cyan-300"
                onClick={(e) => e.stopPropagation()}
              >
                <Link href={`/loop/${node.id}`}>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Children connections & render */}
        {hasChildren && (
          <div className="flex flex-col items-center w-full mt-4">
            {/* Vertical stem line */}
            <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-400 to-purple-500/50 shadow-[0_0_8px_#22d3ee]" />

            {/* Horizontal branch connector line if multiple children */}
            {node.children!.length > 1 && (
              <div className="w-full h-0.5 bg-gradient-to-r from-purple-500/30 via-cyan-400/60 to-purple-500/30 mb-2 max-w-[90%]" />
            )}

            {/* Children container */}
            <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-10 w-full pt-2">
              {node.children!.map((child) => renderTreeNode(child, false))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const totalNodes = countTotalNodes(tree)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] bg-[#070d1e] border-white/10 text-white flex flex-col p-0 overflow-hidden shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 border-b border-white/10 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-300">
              <GitBranch className="h-5 w-5 text-cyan-400" /> Loop Chain Tree Map
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive branch visualizer — trace remixes, forks, and child extensions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
              <Sparkles className="h-3 w-3 mr-1" /> {totalNodes} Nodes in Chain
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoomLevel((z) => Math.min(z + 15, 140))}
              className="h-8 w-8 border-white/10 text-slate-300 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
              className="h-8 w-8 border-white/10 text-slate-300 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchChain}
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Tree Map Stage */}
        <div className="flex-1 overflow-auto p-8 relative bg-dot-grid bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-400">Building visual branch map...</p>
            </div>
          ) : tree ? (
            <div
              className="min-w-max flex justify-center transition-transform origin-top duration-200"
              style={{ transform: `scale(${zoomLevel / 100})` }}
            >
              {renderTreeNode(tree, true)}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">No chain data found.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
