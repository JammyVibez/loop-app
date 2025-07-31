"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Code, Plus } from "lucide-react"
import { CreateProjectDialog } from "@/components/developers/create-project-dialog"
import { CodeLoopCard } from "@/components/developers/code-loop-card"

// Mock developer projects
const mockProjects = [
  {
    id: "project-1",
    title: "React Loop Tree Component",
    description: "A reusable React component for rendering interactive loop trees with animations",
    author: {
      id: "1",
      username: "reactdev",
      display_name: "React Developer",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "influencer" as const,
    },
    language: "JavaScript",
    framework: "React",
    tags: ["react", "components", "trees", "animation"],
    stats: {
      stars: 234,
      forks: 45,
      views: 1200,
      branches: 12,
    },
    code_snippet: `import React, { useState } from 'react';
import { TreeNode } from './TreeNode';

export const LoopTree = ({ data, onBranch }) => {
  const [expanded, setExpanded] = useState(new Set());
  
  const toggleNode = (nodeId) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return (
    <div className="loop-tree">
      <TreeNode 
        node={data} 
        expanded={expanded}
        onToggle={toggleNode}
        onBranch={onBranch}
      />
    </div>
  );
};`,
    created_at: new Date("2024-01-15T10:30:00Z"),
  },
  {
    id: "project-2",
    title: "Python Loop Tree Algorithm",
    description: "Efficient algorithms for traversing and manipulating loop tree data structures",
    author: {
      id: "2",
      username: "pythonista",
      display_name: "Python Expert",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "root" as const,
    },
    language: "Python",
    framework: "None",
    tags: ["python", "algorithms", "data-structures", "trees"],
    stats: {
      stars: 189,
      forks: 34,
      views: 890,
      branches: 8,
    },
    code_snippet: `class LoopTree:
    def __init__(self, content, author_id):
        self.id = generate_id()
        self.content = content
        self.author_id = author_id
        self.branches = []
        self.parent = None
        self.created_at = datetime.now()
    
    def add_branch(self, branch_content, author_id):
        """Add a new branch to this loop"""
        branch = LoopTree(branch_content, author_id)
        branch.parent = self
        self.branches.append(branch)
        return branch
    
    def traverse_depth_first(self, visit_func):
        """Traverse the tree depth-first"""
        visit_func(self)
        for branch in self.branches:
            branch.traverse_depth_first(visit_func)
    
    def get_tree_stats(self):
        """Calculate statistics for the entire tree"""
        total_nodes = 0
        max_depth = 0
        
        def count_nodes(node, depth=0):
            nonlocal total_nodes, max_depth
            total_nodes += 1
            max_depth = max(max_depth, depth)
            for branch in node.branches:
                count_nodes(branch, depth + 1)
        
        count_nodes(self)
        return {
            'total_nodes': total_nodes,
            'max_depth': max_depth,
            'branch_count': len(self.branches)
        }`,
    created_at: new Date("2024-01-14T15:20:00Z"),
  },
  {
    id: "project-3",
    title: "Loop Social API Design",
    description: "RESTful API design patterns for social media platforms with tree-like content structures",
    author: {
      id: "3",
      username: "apiarchitect",
      display_name: "API Architect",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: false,
      is_premium: true,
    },
    language: "TypeScript",
    framework: "Node.js",
    tags: ["api", "nodejs", "typescript", "social-media"],
    stats: {
      stars: 156,
      forks: 28,
      views: 670,
      branches: 6,
    },
    code_snippet: `// Loop Tree API Endpoints
interface LoopAPI {
  // Create a new root loop
  POST('/api/loops', {
    content: LoopContent,
    tags?: string[],
    visibility: 'public' | 'private' | 'circle'
  }): Promise<Loop>
  
  // Add a branch to existing loop
  POST('/api/loops/:loopId/branches', {
    content: LoopContent,
    branch_type: 'extension' | 'remix' | 'response'
  }): Promise<Branch>
  
  // Get loop tree with all branches
  GET('/api/loops/:loopId/tree', {
    depth?: number,
    include_stats?: boolean
  }): Promise<LoopTree>
  
  // Get trending loops
  GET('/api/loops/trending', {
    timeframe: '1h' | '24h' | '7d' | '30d',
    category?: string,
    limit?: number
  }): Promise<Loop[]>
}

// Real-time events for collaborative features
interface LoopEvents {
  'loop:created': (loop: Loop) => void
  'loop:branched': (branch: Branch) => void
  'loop:liked': (loopId: string, userId: string) => void
  'loop:commented': (comment: Comment) => void
}`,
    created_at: new Date("2024-01-13T14:45:00Z"),
  },
]

const languages = ["All", "JavaScript", "Python", "TypeScript", "Go", "Rust", "Java", "C++"]
const frameworks = ["All", "React", "Vue", "Angular", "Node.js", "Django", "Flask", "Express"]

export function DevelopersContent() {
  const [projects, setProjects] = useState(mockProjects)
  const [selectedLanguage, setSelectedLanguage] = useState("All")
  const [selectedFramework, setSelectedFramework] = useState("All")
  const [sortBy, setSortBy] = useState("recent")
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const filteredProjects = projects.filter((project) => {
    const matchesLanguage = selectedLanguage === "All" || project.language === selectedLanguage
    const matchesFramework = selectedFramework === "All" || project.framework === selectedFramework
    return matchesLanguage && matchesFramework
  })

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.created_at.getTime() - a.created_at.getTime()
      case "popular":
        return b.stats.stars - a.stats.stars
      case "most_forked":
        return b.stats.forks - a.stats.forks
      default:
        return 0
    }
  })

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  return (
    <>
      <div className="space-y-6">
        {/* Create Project Button */}
        <div className="flex justify-center">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Share Project
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>

              <select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                {frameworks.map((framework) => (
                  <option key={framework} value={framework}>
                    {framework}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Stars</option>
                <option value="most_forked">Most Forked</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedProjects.map((project) => (
            <CodeLoopCard key={project.id} project={project} />
          ))}
        </div>

        {/* Featured Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="w-5 h-5 text-purple-600" />
              <span>Featured Developer Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Loop API Documentation</h3>
                <p className="text-sm text-gray-600 mb-3">Complete API reference for building Loop integrations</p>
                <Button variant="outline" size="sm">
                  View Docs
                </Button>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">SDK & Libraries</h3>
                <p className="text-sm text-gray-600 mb-3">Official SDKs for JavaScript, Python, and more</p>
                <Button variant="outline" size="sm">
                  Download
                </Button>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Developer Community</h3>
                <p className="text-sm text-gray-600 mb-3">Join our Discord for collaboration and support</p>
                <Button variant="outline" size="sm">
                  Join Discord
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </>
  )
}
