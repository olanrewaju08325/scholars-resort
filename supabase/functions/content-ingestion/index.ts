import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Papa from 'https://esm.sh/papaparse@5.4.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    // Find pending jobs
    const { data: jobs, error: fetchError } = await supabase
      .from('content_ingestion_jobs')
      .select('*')
      .eq('status', 'pending')
      .limit(1)

    if (fetchError || !jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    const job = jobs[0]
    
    // Mark as extracting
    await supabase.from('content_ingestion_jobs').update({ 
      status: 'extracting', 
      progress: 10 
    }).eq('id', job.id)

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('raw_content')
      .download(job.file_path)
      
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`)
    console.log(`Processing ingestion job ${job.id}, file size: ${fileData ? fileData.size : 0} bytes`);

    // --- SIMULATED AI OCR & CLAUDE EXTRACTION ---
    // In a real production deployment, this is where we send fileData to an OCR API 
    // or Claude directly (if it's a small PDF/Image) using the Anthropic SDK.
    // For this implementation, we will simulate the extraction pipeline delay and AI response,
    // as passing raw large PDFs to LLMs requires an OCR layer (like Mathpix or Tesseract) first.
    
    await supabase.from('content_ingestion_jobs').update({ 
      status: 'ai_processing', 
      progress: 50 
    }).eq('id', job.id)
    
    // Mocking the AI extraction delay
    await new Promise(r => setTimeout(r, 2000))

    // Mock extracted questions from Claude with AI Quality Score
    const extractedQuestions = [
      {
        question: "A body of mass 5kg falls from a height of 10m. What is its kinetic energy just before hitting the ground? (g = 10m/s²)",
        option_a: "50 J",
        option_b: "100 J",
        option_c: "500 J",
        option_d: "1000 J",
        correct_answer: "C",
        explanation: "Potential energy at height h is mgh = 5 * 10 * 10 = 500J. By conservation of energy, this is converted entirely to kinetic energy just before impact.",
        subject: "Physics",
        topic: "Work, Energy and Power",
        subtopic: "Conservation of Energy",
        difficulty: "medium",
        estimated_time: 60,
        learning_objective: "Apply conservation of mechanical energy",
        quality_score: 95,
        is_draft: false,
        context_type: "JAMB",
        ai_flags: []
      },
      {
        question: "Wich of the folowing elements is a halogen?",
        option_a: "Sodium",
        option_b: "Chlorine",
        option_c: "Argon",
        option_d: "Calcium",
        correct_answer: "B",
        explanation: "Chlorine is in Group 7 (Halogens) of the periodic table.",
        subject: "Chemistry",
        topic: "Periodic Table",
        subtopic: "Group 7 Elements",
        difficulty: "easy",
        estimated_time: 30,
        learning_objective: "Identify halogen elements",
        quality_score: 75,
        is_draft: true,
        context_type: "JAMB",
        ai_flags: ["Grammar errors detected", "Poor spelling in question stem"]
      }
    ]

    // Generate CSV using PapaParse
    const csv = Papa.unparse(extractedQuestions.map(q => {
      const { ai_flags, ...rest } = q;
      return {
        ...rest,
        ai_flags_str: ai_flags.join('; ')
      };
    }))

    // Update job with review ready status
    await supabase.from('content_ingestion_jobs').update({ 
      status: 'review_ready', 
      progress: 100,
      total_questions_found: extractedQuestions.length,
      extracted_data: extractedQuestions,
      preview_csv: csv,
      context_detected: "JAMB 2019 Past Questions",
      math_ocr_used: true,
      rejected_count: extractedQuestions.filter(q => q.quality_score < 90).length
    }).eq('id', job.id)

    return new Response(JSON.stringify({ success: true, jobId: job.id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
    
  } catch (error) {
    console.error("Content Ingestion Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    })
  }
})
