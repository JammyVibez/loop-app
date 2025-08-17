"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Flag, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  MessageSquare,
  User,
  Calendar,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  reporter: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
  flag_type: string;
  description: string;
  status: string;
  created_at: string;
  content_profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

export function ContentModerationControl() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchContentFlags();
  }, [filterStatus]);

  const fetchContentFlags = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/moderation/flags?status=${filterStatus}`);
      const data = await response.json();
      
      if (data.success) {
        setFlags(data.data);
      }
    } catch (error) {
      console.error('Error fetching content flags:', error);
      toast({
        title: "Error",
        description: "Failed to load content flags",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFlagStatus = async (flagId: string, status: string, action: string) => {
    try {
      setProcessing(flagId);
      const response = await fetch(`/api/moderation/flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, action_taken: action }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Flag Updated",
          description: "Content flag status updated successfully",
        });
        // Refresh the flags
        fetchContentFlags();
      } else {
        throw new Error(data.error || "Failed to update flag");
      }
    } catch (error) {
      console.error('Error updating flag status:', error);
      toast({
        title: "Error",
        description: "Failed to update flag status",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getFlagTypeColor = (flagType: string) => {
    switch (flagType) {
      case 'spam': return 'bg-red-100 text-red-800';
      case 'harassment': return 'bg-orange-100 text-orange-800';
      case 'inappropriate': return 'bg-yellow-100 text-yellow-800';
      case 'copyright': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'dismissed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-500" />
              Content Moderation
            </CardTitle>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={fetchContentFlags}>
                <Eye className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <div className="text-center py-8">
              <Flag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No content flags</h3>
              <p className="text-gray-500">There are no content flags with the selected status.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags.map((flag) => (
                <div key={flag.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Avatar>
                        <AvatarImage src={flag.reporter?.avatar_url} />
                        <AvatarFallback>
                          {flag.reporter?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">
                            {flag.reporter?.display_name || 'Unknown User'}
                          </span>
                          <Badge className={getFlagTypeColor(flag.flag_type)}>
                            {flag.flag_type}
                          </Badge>
                          <Badge className={getStatusColor(flag.status)}>
                            {flag.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Reported content: {flag.content_type} #{flag.content_id}
                        </p>
                        {flag.description && (
                          <p className="text-sm mt-2 bg-gray-50 p-2 rounded">
                            "{flag.description}"
                          </p>
                        )}
                        <div className="flex items-center text-xs text-gray-500 mt-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{new Date(flag.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      {flag.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFlagStatus(flag.id, 'resolved', 'content_removed')}
                            disabled={processing === flag.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Remove Content
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFlagStatus(flag.id, 'resolved', 'user_suspended')}
                            disabled={processing === flag.id}
                          >
                            <User className="h-4 w-4 mr-1" />
                            Suspend User
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFlagStatus(flag.id, 'dismissed', 'warning')}
                            disabled={processing === flag.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </>
                      )}
                      
                      {flag.status === 'reviewed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateFlagStatus(flag.id, 'resolved', 'content_removed')}
                          disabled={processing === flag.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
