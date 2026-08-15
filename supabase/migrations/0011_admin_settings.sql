-- V11: Admin Settings for Maintenance Mode and Feature Toggles

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- RLS Policies for admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read the settings (so the frontend can check if the site is in maintenance mode)
CREATE POLICY "Anyone can read admin settings" ON public.admin_settings FOR SELECT USING (true);

-- Only Admins can manage settings
CREATE POLICY "Admins can manage admin settings" ON public.admin_settings FOR ALL USING (public.is_admin());

-- Insert default settings
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES 
('maintenance_mode', '{"enabled": false, "message": "We are currently undergoing scheduled maintenance. Please check back soon."}'),
('feature_toggles', '{"cbt_enabled": true, "tournaments_enabled": true, "ai_tutor_enabled": true}')
ON CONFLICT (setting_key) DO NOTHING;
