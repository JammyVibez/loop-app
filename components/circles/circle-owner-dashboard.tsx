"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Users,
  Settings,
  Crown,
  Shield,
  MessageCircle,
  Calendar,
  Trophy,
  Gift,
  Star,
  UserPlus,
  UserMinus,
  Lock,
  Globe,
  Plus,
  Hash,
  Bell,
  BellOff,
  Video,
  Mic,
  Phone,
  Zap,
  Heart,
  Share,
  Bookmark,
  MoreHorizontal,
  Pin,
  Archive,
  Flag,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  AlertTriangle,
  UserCheck,
  Ban,
  Coins,
  Image,
  Upload,
  TrendingUp,
  Pen,
  Clock,
  AlertCircle
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { InviteModal } from "@/components/invitations/invite-modal"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { formatDistanceToNow } from "date-fns"

interface Circle {
  id: string
  name: string
  description: string
  avatar_url: string
  banner_url: string
  member_count: number
  is_private: boolean
  is_member: boolean
  is_admin: boolean
  is_moderator: boolean
  is_owner: boolean
  category: string
  created_at: string
  owner: {
    id: string
    username: string
    display_name: string
    avatar_url: string
  }
  rules: string[]
  stats: {
    total_posts: number
    total_comments: number
    active_members: number
    weekly_growth: number
  }
}

interface CircleMember {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_premium: boolean
  is_verified: boolean
  role: 'owner' | 'admin' | 'moderator' | 'member'
  joined_at: string
  last_active?: string
  contribution_score: number
  badges: string[]
  status: 'active' | 'pending' | 'banned'
  ban_reason?: string
  banned_until?: string
}

interface CirclePost {
  id: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_verified: boolean
  }
  content: string
  media_url?: string
  media_type?: 'image' | 'video' | 'audio'
  timestamp: string
  likes: number
  comments: number
  shares: number
  is_liked: boolean
  is_bookmarked: boolean
  is_pinned: boolean
  hashtags: string[]
  mentions: string[]
}

interface CircleEvent {
  id: string
  title: string
  description: string
  event_type: string
  starts_at: string
  ends_at: string
  max_participants: number
  participant_count: number
  is_recurring: boolean
  created_at: string
}

interface CircleRoom {
  id: string
  name: string
  description?: string
  type: 'text' | 'voice' | 'video'
  is_private: boolean
  member_count: number
  is_active: boolean
  created_by: string
  created_at: string
}

