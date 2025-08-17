"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  UserPlus, 
  Mail, 
  Search, 
  Users, 
  Code, 
  MessageCircle,
  X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'circle_collaboration' | 'loop_collaboration' | 'project_collaboration'
  resourceId: string
  resourceName: string
}

interface User {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
}

export function InviteModal({ isOpen, onClose, type, resourceId, resourceName }: InviteModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [inviteMethod, setInviteMethod] = useState<'username' | 'email'>('username')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [message, setMessage] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users || [])
      }
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setSearching(false)
    }
  }

  const addUser = (selectedUser: User) => {
    if (!selectedUsers.find(u => u.id === selectedUser.id)) {
      setSelectedUsers(prev => [...prev, selectedUser])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId))
  }

  const sendInvitations = async () => {
    if (selectedUsers.length === 0 && !searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please select users to invite",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const invitations = []

      // Send invitations to selected users
      for (const selectedUser of selectedUsers) {
        invitations.push({
          inviteeId: selectedUser.id,
          type,
          resourceId,
          message,
          permissions: { role }
        })
      }

      // If inviting by email/username directly
      if (searchQuery.trim() && selectedUsers.length === 0) {
        invitations.push({
          [inviteMethod === 'email' ? 'inviteeEmail' : 'inviteeUsername']: searchQuery.trim(),
          type,
          resourceId,
          message,
          permissions: { role }
        })
      }

      // Send all invitations
      const promises = invitations.map(invitation =>
        fetch('/api/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invitation),
        })
      )

      const results = await Promise.all(promises)
      const successful = results.filter(r => r.ok).length

      toast({
        title: "Invitations Sent",
        description: `Successfully sent ${successful} invitation(s)`,
      })

      // Reset form
      setSelectedUsers([])
      setSearchQuery('')
      setMessage('')
      setRole('member')
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = () => {
    switch (type) {
      case 'circle_collaboration': return Users
      case 'loop_collaboration': return MessageCircle
      case 'project_collaboration': return Code
      default: return UserPlus
    }
  }

  const getTypeLabel = () => {
    switch (type) {
      case 'circle_collaboration': return 'Circle'
      case 'loop_collaboration': return 'Loop'
      case 'project_collaboration': return 'Project'
      default: return 'Collaboration'
    }
  }

  const TypeIcon = getTypeIcon()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5" />
            Invite to {getTypeLabel()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Inviting to: {resourceName}</Label>
          </div>

          <div className="space-y-2">
            <Label>Invite Method</Label>
            <Select value={inviteMethod} onValueChange={(value: 'username' | 'email') => setInviteMethod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="username">By Username</SelectItem>
                <SelectItem value="email">By Email</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                placeholder={inviteMethod === 'email' ? 'Enter email address' : 'Search by username'}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => addUser(result)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={result.avatar_url} />
                        <AvatarFallback>{result.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{result.display_name}</p>
                        <p className="text-xs text-gray-500">@{result.username}</p>
                      </div>
                    </div>
                    {result.is_verified && (
                      <Badge variant="secondary" className="text-xs">Verified</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Users</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((selectedUser) => (
                  <Badge key={selectedUser.id} variant="secondary" className="flex items-center gap-1">
                    {selectedUser.display_name}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeUser(selectedUser.id)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="contributor">Contributor</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                {type === 'circle_collaboration' && (
                  <SelectItem value="admin">Admin</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message (Optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to your invitation..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={sendInvitations}
              disabled={loading || (selectedUsers.length === 0 && !searchQuery.trim())}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
