import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkMaintenance();

    // Subscribe to realtime updates on admin_settings and platform_config
    const channel = supabase
      .channel('maintenance-mode-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_settings', filter: 'setting_key=eq.maintenance_mode' },
        (payload: any) => {
          if (payload.new && payload.new.setting_value) {
            setMaintenanceEnabled(Boolean(payload.new.setting_value.enabled));
            setMaintenanceMessage(payload.new.setting_value.message || 'Platform undergoing scheduled maintenance.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkMaintenance = async () => {
    try {
      // 1. Try admin_settings table
      const { data: adminData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'maintenance_mode')
        .maybeSingle();

      if (adminData && adminData.setting_value) {
        setMaintenanceEnabled(Boolean(adminData.setting_value.enabled));
        setMaintenanceMessage(adminData.setting_value.message || 'Platform undergoing scheduled maintenance.');
      } else {
        // 2. Fallback to platform_config table
        const { data: configData } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (configData && configData.value) {
          setMaintenanceEnabled(Boolean(configData.value.enabled));
          setMaintenanceMessage(configData.value.message || 'Platform undergoing scheduled maintenance.');
        }
      }
    } catch (err) {
      console.warn('Maintenance check notice:', err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = 
    (profile?.role as string) === 'admin' || 
    (profile?.role as string) === 'superadmin' || 
    user?.email === 'olanrewajuhamilot@gmail.com' ||
    profile?.email === 'olanrewajuhamilot@gmail.com';

  // Allow accessing login or admin path directly so master admin can log in during maintenance
  const isLoginPageOrAdminPath = location.pathname === '/login' || location.pathname.includes('scholarresortadmin');

  if (!loading && maintenanceEnabled && !isAdmin && !isLoginPageOrAdminPath) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">Platform Under Scheduled Maintenance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {maintenanceMessage || 'We are currently deploying system updates to improve performance. Normal student access will resume shortly.'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 text-xs text-muted-foreground flex items-center gap-3 text-left">
            <Lock className="w-5 h-5 text-primary shrink-0" />
            <span>Production environment locked. Only authorized master administrative accounts can authenticate during maintenance windows.</span>
          </div>
          <div className="pt-2">
            <Button onClick={() => navigate('/login')} className="w-full font-semibold h-11 rounded-xl shadow-md">
              <LogIn className="w-4 h-4 mr-2" /> Master Admin Portal Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

