import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, Lock, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkMaintenance();

    // Subscribe to realtime updates on platform_config
    const channel = supabase
      .channel('maintenance-check')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_config', filter: 'key=eq.maintenance_mode' },
        (payload: any) => {
          if (payload.new && payload.new.value) {
            setMaintenanceEnabled(Boolean(payload.new.value.enabled));
            setMaintenanceMessage(payload.new.value.message || 'Platform undergoing scheduled maintenance.');
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
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();

      if (data && data.value) {
        setMaintenanceEnabled(Boolean(data.value.enabled));
        setMaintenanceMessage(data.value.message || 'Platform undergoing scheduled maintenance.');
      }
    } catch (err) {
      console.warn('Maintenance check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = (profile?.role as string) === 'admin' || (profile?.role as string) === 'superadmin' || profile?.email === 'olanrewajuhamilot@gmail.com';

  if (!loading && maintenanceEnabled && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Platform Under Maintenance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {maintenanceMessage || 'We are currently deploying new system updates. Normal access will resume shortly.'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            <span>Admin shutdown active. Only authorized administrative personnel can access the workspace.</span>
          </div>
          <div className="pt-2">
            <Button onClick={() => navigate('/login')} variant="outline" className="w-full">
              <LogIn className="w-4 h-4 mr-2" /> Admin Portal Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
