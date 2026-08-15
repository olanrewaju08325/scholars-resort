const SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

async function testAI() {
  console.log('Testing AI Edge Function (ai-gateway)...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        action: 'chat',
        payload: { messages: [{ role: 'user', content: 'Say OK in exactly 2 letters without punctuation.' }] }
      })
    });
    const data = await res.json();
    console.log('AI Response Status:', res.status);
    console.log('AI Response Data:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('AI Test Failed:', e.message);
  }
}

async function testSMTP() {
  console.log('\nTesting SMTP Edge Function (communication-center)...');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/communication-center`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}` 
      },
      body: JSON.stringify({
        to: 'test@example.com',
        templateName: 'welcome',
        payload: { name: 'Test User' }
      })
    });
    const text = await res.text();
    console.log('SMTP Response Status:', res.status);
    console.log('SMTP Response Data:', text);
  } catch (e) {
    console.error('SMTP Test Failed:', e.message);
  }
}

async function run() {
  await testAI();
  await testSMTP();
}

run();
