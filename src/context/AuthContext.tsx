import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: 'student' | 'admin' | 'suspended';
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
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('scholars_cached_profile');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetRequesting, setResetRequesting] = useState(false);
  const isMounted = useRef(true);
  const isFetchingProfile = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  /**
   * Save loaded profile to state & local persistent cache
   */
  const commitProfile = (p: Profile) => {
    if (!isMounted.current) return;
    setProfile(p);
    try {
      localStorage.setItem('scholars_cached_profile', JSON.stringify(p));
    } catch {}
  };

  /**
   * Fetch profile with retry logic and exponential backoff to handle network drops and connection resets.
   * Retries up to 5 times with exponential backoff and jitter.
   */
  const fetchProfile = async (userId: string, attempt = 1): Promise<void> => {
    const MAX_ATTEMPTS = 5;
    const TIMEOUT_MS = 10000;

    try {
      isFetchingProfile.current = true;
      
      // 1. Fetch authoritatively from backend API (which merges database and server-side persistent overrides)
      let loadedProfile: Profile | null = null;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (sessionData?.session?.access_token) {
          headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
        }
        const apiRes = await fetch(getApiUrl(`/api/profile/${userId}`), { headers });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && apiData.success && apiData.profile) {
            loadedProfile = apiData.profile as Profile;
          }
        }
      } catch (err) {
        console.warn('API profile fetch notice:', err);
      }

      // 2. Fallback to Supabase direct query if API didn't return
      if (!loadedProfile) {
        const fetchPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), TIMEOUT_MS)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;
        if (data && !error) {
          loadedProfile = data as Profile;
        }
      }

      if (!isMounted.current) return;

      if (loadedProfile) {
        try {
          const localOverrides = JSON.parse(localStorage.getItem('scholars_user_overrides') || '{}');
          if (localOverrides[userId]) {
            loadedProfile = { ...loadedProfile, ...localOverrides[userId] };
          }
        } catch {}

        // Master admin auto-elevation check using both profile and authenticated user email sources
        const currentEmail = (user?.email || loadedProfile.email || '').toLowerCase().trim();
        const isMasterAdmin = currentEmail && AUTHORIZED_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === currentEmail);
        
        if (isMasterAdmin) {
          loadedProfile.role = 'admin';
          loadedProfile.email = currentEmail;
          loadedProfile.has_paid = true;
          loadedProfile.onboarding_completed = true;
          supabase.from('profiles').update({ 
            role: 'admin', 
            email: currentEmail, 
            has_paid: true, 
            onboarding_completed: true 
            }).eq('id', userId).then();
        }
        
        commitProfile(loadedProfile);
        setLoading(false);
      } else {
        // Profile row does not exist yet. Auto-create in DB to ensure foreign key constraints pass
        console.warn(`[AuthContext] No profile record found for user ${userId}. Creating default profile...`);
        const userEmail = (user?.email || '').toLowerCase().trim();
        const isAdminEmail = userEmail && AUTHORIZED_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === userEmail);
        const assignedRole: Profile['role'] = isAdminEmail ? 'admin' : 'student';

        const newProfile: Partial<Profile> = {
          id: userId,
          role: assignedRole,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholar Student',
          email: user?.email || '',
          has_paid: isAdminEmail ? true : false,
          onboarding_completed: isAdminEmail ? true : false,
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
            commitProfile((upsertData as Profile) || (newProfile as Profile));
            setLoading(false);
          }
        } catch {
          if (isMounted.current) {
            commitProfile(newProfile as Profile);
            setLoading(false);
          }
        }
      }
    } catch (err: any) {
      if (!isMounted.current) return;
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000) + Math.random() * 300;
        console.warn(`[AuthContext] Profile fetch attempt ${attempt} threw (${err.message}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return fetchProfile(userId, attempt + 1);
      }
      console.warn('[AuthContext] Profile fetch threw error, using fallback profile:', err);
      if (isMounted.current) {
        const userEmail = (user?.email || '').toLowerCase().trim();
        const isAdminEmail = userEmail && AUTHORIZED_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === userEmail);
        const fallbackRole: Profile['role'] = isAdminEmail ? 'admin' : 'student';

        if (!profile) {
          commitProfile({
            id: userId,
            role: fallbackRole,
            full_name: user?.user_metadata?.full_name || 'Scholar Student',
            email: user?.email || '',
            has_paid: isAdminEmail ? true : false,
            onboarding_completed: isAdminEmail ? true : false,
            xp: 0,
            coins: 0,
          });
        }
        setLoading(false);
      }
    } finally {
      isFetchingProfile.current = false;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // Persistent session verification & heartbeat
  useEffect(() => {
    let sessionInterval: NodeJS.Timeout;

    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[AuthContext] Session verification warning:', error.message);
          return;
        }
        if (!isMounted.current) return;

        if (session?.user) {
          setUser(session.user);
          if (!profile || profile.id !== session.user.id) {
            fetchProfile(session.user.id);
          }
        } else {
          // If no active session from Supabase but user was cached, attempt token refresh
          if (user) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.user) {
              setUser(refreshed.user);
            } else {
              setUser(null);
              setProfile(null);
              localStorage.removeItem('scholars_cached_profile');
            }
          }
          setLoading(false);
        }
      } catch (e) {
        console.warn('[AuthContext] verifySession exception:', e);
      }
    };

    // 1. Initial verification on mount
    verifySession();

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted.current) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        localStorage.removeItem('scholars_cached_profile');
        setLoading(false);
      }
    });

    // 3. Periodic heartbeat verification every 60 seconds
    sessionInterval = setInterval(verifySession, 60000);

    // 4. Re-verify when tab becomes visible or focused
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        verifySession();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', verifySession);

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', verifySession);
    };
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
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-amber-400">Device Security Policy</h2>
            
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                Why are you seeing this screen?
              </p>
              <p className="text-slate-400 leading-relaxed">
                To guarantee examination integrity, UTME mock score fairness, and account security, each student account is paired to <strong>one active device</strong>.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Your account is currently bound to your previous device. You can continue studying on your original device, or click below to submit a 1-click device reset request.
              </p>
            </div>

            <button
              onClick={handleRequestDeviceReset}
              disabled={resetRequesting}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20 text-sm"
            >
              {resetRequesting ? 'Submitting Reset Request...' : 'Request Instant Device Reset'}
            </button>
            <button
              onClick={signOut}
              className="w-full h-10 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign out and use original device
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