export function CircleOwnerDashboard({ circleId }: { circleId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // State management
  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<CircleMember[]>([])
  const [posts, setPosts] = useState<CirclePost[]>([])
  const [events, setEvents] = useState<CircleEvent[]>([])
  const [rooms, setRooms] = useState<CircleRoom[]>([])
  const [pendingMembers, setPendingMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  
  // Dialog states
  const [showEditCircle, setShowEditCircle] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showMemberDetails, setShowMemberDetails] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPendingRequests, setShowPendingRequests] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CircleMember | null>(null)
  
  // Form states
  const [editCircleForm, setEditCircleForm] = useState({
    name: '',
    description: '',
    category: '',
    is_private: false,
    avatar_url: '',
    banner_url: '',
    rules: [] as string[]
  })
  
  const [newRule, setNewRule] = useState('')
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'discussion',
    starts_at: '',
    ends_at: '',
    max_participants: 50
  })
  
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: '',
    type: 'text' as 'text' | 'voice' | 'video',
    is_private: false
  })

  // Load pending members
  const loadPendingMembers = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/members/pending`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setPendingMembers(data.pending_members || [])
      }
    } catch (error) {
      console.error('Failed to load pending members:', error)
      toast({
        title: "Error",
        description: "Failed to load pending members",
        variant: "destructive"
      })
    }
  }

  // Handle pending member action
  const handlePendingMemberAction = async (memberId: string, action: 'approve' | 'reject', role: 'member' | 'admin' | 'moderator' = 'member') => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/members/pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ memberId, action, role })
      })

      if (response.ok) {
        // Remove the member from pending list
        setPendingMembers(prev => prev.filter(member => member.id !== memberId))
        
        // If approved, add to members list
        if (action === 'approve') {
          const approvedMember = pendingMembers.find(member => member.id === memberId);
          if (approvedMember) {
            setMembers(prev => [...prev, {
              ...approvedMember.profile,
              id: approvedMember.id,
              role: role,
              status: 'active',
              joined_at: new Date().toISOString(),
              contribution_score: 0,
              badges: [],
              is_premium: approvedMember.profile.is_premium || false,
              is_verified: approvedMember.profile.is_verified || false
            }]);
          }
        }
        
        toast({ description: `Member ${action} action completed successfully` })
      }
    } catch (error) {
      console.error(`Failed to ${action} member:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} member`,
        variant: "destructive"
      })
    }
  }

  // Load circle data
  useEffect(() => {
    const loadCircleData = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        // Load circle details
        const circleResponse = await fetch(`/api/circles/${circleId}`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (circleResponse.ok) {
          const circleData = await circleResponse.json()
          setCircle(circleData.circle)
          setEditCircleForm({
            name: circleData.circle.name,
            description: circleData.circle.description,
            category: circleData.circle.category,
            is_private: circleData.circle.is_private,
            avatar_url: circleData.circle.avatar_url,
            banner_url: circleData.circle.banner_url,
            rules: circleData.circle.rules || []
          })
        }

        // Load members
        const membersResponse = await fetch(`/api/circles/${circleId}/members`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json()
          setMembers(membersData.members || [])
        }

        // Load posts
        const postsResponse = await fetch(`/api/circles/${circleId}/posts`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          setPosts(postsData.posts || [])
        }

        // Load events
        const eventsResponse = await fetch(`/api/circles/${circleId}/events`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json()
          setEvents(eventsData.events || [])
        }

        // Load rooms
        const roomsResponse = await fetch(`/api/circles/${circleId}/rooms`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json()
          setRooms(roomsData.rooms || [])
        }

        // Load pending members if circle is private
        if (circleData && circleData.circle && circleData.circle.is_private) {
          loadPendingMembers()
        }
      } catch (error) {
        console.error('Failed to load circle data:', error)
        toast({
          title: "Error",
          description: "Failed to load circle data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadCircleData()
  }, [circleId, user])

  // Handle edit circle
  const handleEditCircle = async () => {
    if (!user || !circle) return

    try {
      const response = await fetch(`/api/circles/${circleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(editCircleForm)
      })

      if (response.ok) {
        const data = await response.json()
        setCircle(data.circle)
        setShowEditCircle(false)
        toast({ description: "Circle updated successfully!" })
      }
    } catch (error) {
      console.error('Failed to update circle:', error)
      toast({
        title: "Error",
        description: "Failed to update circle",
        variant: "destructive"
      })
    }
  }

  // Handle create event
  const handleCreateEvent = async () => {
    if (!user || !newEvent.title.trim()) return

    try {
      const response = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newEvent)
      })

      if (response.ok) {
        const data = await response.json()
        setEvents(prev => [...prev, data.event])
        setNewEvent({
          title: '',
          description: '',
          event_type: 'discussion',
          starts_at: '',
          ends_at: '',
          max_participants: 50
        })
        setShowCreateEvent(false)
        toast({ description: "Event created successfully!" })
      }
    } catch (error) {
      console.error('Failed to create event:', error)
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive"
      })
    }
  }

  // Handle create room
  const handleCreateRoom = async () => {
    if (!user || !newRoom.name.trim()) return

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newRoom)
      })

      if (response.ok) {
        const data = await response.json()
        setRooms(prev => [...prev, data.room])
        setNewRoom({
          name: '',
          description: '',
          type: 'text',
          is_private: false
        })
        setShowCreateRoom(false)
        toast({ description: "Room created successfully!" })
      }
    } catch (error) {
      console.error('Failed to create room:', error)
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive"
      })
    }
  }

  // Handle member action
  const handleMemberAction = async (memberId: string, action: 'promote' | 'demote' | 'ban' | 'unban' | 'remove') => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/members/${memberId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })

      if (response.ok) {
        // Update local state
        setMembers(prev => prev.map(member => 
          member.id === memberId 
            ? { 
                ...member, 
                role: action === 'promote' ? 'admin' : action === 'demote' ? 'member' : member.role,
                status: action === 'ban' ? 'banned' : action === 'unban' ? 'active' : member.status
              }
            : member
        ))
        toast({ description: `Member ${action} action completed successfully` })
      }
    } catch (error) {
      console.error(`Failed to ${action} member:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} member`,
        variant: "destructive"
      })
    }
  }

  // Handle post action
  const handlePostAction = async (postId: string, action: 'delete' | 'pin') => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })

      if (response.ok) {
        if (action === 'delete') {
          setPosts(prev => prev.filter(post => post.id !== postId))
          toast({ description: "Post deleted successfully" })
        } else {
          setPosts(prev => prev.map(post => 
            post.id === postId ? { ...post, is_pinned: !post.is_pinned } : post
          ))
          toast({ description: "Post pinned/unpinned successfully" })
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} post:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} post`,
        variant: "destructive"
      })
    }
  }

  // Handle event action
  const handleEventAction = async (eventId: string, action: 'delete' | 'cancel') => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/events/${eventId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })

      if (response.ok) {
        setEvents(prev => prev.filter(event => event.id !== eventId))
        toast({ description: "Event deleted successfully" })
      }
    } catch (error) {
      console.error(`Failed to ${action} event:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} event`,
        variant: "destructive"
      })
    }
  }

  // Add rule to circle
  const handleAddRule = () => {
    if (newRule.trim()) {
      setEditCircleForm(prev => ({
        ...prev,
        rules: [...prev.rules, newRule.trim()]
      }))
      setNewRule('')
    }
  }

  // Remove rule from circle
  const handleRemoveRule = (index: number) => {
    setEditCircleForm(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index)
    }))
  }

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.username.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = filterRole === 'all' || member.role === filterRole
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus
    
    return matchesSearch && matchesRole && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!circle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Circle Not Found</h2>
          <p className="text-gray-600">This circle doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Circle Header */}
      <div className="relative">
        {/* Banner */}
        <div
          className="h-48 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg relative overflow-hidden"
          style={{
            backgroundImage: circle.banner_url ? `url(${circle.banner_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-4 right-4 flex space-x-2">
            {circle.is_private ? (
              <Badge className="bg-gray-800/80 text-white">
                <Lock className="w-3 h-3 mr-1" />
                Private
              </Badge>
            ) : (
              <Badge className="bg-green-600/80 text-white">
                <Globe className="w-3 h-3 mr-1" />
                Public
              </Badge>
            )}
            <Badge className="bg-purple-600/80 text-white">{circle.category}</Badge>
          </div>
        </div>

        {/* Circle Info */}
        <div className="relative -mt-16 px-6">
          <div className="flex items-end space-x-6">
            <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
              <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
              <AvatarFallback className="text-2xl">{circle.name.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{circle.name}</h1>
                  <div className="flex items-center space-x-4 text-gray-300">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{circle.member_count} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Created {new Date(circle.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setShowEditCircle(true)}
                  className="bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Circle
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-gray-300 leading-relaxed">{circle.description}</p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{circle.stats?.total_posts || 0}</div>
                <div className="text-sm text-gray-400">Total Posts</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <MessageCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{circle.stats?.total_comments || 0}</div>
                <div className="text-sm text-gray-400">Total Comments</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <UserCheck className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{circle.stats?.active_members || 0}</div>
                <div className="text-sm text-gray-400">Active Members</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">+{circle.stats?.weekly_growth || 0}%</div>
                <div className="text-sm text-gray-400">Weekly Growth</div>
              </CardContent>
            </Card>
          </div>

          {/* Circle Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Circle Rules</span>
                <Button variant="outline" size="sm" onClick={() => setShowEditCircle(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {circle.rules?.map((rule, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-sm font-bold">{index + 1}</span>
                    </div>
                    <p className="text-gray-300">{rule}</p>
                  </div>
                )) || (
                  <p className="text-gray-500">No rules have been set for this circle.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Members */}
          {circle.is_private && pendingMembers.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Pending Member Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingMembers.map((pendingMember) => (
                    <div key={pendingMember.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={pendingMember.profile.avatar_url} alt={pendingMember.profile.display_name} />
                            <AvatarFallback>{pendingMember.profile.display_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold">{pendingMember.profile.display_name}</span>
                              {pendingMember.profile.is_verified && <Check className="w-4 h-4 text-blue-500" />}
                              {pendingMember.profile.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <p className="text-sm text-gray-500">@{pendingMember.profile.username}</p>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <select
                            id={`role-${pendingMember.id}`}
                            className="border rounded px-2 py-1 bg-white dark:bg-gray-900 text-sm"
                            defaultValue="member"
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                          
                          <Button
                            size="sm"
                            onClick={() => {
                              const roleSelect = document.getElementById(`role-${pendingMember.id}`) as HTMLSelectElement;
                              const role = roleSelect?.value as 'member' | 'admin' | 'moderator' || 'member';
                              handlePendingMemberAction(pendingMember.id, 'approve', role);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handlePendingMemberAction(pendingMember.id, 'reject')}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Member Management</CardTitle>
                <div className="flex space-x-2">
                  <Button onClick={() => setShowInviteModal(true)} className="bg-gradient-to-r from-purple-500 to-blue-500">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Members
                  </Button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="border rounded px-3 py-2 bg-white dark:bg-gray-900"
                  >
                    <option value="all">All Roles</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="member">Member</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border rounded px-3 py-2 bg-white dark:bg-gray-900"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.avatar_url} alt={member.display_name} />
                          <AvatarFallback>{member.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{member.display_name}</span>
                            {member.is_verified && <Check className="w-4 h-4 text-blue-500" />}
                            {member.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                            <Badge className={`text-xs ${
                              member.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                              member.role === 'admin' ? 'bg-red-100 text-red-700' :
                              member.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {member.role}
                            </Badge>
                            <Badge className={`text-xs ${
                              member.status === 'active' ? 'bg-green-100 text-green-700' :
                              member.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {member.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500">
                            @{member.username} • {member.contribution_score} points
                          </div>
                          {member.status === 'banned' && member.ban_reason && (
                            <div className="text-xs text-red-500">
                              Banned: {member.ban_reason}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMember(member)
                            setShowMemberDetails(true)
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        
                        {member.role !== 'owner' && (
                          <>
                            {member.role === 'member' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMemberAction(member.id, 'promote')}
                              >
                                <Shield className="w-4 h-4 mr-1" />
                                Make Admin
                              </Button>
                            )}
                            
                            {(member.role === 'admin' || member.role === 'moderator') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMemberAction(member.id, 'demote')}
                              >
                                <UserMinus className="w-4 h-4 mr-1" />
                                Demote
                              </Button>
                            )}
                            
                            {member.status !== 'banned' ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleMemberAction(member.id, 'ban')}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Ban
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMemberAction(member.id, 'unban')}
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Unban
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleMemberAction(member.id, 'remove')}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Post Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={post.author.avatar_url} alt={post.author.display_name} />
                        <AvatarFallback>{post.author.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold">{post.author.display_name}</span>
                          {post.author.is_verified && <Check className="w-4 h-4 text-blue-500" />}
                          {post.author.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                          </span>
                          {post.is_pinned && <Pin className="w-4 h-4 text-purple-500" />}
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">{post.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{post.likes} likes</span>
                            <span>{post.comments} comments</span>
                            <span>{post.shares} shares</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePostAction(post.id, 'pin')}
                            >
                              <Pin className="w-4 h-4 mr-1" />
                              {post.is_pinned ? 'Unpin' : 'Pin'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handlePostAction(post.id, 'delete')}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Event Management</h3>
            <Button onClick={() => setShowCreateEvent(true)} className="bg-gradient-to-r from-purple-500 to-blue-500">
              <Plus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{event.title}</h4>
                    <Badge variant="secondary">{event.event_type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {event.description}
                  </p>
                  <div className="text-xs text-gray-500 mb-3">
                    <p>{new Date(event.starts_at).toLocaleString()}</p>
                    <p>{new Date(event.ends_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {event.participant_count}/{event.max_participants} participants
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleEventAction(event.id, 'delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Room Management</h3>
            <Button onClick={() => setShowCreateRoom(true)} className="bg-gradient-to-r from-purple-500 to-blue-500">
              <Plus className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{room.name}</h4>
                    <div className="flex items-center space-x-1">
                      {room.type === 'voice' && <Mic className="w-4 h-4 text-green-500" />}
                      {room.type === 'video' && <Video className="w-4 h-4 text-blue-500" />}
                      {room.type === 'text' && <MessageCircle className="w-4 h-4 text-purple-500" />}
                      {room.is_private && <Lock className="w-3 h-3 text-gray-500" />}
                    </div>
                  </div>
                  {room.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {room.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {room.member_count} members
                    </span>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Circle Dialog */}
      <Dialog open={showEditCircle} onOpenChange={setShowEditCircle}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Circle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="circle-name">Circle Name</Label>
              <Input
                id="circle-name"
                value={editCircleForm.name}
                onChange={(e) => setEditCircleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter circle name..."
              />
            </div>
            
            <div>
              <Label htmlFor="circle-description">Description</Label>
              <Textarea
                id="circle-description"
                value={editCircleForm.description}
                onChange={(e) => setEditCircleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter circle description..."
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="circle-category">Category</Label>
              <Input
                id="circle-category"
                value={editCircleForm.category}
                onChange={(e) => setEditCircleForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Enter category..."
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Private Circle</Label>
                <p className="text-sm text-gray-500">Require approval to join</p>
              </div>
              <Switch
                checked={editCircleForm.is_private}
                onCheckedChange={(checked) => setEditCircleForm(prev => ({ ...prev, is_private: checked }))}
              />
            </div>
            
            <div>
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input
                id="avatar-url"
                value={editCircleForm.avatar_url}
                onChange={(e) => setEditCircleForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="Enter avatar URL..."
              />
            </div>
            
            <div>
              <Label htmlFor="banner-url">Banner URL</Label>
              <Input
                id="banner-url"
                value={editCircleForm.banner_url}
                onChange={(e) => setEditCircleForm(prev => ({ ...prev, banner_url: e.target.value }))}
                placeholder="Enter banner URL..."
              />
            </div>
            
            <div>
              <Label>Circle Rules</Label>
              <div className="flex space-x-2 mt-2">
                <Input
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  placeholder="Enter a new rule..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
                />
                <Button onClick={handleAddRule} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="mt-2 space-y-2">
                {editCircleForm.rules.map((rule, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <span className="text-sm">{rule}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleRemoveRule(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowEditCircle(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleEditCircle} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title..."
              />
            </div>
            
            <div>
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter event description..."
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="event-type">Event Type</Label>
              <select
                id="event-type"
                value={newEvent.event_type}
                onChange={(e) => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))}
                className="w-full border rounded p-2 bg-white dark:bg-gray-900"
              >
                <option value="discussion">Discussion</option>
                <option value="voice_chat">Voice Chat</option>
                <option value="screen_share">Screen Share</option>
                <option value="game">Game</option>
                <option value="challenge">Challenge</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="event-starts-at">Start Time</Label>
              <Input
                id="event-starts-at"
                type="datetime-local"
                value={newEvent.starts_at}
                onChange={(e) => setNewEvent(prev => ({ ...prev, starts_at: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="event-ends-at">End Time</Label>
              <Input
                id="event-ends-at"
                type="datetime-local"
                value={newEvent.ends_at}
                onChange={(e) => setNewEvent(prev => ({ ...prev, ends_at: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="event-max-participants">Max Participants</Label>
              <Input
                id="event-max-participants"
                type="number"
                value={newEvent.max_participants}
                onChange={(e) => setNewEvent(prev => ({ ...prev, max_participants: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowCreateEvent(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
                Create Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                value={newRoom.name}
                onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter room name..."
              />
            </div>
            
            <div>
              <Label htmlFor="room-description">Description</Label>
              <Textarea
                id="room-description"
                value={newRoom.description}
                onChange={(e) => setNewRoom(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter room description..."
                rows={3}
              />
            </div>
            
            <div>
              <Label>Room Type</Label>
              <div className="flex space-x-4 mt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="text"
                    checked={newRoom.type === 'text'}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                  />
                  <MessageCircle className="w-4 h-4" />
                  <span>Text</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="voice"
                    checked={newRoom.type === 'voice'}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                  />
                  <Mic className="w-4 h-4" />
                  <span>Voice</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="video"
                    checked={newRoom.type === 'video'}
                    onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                  />
                  <Video className="w-4 h-4" />
                  <span>Video</span>
                </label>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                checked={newRoom.is_private}
                onCheckedChange={(checked) => setNewRoom(prev => ({ ...prev, is_private: checked }))}
              />
              <Label>Private Room</Label>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowCreateRoom(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateRoom} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
                Create Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Details Dialog */}
      {showMemberDetails && selectedMember && (
        <Dialog open={showMemberDetails} onOpenChange={setShowMemberDetails}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Member Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedMember.avatar_url} alt={selectedMember.display_name} />
                  <AvatarFallback>{selectedMember.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{selectedMember.display_name}</h3>
                  <p className="text-gray-600">@{selectedMember.username}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {selectedMember.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                    {selectedMember.is_verified && <Check className="w-4 h-4 text-blue-500" />}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Account Information</h4>
                  <div className="text-sm text-gray-600 mt-2">
                    <p>Contribution Score: {selectedMember.contribution_score}</p>
                    <p>Joined: {new Date(selectedMember.joined_at).toLocaleDateString()}</p>
                    {selectedMember.last_active && (
                      <p>Last Active: {new Date(selectedMember.last_active).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold">Status</h4>
                  <div className="text-sm text-gray-600 mt-2">
                    <p>Role: {selectedMember.role}</p>
                    <p>Status: {selectedMember.status}</p>
                    {selectedMember.status === 'banned' && selectedMember.ban_reason && (
                      <p>Ban Reason: {selectedMember.ban_reason}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                {selectedMember.role !== 'owner' && (
                  <>
                    {selectedMember.role === 'member' && (
                      <Button onClick={() => handleMemberAction(selectedMember.id, 'promote')}>
                        <Shield className="w-4 h-4 mr-2" />
                        Make Admin
                      </Button>
                    )}
                    
                    {(selectedMember.role === 'admin' || selectedMember.role === 'moderator') && (
                      <Button onClick={() => handleMemberAction(selectedMember.id, 'demote')}>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Demote
                      </Button>
                    )}
                    
                    {selectedMember.status !== 'banned' ? (
                      <Button
                        variant="destructive"
                        onClick={() => handleMemberAction(selectedMember.id, 'ban')}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Ban
                      </Button>
                    ) : (
                      <Button onClick={() => handleMemberAction(selectedMember.id, 'unban')}>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Unban
                      </Button>
                    )}
                    
                    <Button
                      variant="destructive"
                      onClick={() => handleMemberAction(selectedMember.id, 'remove')}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        type="circle_collaboration"
        resourceId={circleId}
        resourceName={circle?.name || "Circle"}
      />
    </div>
  )
}
