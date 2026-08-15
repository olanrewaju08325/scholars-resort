import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SMTP_HOSTNAME = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME');
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'reports@scholarsresort.com';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active guardian links
    const { data: links, error } = await supabase
      .from('guardian_links')
      .select('guardian_id, student_id, profiles!guardian_links_guardian_id_fkey(email, full_name)')
      .eq('status', 'active');

    if (error || !links) throw error;

    if (!SMTP_USERNAME || !SMTP_PASSWORD) {
      console.log('SMTP credentials not set. Mocking email notification:');
      return new Response(JSON.stringify({ message: 'Mock email logged. Please set SMTP env vars.', count: links.length }), { status: 200 });
    }

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: SMTP_HOSTNAME,
      port: SMTP_PORT,
      username: SMTP_USERNAME,
      password: SMTP_PASSWORD,
    });

    let sentCount = 0;

    for (const link of links) {
      const guardianEmail = link.profiles?.email;
      if (!guardianEmail) continue;

      // Get student's stats
      const { data: student } = await supabase.from('profiles').select('full_name, streak_days').eq('id', link.student_id).single();
      const { data: sessions } = await supabase.from('exam_sessions').select('*').eq('user_id', link.student_id).eq('status', 'submitted');
      
      const totalExams = sessions ? sessions.length : 0;
      let avgScore = 0;
      if (totalExams > 0) {
        avgScore = Math.round(sessions!.reduce((a, b) => a + (b.score || 0), 0) / totalExams);
      }

      await client.send({
        from: FROM_EMAIL,
        to: guardianEmail,
        subject: `Weekly Progress Report for ${student?.full_name}`,
        content: `
Hello ${link.profiles?.full_name},

Here is the weekly automated progress report for your ward, ${student?.full_name}.

- Total Exams Completed: ${totalExams}
- Average Score: ${avgScore} (out of 400)
- Current Study Streak: ${student?.streak_days || 0} days

Keep encouraging them to practice!

Best regards,
Scholars Resort Team
        `,
      });
      sentCount++;
    }

    await client.close();

    return new Response(JSON.stringify({ success: true, emails_sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
