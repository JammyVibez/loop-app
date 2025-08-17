-- Add app update mode setting to admin_settings table
INSERT INTO admin_settings (setting_key, setting_value) VALUES
('app_update_mode', '{"enabled": false, "message": "App is currently updating", "version": "1.0.0", "update_notes": ""}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
