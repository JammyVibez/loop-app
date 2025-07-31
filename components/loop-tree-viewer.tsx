"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoopCard } from "@/components/loop-card"
import { CreateBranchDialog } from "@/components/create-branch-dialog"

interface LoopTreeViewerProps {
  rootLoop: {
    id: string
    author: any
    content: any
    created_at: Date
    stats: any
    branches: any[]
  }
}

export function LoopTreeViewer({ rootLoop }: LoopTreeViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]))
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const renderBranches = (branches: any[], level = 1) => {
    return branches.map((branch) => (
      <div key={branch.id} className="relative">
        <div className="flex items-start space-x-2">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
            {branch.branches && branch.branches.length > 0 && <div className="w-px h-8 bg-purple-200"></div>}
          </div>
          <div className="flex-1">
            <LoopCard loop={branch} isChild={true} />
            {branch.branches && branch.branches.length > 0 && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleNode(branch.id)}
                  className="flex items-center space-x-2 text-purple-600 mb-2"
                >
                  {expandedNodes.has(branch.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>{branch.branches.length} more branches</span>
                </Button>
                {expandedNodes.has(branch.id) && (
                  <div className="ml-4">{renderBranches(branch.branches, level + 1)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    ))
  }

  return (
    <>
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Loop Tree</h3>
          <Button
            size="sm"
            className="bg-gradient-to-r from-purple-500 to-blue-500"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        </div>

        <div className="space-y-4">
          {rootLoop.branches.length > 0 && <div className="space-y-4">{renderBranches(rootLoop.branches)}</div>}

          {rootLoop.branches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No branches yet. Be the first to extend this loop!</p>
              <Button
                className="mt-4 bg-gradient-to-r from-purple-500 to-blue-500"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Branch
              </Button>
            </div>
          )}
        </div>
      </div>

      <CreateBranchDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} parentLoop={rootLoop} />
    </>
  )
}
