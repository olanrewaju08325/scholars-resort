import type { VercelRequest } from '@vercel/node';
import { createClient, type User } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const authSupabase = createClient(supabaseUrl, supabaseKey);

export const AUTHORIZED_ADMIN_EMAILS = [
  'admitwise2@gmail.com',
  'olanrewajuhamilot@gmail.com'
];

export interface AuthResult {
  authorized: boolean;
  status: number;
  error?: string;
  user?: User;
}

/**
 * Extracts and verifies the bearer token from a request
 */
export async function getAuthenticatedUser(req: VercelRequest | any): Promise<User | null> {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return null;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    if (!token) return null;

    const { data: { user }, error } = await authSupabase.auth.getUser(token);
    if (error || !user) return null;

    return user;
  } catch (err) {
    console.warn('[ServerAuth] Token verification failed:', err);
    return null;
  }
}

/**
 * Verifies that the requester is a verified Administrator
 */
export async function verifyAdmin(req: VercelRequest | any): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: 'Authentication required. Please provide a valid Bearer token.'
    };
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  if (AUTHORIZED_ADMIN_EMAILS.includes(userEmail)) {
    return { authorized: true, status: 200, user };
  }

  // Also check database profile role
  try {
    const { data: profile } = await authSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return { authorized: true, status: 200, user };
    }
  } catch (err) {
    console.warn('[ServerAuth] Admin profile check error:', err);
  }

  return {
    authorized: false,
    status: 403,
    error: 'Access denied: Administrator privileges required.'
  };
}

/**
 * Verifies that the requester is a verified Guardian or Admin,
 * and if a studentId is provided, that they are linked to the student.
 */
export async function verifyGuardian(req: VercelRequest | any, studentId?: string): Promise<AuthResult> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: 'Authentication required. Please provide a valid Bearer token.'
    };
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.includes(userEmail);

  if (isAdmin) {
    return { authorized: true, status: 200, user };
  }

  // Check if profile is guardian
  let isGuardian = false;
  try {
    const { data: profile } = await authSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'guardian' || profile?.role === 'admin') {
      isGuardian = true;
    }
  } catch (_) {}

  if (!isGuardian) {
    return {
      authorized: false,
      status: 403,
      error: 'Access denied: Guardian role required.'
    };
  }

  if (studentId) {
    // Verify link to student
    try {
      const { data: rel } = await authSupabase
        .from('guardian_student_relationships')
        .select('id')
        .eq('guardian_id', user.id)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle();

      if (!rel) {
        const { data: link } = await authSupabase
          .from('guardian_links')
          .select('id')
          .eq('guardian_id', user.id)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle();

        if (!link) {
          return {
            authorized: false,
            status: 403,
            error: 'Access denied: Not authorized to view this student.'
          };
        }
      }
    } catch (_) {
      return {
        authorized: false,
        status: 500,
        error: 'Database verification failed.'
      };
    }
  }

  return { authorized: true, status: 200, user };
}
