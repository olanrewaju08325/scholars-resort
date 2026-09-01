import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://syoodykedvqaoeplmamd.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SERVER_URL = 'http://localhost:3000';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 SCHOLARS RESORT: PHASE 2 SECURITY & IDOR HARDENING VERIFICATION');
  console.log('===============================================================');

  // 1. Authenticate Admin
  console.log('\n[Auth] Authenticating Admin user (admitwise2@gmail.com)...');
  const adminAuth = await supabase.auth.signInWithPassword({
    email: 'admitwise2@gmail.com',
    password: 'Halimot08*'
  });

  if (adminAuth.error) {
    console.error('❌ Admin auth failed:', adminAuth.error.message);
    process.exit(1);
  }
  const adminToken = adminAuth.data.session.access_token;
  const adminUserId = adminAuth.data.user.id;
  console.log('✅ Admin authenticated. User ID:', adminUserId);

  // 2. Authenticate standard Student
  const studentEmail = `student_test_${Date.now()}@example.com`;
  const studentPassword = 'Password123!';
  console.log(`\n[Auth] Registering standard Student user (${studentEmail})...`);
  const studentSignUp = await supabase.auth.signUp({
    email: studentEmail,
    password: studentPassword
  });

  if (studentSignUp.error) {
    console.error('❌ Student signup failed:', studentSignUp.error.message);
    process.exit(1);
  }

  const studentToken = studentSignUp.data.session?.access_token;
  const studentUserId = studentSignUp.data.user?.id;

  if (!studentToken || !studentUserId) {
    console.log('⚠️ Automatic login after signup not supported, logging in explicitly...');
    const studentLogin = await supabase.auth.signInWithPassword({
      email: studentEmail,
      password: studentPassword
    });
    if (studentLogin.error) {
      console.error('❌ Student login failed:', studentLogin.error.message);
      process.exit(1);
    }
  }

  const activeStudentToken = studentToken || studentSignUp.data.session?.access_token;
  const activeStudentId = studentUserId;
  console.log('✅ Student authenticated. User ID:', activeStudentId);

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  // --- TEST 1: Platform Health Endpoint ---
  console.log('\n--- TEST 1: Platform Health Endpoint (/api/health) ---');
  try {
    const res = await fetch(`${SERVER_URL}/api/health`);
    assert(res.ok, 'Unauthenticated status ok is 200');
    const data = await res.json();
    assert(data.status === 'healthy', 'Status is "healthy"');
    assert(data.database === 'connected', 'Database is "connected"');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 2: IDOR on Profile Fetch ---
  console.log('\n--- TEST 2: Profile Fetch (/api/profile/:id) ---');
  try {
    // A. Anonymous fetch
    const resAnon = await fetch(`${SERVER_URL}/api/profile/${activeStudentId}`);
    assert(resAnon.status === 401, 'Anonymous request gets 401 Unauthorized');

    // B. Student fetch other user's profile
    const resOther = await fetch(`${SERVER_URL}/api/profile/${adminUserId}`, {
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resOther.status === 403, 'Student trying to fetch Admin profile gets 403 Forbidden');

    // C. Student fetch own profile
    const resOwn = await fetch(`${SERVER_URL}/api/profile/${activeStudentId}`, {
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resOwn.ok, 'Student can fetch their own profile (200)');
    const ownData = await resOwn.json();
    assert(ownData.profile?.id === activeStudentId, 'Profile returned belongs to the student');

    // D. Admin fetch student profile
    const resAdmin = await fetch(`${SERVER_URL}/api/profile/${activeStudentId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(resAdmin.ok, 'Admin can fetch student profile (200)');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 3: IDOR on Exam Active Status ---
  console.log('\n--- TEST 3: Active Exam Status (/api/exam-session/active-status) ---');
  try {
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/exam-session/active-status?userId=${activeStudentId}`);
    assert(resAnon.status === 401, 'Anonymous request gets 401 Unauthorized');

    // B. Student other user
    const resOther = await fetch(`${SERVER_URL}/api/exam-session/active-status?userId=${adminUserId}`, {
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resOther.status === 403, 'Student checking Admin active status gets 403 Forbidden');

    // C. Student own active status
    const resOwn = await fetch(`${SERVER_URL}/api/exam-session/active-status?userId=${activeStudentId}`, {
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resOwn.ok, 'Student can check their own active status (200)');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 4: Send Bulk Email Endpoint Protection ---
  console.log('\n--- TEST 4: Send Bulk Email (/api/send-bulk-email) ---');
  try {
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/send-bulk-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Test', html: 'test' })
    });
    assert(resAnon.status === 401, 'Anonymous gets 401 Unauthorized');

    // B. Student
    const resStudent = await fetch(`${SERVER_URL}/api/send-bulk-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeStudentToken}`
      },
      body: JSON.stringify({ subject: 'Test', html: 'test' })
    });
    assert(resStudent.status === 403, 'Student gets 403 Forbidden');

    // C. Admin
    const resAdmin = await fetch(`${SERVER_URL}/api/send-bulk-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ subject: 'Test', html: 'test' })
    });
    assert(resAdmin.status !== 401 && resAdmin.status !== 403, 'Admin gets authorized (non-401/403 status)');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 5: Admin Device Reset Endpoint Protection ---
  console.log('\n--- TEST 5: Admin Device Reset (/api/admin/device/reset) ---');
  try {
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/admin/device/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' })
    });
    assert(resAnon.status === 401, 'Anonymous gets 401 Unauthorized');

    // B. Student
    const resStudent = await fetch(`${SERVER_URL}/api/admin/device/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeStudentToken}`
      },
      body: JSON.stringify({ email: 'test@test.com' })
    });
    assert(resStudent.status === 403, 'Student gets 403 Forbidden');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 6: Groq Telemetry Endpoint Protection ---
  console.log('\n--- TEST 6: Groq Telemetry (/api/groq-telemetry) ---');
  try {
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/groq-telemetry`);
    assert(resAnon.status === 401, 'Anonymous gets 401 Unauthorized');

    // B. Student
    const resStudent = await fetch(`${SERVER_URL}/api/groq-telemetry`, {
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resStudent.status === 403, 'Student gets 403 Forbidden');

    // C. Admin
    const resAdmin = await fetch(`${SERVER_URL}/api/groq-telemetry`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(resAdmin.ok, 'Admin can fetch telemetry (200)');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 7: Delete Question Endpoint Protection ---
  console.log('\n--- TEST 7: Delete Question (/api/questions/:id) ---');
  try {
    const dummyId = '00000000-0000-0000-0000-000000000000';
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/questions/${dummyId}`, {
      method: 'DELETE'
    });
    assert(resAnon.status === 401, 'Anonymous gets 401 Unauthorized');

    // B. Student
    const resStudent = await fetch(`${SERVER_URL}/api/questions/${dummyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${activeStudentToken}` }
    });
    assert(resStudent.status === 403, 'Student gets 403 Forbidden');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  // --- TEST 8: Update Question Endpoint Protection ---
  console.log('\n--- TEST 8: Update Question (/api/questions/:id) ---');
  try {
    const dummyId = '00000000-0000-0000-0000-000000000000';
    // A. Anonymous
    const resAnon = await fetch(`${SERVER_URL}/api/questions/${dummyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_text: 'Test' })
    });
    assert(resAnon.status === 401, 'Anonymous gets 401 Unauthorized');

    // B. Student
    const resStudent = await fetch(`${SERVER_URL}/api/questions/${dummyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeStudentToken}`
      },
      body: JSON.stringify({ question_text: 'Test' })
    });
    assert(resStudent.status === 403, 'Student gets 403 Forbidden');
  } catch (err) {
    console.error('  ❌ Request failed:', err.message);
    failedTests++;
  }

  console.log('\n===============================================================');
  console.log(`📊 TEST EXECUTION SUMMARY`);
  console.log(`  PASSED: ${passedTests}`);
  console.log(`  FAILED: ${failedTests}`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
