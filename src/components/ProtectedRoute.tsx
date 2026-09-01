import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SmartTutorChat } from './SmartTutorChat';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert } from 'lucide-react';

const ProtectedRoute = () => {
  const { user, profile } = useAuth();
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkMaintenance = async () => {
      try {
        // Set a 3-second timeout for the maintenance check. If it fails or hangs, we fail OPEN (allow access)
        const fetchPromise = supabase.from('admin_settings').select('*').eq('setting_key', 'maintenance_mode').single();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Maintenance check timeout')), 3000);
        });

        const { data } = await Promise.race([fetchPromise, timeoutPromise]) as any;
        
        if (isMounted && data && data.setting_value) {
          setMaintenance(data.setting_value);
        }
      } catch (e) {
        console.warn('Maintenance check failed or timed out. Defaulting to open.', e);
        // On error or timeout, we assume maintenance is FALSE to prevent accidental platform lockout
        if (isMounted) {
          setMaintenance({ enabled: false, message: '' });
        }
      } finally {
        if (isMounted) setLoading(false);
        clearTimeout(timeoutId);
      }
    };
    
    checkMaintenance();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading workspace...</div>;

  const AUTHORIZED_ADMIN_EMAILS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isMasterAdmin = AUTHORIZED_ADMIN_EMAILS.includes(userEmail) || profile?.role === 'admin';

  // Block access if maintenance mode is enabled AND user is not an admin
  if (maintenance.enabled && !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">System Maintenance</h1>
        <p className="text-lg text-slate-400 max-w-md">{maintenance.message || "We are currently undergoing scheduled maintenance. Please check back soon."}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // 0. If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Block access if account is suspended
  if (profile?.role === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="w-16 h-16 text-amber-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4">Account Suspended</h1>
        <p className="text-lg text-slate-400 max-w-md">
          Your account access has been suspended by an administrator. Please contact support at support@scholarsresort.com for assistance.
        </p>
      </div>
    );
  }

  // 1. If student has not completed onboarding, force them to onboarding first.
  if (profile?.role === 'student' && profile?.onboarding_completed !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  // 2. Once onboarded, if student hasn't paid, hit the paywall. (Admins are exempt)
  if (!isMasterAdmin && !profile?.has_paid) {
    return <Navigate to="/pricing" replace />;
  }

  return (
    <>
      <Outlet />
      <SmartTutorChat />
    </>
  );
};

export default ProtectedRoute;
