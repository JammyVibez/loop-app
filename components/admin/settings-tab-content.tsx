"use client";

import { MaintenanceModeControl } from "./maintenance-mode-control";
import { AppUpdateModeControl } from "./app-update-mode-control";

export function SettingsTabContent() {
  return (
    <div className="space-y-6">
      <MaintenanceModeControl />
      <AppUpdateModeControl />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Feature Flags</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div>
                <h4 className="font-medium">Video Calls</h4>
                <p className="text-sm text-muted-foreground">Enable/disable video call functionality</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div>
                <h4 className="font-medium">Gift System</h4>
                <p className="text-sm text-muted-foreground">Enable/disable gift sending functionality</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Platform Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div>
                <h4 className="font-medium">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">Enable/disable push notifications</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
              <div>
                <h4 className="font-medium">Email Notifications</h4>
                <p className="text-sm text-muted-foreground">Enable/disable email notifications</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
