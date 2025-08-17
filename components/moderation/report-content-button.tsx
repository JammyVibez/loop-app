"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportContentButtonProps {
  contentType: string;
  contentId: string;
  userId?: string;
}

export function ReportContentButton({ contentType, contentId, userId }: ReportContentButtonProps) {
  const [open, setOpen] = useState(false);
  const [flagType, setFlagType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const flagTypes = [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment" },
    { value: "inappropriate", label: "Inappropriate Content" },
    { value: "copyright", label: "Copyright Violation" },
    { value: "other", label: "Other" }
  ];

  const handleSubmit = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to report content",
        variant: "destructive",
      });
      return;
    }

    if (!flagType) {
      toast({
        title: "Error",
        description: "Please select a reason for reporting",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch("/api/moderation/flags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token")}`,
        },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          flag_type: flagType,
          description: description,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Report Submitted",
          description: "Thank you for helping keep our community safe. Our moderators will review this report.",
        });
        setOpen(false);
        setFlagType("");
        setDescription("");
      } else {
        throw new Error(data.error || "Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Flag className="w-4 h-4 mr-2" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Reason for reporting</label>
            <Select value={flagType} onValueChange={setFlagType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {flagTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Additional details (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide any additional context that might help our moderators understand the issue..."
              rows={4}
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !flagType}>
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
