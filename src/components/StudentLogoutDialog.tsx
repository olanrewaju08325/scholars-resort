import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  User, 
  ShieldCheck, 
  Smartphone, 
  Flame, 
  HelpCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface StudentLogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StudentLogoutDialog = ({ open, onOpenChange }: StudentLogoutDialogProps) => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!open) return null;

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      toast.success('Successfully logged out. See you next study session!');
      onOpenChange(false);
      navigate('/login');
    } catch (err: any) {
      toast.error('Failed to log out: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoggingOut(false);
    }
  };

  const deviceUUID = localStorage.getItem('scholars_resort_device_uuid') || profile?.device_uuid || 'DEV-ACTIVE-PRIMARY';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-card border border-border shadow-2xl p-6 rounded-2xl relative space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pr-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-lg uppercase shadow-sm">
            {profile?.full_name?.substring(0, 2) || 'ST'}
          </div>
          <div className="overflow-hidden">
            <h3 className="text-base font-bold text-foreground truncate">
              {profile?.full_name || 'Scholar Student'}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || 'student@scholarsresort.com'}
            </p>
          </div>
        </div>

        {/* Account Info Cards */}
        <div className="space-y-2.5 pt-1">
          {/* Membership Badge */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Account Status</p>
                <p className="text-[11px] text-muted-foreground">
                  {profile?.has_paid ? 'One-Time Lifetime Access Active' : 'Free Trial Tier'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${profile?.has_paid ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
              {profile?.has_paid ? 'PRO SCHOLAR' : 'FREE TIER'}
            </span>
          </div>

          {/* Device Lock Info */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-foreground">Active Device License</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[160px]">
                  ID: {deviceUUID.substring(0, 14)}...
                </p>
              </div>
            </div>
            <span className="text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
              Single Device
            </span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/15">
              <div className="flex items-center justify-center gap-1 text-orange-500 mb-0.5">
                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                <span className="text-sm font-bold">{profile?.streak_days || 0} Days</span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Active Streak</p>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15">
              <div className="flex items-center justify-center gap-1 text-purple-500 mb-0.5">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{profile?.target_score || 300}/400</span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Target Score</p>
            </div>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { onOpenChange(false); navigate('/profile'); }}
            className="w-full text-xs font-medium justify-start gap-2 h-9"
          >
            <User className="w-3.5 h-3.5 text-primary" /> View Profile
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { onOpenChange(false); navigate('/help'); }}
            className="w-full text-xs font-medium justify-start gap-2 h-9"
          >
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /> Help & FAQs
          </Button>
        </div>

        {/* Logout Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/60">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="w-full sm:w-1/2 text-xs h-9"
          >
            Stay Logged In
          </Button>

          <Button 
            variant="destructive" 
            onClick={handleSignOut} 
            disabled={loggingOut}
            className="w-full sm:w-1/2 text-xs font-bold gap-2 h-9 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Logging out...' : 'Log Out'}
          </Button>
        </div>
      </div>
    </div>
  );
};
