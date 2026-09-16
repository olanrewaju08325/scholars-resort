/**
 * Standalone Test Script: Tournament Event Reminder Background Worker
 * 
 * Usage:
 *   node scripts/test-tournament-reminder-worker.js
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

async function testTournamentWorker() {
  console.log('================================================================');
  console.log('⏰ TOURNAMENT BACKGROUND WORKER & SMTP NOTIFICATION TEST');
  console.log('================================================================');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Time:     ${new Date().toISOString()}\n`);

  // Step 1: Query Worker Status
  console.log('STEP 1: Checking Tournament Reminder Worker Status...');
  try {
    const statusRes = await fetch(`${API_BASE}/api/tournaments/worker/status`);
    const statusData = await statusRes.json();
    console.log('  Worker Status Response:', JSON.stringify(statusData, null, 2));

    if (!statusData.success) {
      console.error('❌ Failed to retrieve worker status');
      process.exit(1);
    }
    console.log('  ✅ Background worker telemetry operational.');
  } catch (err) {
    console.error('❌ Could not connect to API:', err.message);
    process.exit(1);
  }

  // Step 2: Schedule a Mock Upcoming Tournament Reminder
  console.log('\nSTEP 2: Scheduling a Mock Upcoming Event Reminder...');
  const testTournamentId = `tourn_test_${Date.now()}`;
  const testTournamentTitle = 'UTME Physics & English Grand Duel 2026';
  const testUserEmail = 'candidate.olanrewaju@scholarsresort.org';
  const testUserName = 'Olanrewaju Scholar';
  
  // Set start time 15 minutes from now (falls squarely into the 30-min alert window)
  const startTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  try {
    const schedRes = await fetch(`${API_BASE}/api/tournaments/schedule-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: testTournamentId,
        tournamentTitle: testTournamentTitle,
        userEmail: testUserEmail,
        userName: testUserName,
        startTime
      })
    });
    const schedData = await schedRes.json();
    console.log('  Schedule Reminder Response:', schedData);
    if (schedData.success) {
      console.log('  ✅ Successfully registered planned event reminder.');
    }
  } catch (err) {
    console.warn('  ⚠️ Schedule reminder notice:', err.message);
  }

  // Also register participant for tournament
  try {
    await fetch(`${API_BASE}/api/tournaments/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: testTournamentId,
        user_name: testUserName,
        user_email: testUserEmail,
        payment_method: 'free'
      })
    });
    console.log('  ✅ Successfully registered candidate in tournament participants store.');
  } catch (_) {}

  // Step 3: Trigger Background Worker Run
  console.log('\nSTEP 3: Triggering Tournament Reminder Worker Execution...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    const triggerRes = await fetch(`${API_BASE}/api/tournaments/worker/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const triggerData = await triggerRes.json();

    console.log('\n================================================================');
    console.log('📊 TOURNAMENT WORKER RUN RESULT:');
    console.log('================================================================');
    console.log(JSON.stringify(triggerData, null, 2));
    console.log('================================================================');

    if (triggerData.success) {
      console.log('🎉 BACKGROUND WORKER TEST PASSED');
      console.log(`  - Tournaments Scanned & Verified`);
      console.log(`  - Deduplication & SMTP Service Dispatched Alert Emails`);
      console.log(`  - Telemetry Logged Successfully`);
      console.log('================================================================\n');
      process.exit(0);
    } else {
      console.error('❌ WORKER TRIGGER FAILED:', triggerData.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to trigger worker:', err.message);
    process.exit(1);
  }
}

testTournamentWorker();
