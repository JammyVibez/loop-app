"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface MaintenanceSettings {
  maintenance_mode: {
    enabled: boolean;
    message: string;
  };
  user_registration: {
    enabled: boolean;
    require_email_verification: boolean;
  };
}

export function MaintenanceModeControl() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: any) => {
    try {
      setUpdating(true);
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: newSettings }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Settings Updated",
          description: "Platform settings have been updated successfully",
        });
        fetchSettings(); // Refresh settings
      } else {
        throw new Error(data.error || "Failed to update settings");
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const toggleMaintenanceMode = async () => {
    if (!settings) return;
    
    const newSettings = {
      maintenance_mode: {
        enabled: !settings.maintenance_mode.enabled,
        message: settings.maintenance_mode.message
      }
    };
    
    await updateSettings(newSettings);
  };

  const updateMaintenanceMessage = async (message: string) => {
    if (!settings) return;
    
    const newSettings = {
      maintenance_mode: {
        enabled: settings.maintenance_mode.enabled,
        message
      }
    };
    
    await updateSettings(newSettings);
  };

  const toggleUserRegistration = async () => {
    if (!settings) return;
    
    const newSettings = {
      user_registration: {
        enabled: !settings.user_registration.enabled,
        require_email_verification: settings.user_registration.require_email_verification
      }
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
            Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable Maintenance Mode</h3>
              <p className="text-sm text-gray-500">
                Temporarily disable platform access for maintenance
              </p>
            </div>
            <Switch
              checked={settings?.maintenance_mode.enabled || false}
              onCheckedChange={toggleMaintenanceMode}
              disabled={updating}
            />
          </div>
          
          {settings?.maintenance_mode.enabled && (
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Maintenance Message</Label>
              <div className="flex gap-2">
                <Input
                  id="maintenance-message"
                  value={settings.maintenance_mode.message}
                  onChange={(e) => updateMaintenanceMessage(e.target.value)}
                  placeholder="Maintenance message shown to users"
                  disabled={updating}
                />
                <Button 
                  variant="outline" 
                  onClick={() => updateMaintenanceMessage(settings.maintenance_mode.message)}
                  disabled={updating}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            User Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable User Registration</h3>
              <p className="text-sm text-gray-500">
                Allow new users to create accounts
              </p>
            </div>
            <Switch
              checked={settings?.user_registration.enabled || false}
              onCheckedChange={toggleUserRegistration}
              disabled={updating}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Require Email Verification</h3>
              <p className="text-sm text-gray-500">
                New users must verify their email before accessing the platform
              </p>
            </div>
            <Switch
              checked={settings?.user_registration.require_email_verification || false}
              onCheckedChange={(checked) => {
                if (settings) {
                  const newSettings = {
                    user_registration: {
                      enabled: settings.user_registration.enabled,
                      require_email_verification: checked
                    }
                  };
                  updateSettings(newSettings);
                }
              }}
              disabled={updating}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
