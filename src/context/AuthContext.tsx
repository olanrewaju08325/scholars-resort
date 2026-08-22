import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: 'student' | 'guardian' | 'admin' | 'suspended';
  full_name: string;
  email?: string;
  phone?: string;
  device_uuid?: string;
  has_paid: boolean;
  onboarding_completed?: boolean;
  streak_days?: number;
  streak_freezes?: number;
  longest_streak?: number;
  last_study_date?: string;
  target_score?: number;
  target_university?: string;
  daily_study_goal_minutes?: number;
  utme_subjects?: string[];
  exam_date?: string;
  avatar_url?: string;
  invite_code?: string;
  xp?: number;
  coins?: number;
  created_at?: string;
  updated_at?: string;
  referral_code?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isDeviceLocked: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isDeviceLocked: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AUTHORIZED_ADMIN_EMAILS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetRequesting, setResetRequesting] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  /**
   * Fetch profile with retry logic and timeout to handle ERR_CONNECTION_CLOSED.
   * Retries up to 3 times with 1-second delay between attempts.
   */
  /**
   * Fetch profile with retry logic and timeout to handle ERR_CONNECTION_CLOSED.
   * Retries up to 5 times with exponential backoff delay between attempts.
   */
  const fetchProfile = async (userId: string, attempt = 1): Promise<void> => {
    const MAX_ATTEMPTS = 5;
    const TIMEOUT_MS = 8000;

    try {
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), TIMEOUT_MS)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;

      if (!isMounted.current) return;

      if (data && !error) {
        let loadedProfile = data as Profile;
        // Master admin auto-elevation check using both profile and authenticated user email sources
        const currentEmail = user?.email || loadedProfile.email || '';
        const isMasterAdmin = currentEmail && AUTHORIZED_ADMIN_EMAILS.includes(currentEmail);
        
        if (isMasterAdmin && (loadedProfile.role !== 'admin' || !loadedProfile.email)) {
          loadedProfile.role = 'admin';
          loadedProfile.email = currentEmail;
          supabase.from('profiles').update({ role: 'admin', email: currentEmail }).eq('id', userId).then();
        }
        setProfile(loadedProfile);
        setLoading(false);
      } else if (!data && !error) {
        // Profile row does not exist yet. Auto-create in DB to ensure foreign key constraints pass
        console.warn(`[AuthContext] No profile record found for user ${userId}. Creating default profile...`);
        const isAdminEmail = user?.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email);
        const metaRole = user?.user_metadata?.role;
        const pendingInvite = localStorage.getItem('pending_guardian_code');
        const assignedRole: Profile['role'] = isAdminEmail 
          ? 'admin' 
          : (metaRole === 'guardian' || metaRole === 'parent' || !!pendingInvite ? 'guardian' : 'student');
        const isGuardian = assignedRole === 'guardian';

        const newProfile: Partial<Profile> = {
          id: userId,
          role: assignedRole,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || (isGuardian ? 'Parent/Guardian' : 'Scholar Student'),
          email: user?.email || '',
          has_paid: isAdminEmail || isGuardian ? true : false,
          streak_days: 0,
          xp: 0,
          coins: 0,
        };

        try {
          const { data: upsertData } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select('*')
            .maybeSingle();

          if (isMounted.current) {
            setProfile((upsertData as Profile) || (newProfile as Profile));
            setLoading(false);
          }
        } catch {
          if (isMounted.current) {
            setProfile(newProfile as Profile);
            setLoading(false);
          }
        }
      } else if (error && attempt < MAX_ATTEMPTS) {
        // Retry on transient errors (connection closed, network blip)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
        console.warn(`[AuthContext] Profile fetch attempt ${attempt} failed (${error.message}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return fetchProfile(userId, attempt + 1);
      } else {
        console.warn('[AuthContext] Profile fetch failed, using fallback profile:', error);
        if (isMounted.current) {
          const isAdminEmail = user?.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email);
          const metaRole = user?.user_metadata?.role;
          const pendingInvite = localStorage.getItem('pending_guardian_code');
          const fallbackRole: Profile['role'] = isAdminEmail 
            ? 'admin' 
            : (metaRole === 'guardian' || metaRole === 'parent' || !!pendingInvite ? 'guardian' : 'student');
          const isGuardian = fallbackRole === 'guardian';

          setProfile({
            id: userId,
            role: fallbackRole,
            full_name: user?.user_metadata?.full_name || (isGuardian ? 'Parent/Guardian' : 'Scholar Student'),
            email: user?.email || '',
            has_paid: isAdminEmail || isGuardian ? true : false,
            xp: 0,
            coins: 0,
          });
          setLoading(false);
        }
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
        console.warn(`[AuthContext] Profile fetch attempt ${attempt} threw (${err.message}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return fetchProfile(userId, attempt + 1);
      }
      console.warn('[AuthContext] Profile fetch threw error, using fallback profile:', err);
      if (isMounted.current) {
        const isAdminEmail = user?.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email);
        const metaRole = user?.user_metadata?.role;
        const fallbackRole: Profile['role'] = isAdminEmail 
          ? 'admin' 
          : (metaRole === 'guardian' || metaRole === 'parent' ? 'guardian' : 'student');
        const isGuardian = fallbackRole === 'guardian';

        setProfile({
          id: userId,
          role: fallbackRole,
          full_name: user?.user_metadata?.full_name || (isGuardian ? 'Parent/Guardian' : 'Scholar Student'),
          email: user?.email || '',
          has_paid: isAdminEmail || isGuardian ? true : false,
          xp: 0,
          coins: 0,
        });
        setLoading(false);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Get session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen to profile changes in Realtime (for instant has_paid update after admin approval)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (isMounted.current) {
            setProfile((prev) => (prev ? { ...prev, ...payload.new } : (payload.new as Profile)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Device Lock Check — runs once profile is loaded
  useEffect(() => {
    if (!profile) return;

    // Admins and Master Accounts are completely exempt from Device Lock
    if (
      profile.role === 'admin' || 
      (profile.email && AUTHORIZED_ADMIN_EMAILS.includes(profile.email)) || 
      (user?.email && AUTHORIZED_ADMIN_EMAILS.includes(user.email))
    ) {
      setIsDeviceLocked(false);
      const localDeviceId = localStorage.getItem('scholars_resort_device_uuid');
      if (!localDeviceId) {
        const newDeviceId = profile.device_uuid || crypto.randomUUID();
        localStorage.setItem('scholars_resort_device_uuid', newDeviceId);
      }
      setLoading(false);
      return;
    }

    const localDeviceId = localStorage.getItem('scholars_resort_device_uuid');

    if (!localDeviceId && !profile.device_uuid) {
      // First login ever — register this device
      const newDeviceId = crypto.randomUUID();
      localStorage.setItem('scholars_resort_device_uuid', newDeviceId);
      supabase.from('profiles').update({ device_uuid: newDeviceId }).eq('id', profile.id).then();
      setIsDeviceLocked(false);
    } else if (!localDeviceId && profile.device_uuid) {
      // New device or cleared storage
      setIsDeviceLocked(true);
    } else if (profile.device_uuid && localDeviceId !== profile.device_uuid) {
      // Different device than registered
      setIsDeviceLocked(true);
    } else {
      setIsDeviceLocked(false);
    }

    setLoading(false);
  }, [profile, user]);

  const handleRequestDeviceReset = async () => {
    if (!profile || resetRequesting) return;
    setResetRequesting(true);
    try {
      await supabase.from('support_tickets').insert({
        user_id: profile.id,
        category: 'device_reset',
        subject: 'Device Reset Request',
        message: `User ${profile.full_name} (${profile.id}) is requesting a device reset. Their account is locked to a different device.`,
        status: 'open',
      });
      alert('Reset request submitted successfully. An admin will approve it within 24 hours. You may close this tab.');
    } catch {
      alert('Failed to submit reset request. Please contact support at support@scholarsresort.com');
    } finally {
      setResetRequesting(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsDeviceLocked(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isDeviceLocked, loading, signOut, refreshProfile }}>
      {!loading && isDeviceLocked ? (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-3">Device Locked</h2>
            <p className="text-slate-400 mb-2 text-sm leading-relaxed">
              Your Scholars Resort account is currently tied to a different device.
            </p>
            <p className="text-slate-500 text-xs mb-6">
              You are allowed 1 device reset per month. Submit a request and an administrator will approve it within 24 hours.
            </p>
            <button
              onClick={handleRequestDeviceReset}
              disabled={resetRequesting}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resetRequesting ? 'Submitting...' : 'Request Device Reset'}
            </button>
            <button
              onClick={signOut}
              className="w-full mt-3 h-10 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
