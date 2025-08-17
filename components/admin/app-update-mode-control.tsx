"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface AppUpdateSettings {
  enabled: boolean;
  message: string;
  version: string;
  update_notes: string;
}

export function AppUpdateModeControl() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppUpdateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/app-update');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching app update settings:', error);
      toast({
        title: "Error",
        description: "Failed to load app update settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: AppUpdateSettings) => {
    try {
      setUpdating(true);
      const response = await fetch('/api/admin/app-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Settings Updated",
          description: "App update settings have been updated successfully",
        });
        fetchSettings(); // Refresh settings
      } else {
        throw new Error(data.error || "Failed to update settings");
      }
    } catch (error) {
      console.error('Error updating app update settings:', error);
      toast({
        title: "Error",
        description: "Failed to update app update settings",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const toggleAppUpdateMode = async () => {
    if (!settings) return;
    
    const newSettings = {
      ...settings,
      enabled: !settings.enabled
    };
    
    await updateSettings(newSettings);
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
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            App Update Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable App Update Mode</h3>
              <p className="text-sm text-gray-500">
                Temporarily disable platform access during app updates
              </p>
            </div>
            <Switch
              checked={settings?.enabled || false}
              onCheckedChange={toggleAppUpdateMode}
              disabled={updating}
            />
          </div>
          
          {settings?.enabled && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="update-message">Update Message</Label>
                <Input
                  id="update-message"
                  value={settings.message}
                  onChange={(e) => updateSettings({...settings, message: e.target.value})}
                  placeholder="Message shown to users during update"
                  disabled={updating}
                />
              </div>
              
              <div>
                <Label htmlFor="update-version">Version</Label>
                <Input
                  id="update-version"
                  value={settings.version}
                  onChange={(e) => updateSettings({...settings, version: e.target.value})}
                  placeholder="New version number"
                  disabled={updating}
                />
              </div>
              
              <div>
                <Label htmlFor="update-notes">Update Notes</Label>
                <Textarea
                  id="update-notes"
                  value={settings.update_notes}
                  onChange={(e) => updateSettings({...settings, update_notes: e.target.value})}
                  placeholder="Notes about the update"
                  disabled={updating}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
