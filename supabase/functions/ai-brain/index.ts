import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    
    if (payload.table !== 'exam_sessions' || payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: "Ignored" }), { headers: corsHeaders, status: 200 })
    }

    const session = payload.record;
    if (!session || !session.user_id) {
      throw new Error("Invalid session payload");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    const { data: profile } = await supabase.from('profiles').select('email, full_name, level, xp, coins').eq('id', session.user_id).single();
    if (!profile) throw new Error("Profile not found");

    // 1. Fetch Session Answers
    const { data: answers } = await supabase
      .from('session_answers')
      .select('is_correct, questions!inner(subjects!inner(name), topic, difficulty)')
      .eq('exam_session_id', session.id);
      
    // 2. Score & Topics Calc
    let scorePercentage = session.total_questions > 0 ? Math.round((session.score / session.total_questions) * 100) : 0;
    
    let weakTopicsMap: Record<string, number> = {};
    let strongTopicsMap: Record<string, number> = {};
    
    (answers || []).forEach((ans: any) => {
      const topic = ans.questions?.topic || 'General';
      if (!ans.is_correct) {
        weakTopicsMap[topic] = (weakTopicsMap[topic] || 0) + 1;
      } else {
        strongTopicsMap[topic] = (strongTopicsMap[topic] || 0) + 1;
      }
    });
    
    const weakList = Object.keys(weakTopicsMap).sort((a, b) => weakTopicsMap[b] - weakTopicsMap[a]).slice(0, 3).join(', ') || 'General Knowledge';
    const strongList = Object.keys(strongTopicsMap).sort((a, b) => strongTopicsMap[b] - strongTopicsMap[a]).slice(0, 3).join(', ');

    // 3. Award XP & Coins (Gamification)
    const xpEarned = Math.round(scorePercentage * 2.5) + 50; // Base 50 + score bonus
    const coinsEarned = scorePercentage >= 70 ? 20 : (scorePercentage >= 50 ? 10 : 5);
    const newXp = (profile.xp || 0) + xpEarned;
    const newLevel = Math.floor(newXp / 1000) + 1;

    await supabase.from('profiles').update({
      xp: newXp,
      level: newLevel,
      coins: (profile.coins || 0) + coinsEarned
    }).eq('id', session.user_id);

    // 4. Update Leaderboard (Activity Heatmap/Study Logs handled via DB triggers in production, assuming study_logs inserted)

    // 5. Regenerate Study Plan
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    await supabase.from('study_plan_tasks').insert([
      { user_id: session.user_id, date: dateStr, time_slot: 'morning', title: `Review weak topics: ${weakList}`, is_completed: false },
      { user_id: session.user_id, date: dateStr, time_slot: 'afternoon', title: `Take Flashcards on ${weakList.split(',')[0] || 'Physics'}`, is_completed: false }
    ]);

    // 6. Guardian Notification (SMTP)
    const { data: guardianMapping } = await supabase.from('guardian_students').select('guardian_id').eq('student_id', session.user_id).maybeSingle();
    
    if (guardianMapping?.guardian_id) {
      const { data: guardian } = await supabase.from('profiles').select('email').eq('id', guardianMapping.guardian_id).single();
      
      if (guardian?.email) {
        await supabase.functions.invoke('communication-center', {
          body: {
            to: guardian.email,
            templateName: 'report_card',
            payload: { studentName: profile.full_name, totalExams: 1, avgScore: scorePercentage, streak: 1 }
          }
        });
      }
    }

    // 7. Activity Log & Push Notification
    await supabase.from('activity_logs').insert({
      user_id: session.user_id,
      action: 'ai_review_completed',
      metadata: {
        score: scorePercentage,
        weak_topics: weakList,
        xp_earned: xpEarned,
        coins_earned: coinsEarned,
        message: `AI Review: You scored ${scorePercentage}%. Focus on ${weakList}. +${xpEarned} XP!`,
        recommendations: [
          { type: 'flashcard', label: `Flashcards on ${weakList.split(',')[0] || 'Physics'}` },
          { type: 'video', label: `Video Tutorial on ${weakList.split(',')[1] || 'Maths'}` },
          { type: 'tournament', label: 'Join the Weekly Mock Tournament' }
        ]
      }
    });

    return new Response(JSON.stringify({ success: true, ai_analysis: { weakList, strongList, xpEarned } }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
    
  } catch (error) {
    console.error("AI Brain Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    })
  }
})
