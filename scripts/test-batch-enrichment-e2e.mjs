#!/usr/bin/env node
/**
 * End-to-End Audit Script for CSV Batch Enrichment & Persistence
 */

import pg from 'pg';

const DB_CONNECTION = process.env.DATABASE_URL || 
  'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres';

const SERVER_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'scholar_admin_secure_key_2026';

async function runEndToEndAudit() {
  console.log('\n================================================================================');
  console.log('       SCHOLARS RESORT — CSV BATCH ENRICHMENT E2E PIPELINE AUDIT');
  console.log('================================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const client = new pg.Client({ connectionString: DB_CONNECTION });
  await client.connect();
  console.log('✅ [1/5] Connected to PostgreSQL Database');

  // Fetch a valid subject and topic for reference
  const subRes = await client.query(`SELECT id, name FROM public.subjects WHERE is_active = true LIMIT 3`);
  const mathSubject = subRes.rows.find(s => s.name.toLowerCase().includes('math')) || subRes.rows[0];
  const chemSubject = subRes.rows.find(s => s.name.toLowerCase().includes('chem')) || subRes.rows[1] || subRes.rows[0];

  console.log(`✅ [2/5] Target Subjects resolved: Math=${mathSubject.name} (${mathSubject.id}), Chem=${chemSubject.name} (${chemSubject.id})`);

  const testAuditTag = `AUDIT_TEST_${Date.now()}`;
  const testQuestionIds = [];

  try {
    // 1. Insert 2 test questions with missing explanations to simulate raw CSV upload without explanation
    const insertRes1 = await client.query(
      `INSERT INTO public.questions (subject_id, question_text, options, correct_answer, explanation, difficulty, year, is_active)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       RETURNING id, question_text, explanation, year, difficulty`,
      [
        mathSubject.id,
        `[${testAuditTag}] Find the derivative of f(x) = 3x^2 + 5x - 8 with respect to x.`,
        JSON.stringify(["6x + 5", "3x + 5", "6x - 8", "5x + 3"]),
        "6x + 5",
        "", // Missing explanation
        "medium",
        2023,
        true
      ]
    );
    const q1 = insertRes1.rows[0];
    testQuestionIds.push(q1.id);

    const insertRes2 = await client.query(
      `INSERT INTO public.questions (subject_id, question_text, options, correct_answer, explanation, difficulty, year, is_active)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       RETURNING id, question_text, explanation, year, difficulty`,
      [
        chemSubject.id,
        `[${testAuditTag}] What is the oxidation state of Manganese in KMnO4?`,
        JSON.stringify(["+7", "+4", "+2", "+6"]),
        "+7",
        "", // Missing explanation
        "hard",
        2022,
        true
      ]
    );
    const q2 = insertRes2.rows[0];
    testQuestionIds.push(q2.id);

    console.log(`✅ [3/5] Seeded 2 test questions in database with empty explanations: [${q1.id}, ${q2.id}]`);

    // 2. Invoke /api/admin/ai-batch-enrich via API (Admin Superuser Authentication)
    console.log('⏳ [4/5] Executing AI Batch Enrichment via /api/admin/ai-batch-enrich endpoint...');
    const enrichPayload = {
      questions: [
        {
          id: q1.id,
          question_text: q1.question_text,
          options: ["6x + 5", "3x + 5", "6x - 8", "5x + 3"],
          correct_answer: "6x + 5",
          current_explanation: "",
          current_subject: mathSubject.id,
          year: 2023,
          difficulty: "medium"
        },
        {
          id: q2.id,
          question_text: q2.question_text,
          options: ["+7", "+4", "+2", "+6"],
          correct_answer: "+7",
          current_explanation: "",
          current_subject: chemSubject.id,
          year: 2022,
          difficulty: "hard"
        }
      ]
    };

    const enrichResponse = await fetch(`${SERVER_URL}/api/admin/ai-batch-enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN
      },
      body: JSON.stringify(enrichPayload)
    });

    const enrichJson = await enrichResponse.json();
    console.log(`   - HTTP Status: ${enrichResponse.status}`);
    console.log(`   - Success: ${enrichJson.success}`);
    console.log(`   - Enriched Items Count: ${enrichJson.enriched?.length || 0}`);
    console.log(`   - Tokens Used: ${enrichJson.tokensUsed || 0}`);
    console.log(`   - Model Used: ${enrichJson.model || 'N/A'}`);

    if (!enrichJson.success) {
      throw new Error(`AI Batch Enrichment failed: ${enrichJson.error}`);
    }

    // 3. Query PostgreSQL directly to verify persisted data
    console.log('🔍 [5/5] Verifying persistence directly from PostgreSQL database...');
    const verifyRes = await client.query(
      `SELECT id, question_text, explanation, difficulty, year, subject_id, topic_id
       FROM public.questions 
       WHERE id = ANY($1::uuid[])`,
      [testQuestionIds]
    );

    console.log(`\n📋 Database Verification Results (${verifyRes.rows.length} rows found):`);
    for (const row of verifyRes.rows) {
      const hasExplanation = row.explanation && row.explanation.trim().length > 20;
      console.log(`\n-------------------------------------------------------------`);
      console.log(`Question ID:    ${row.id}`);
      console.log(`Stem:           ${row.question_text.slice(0, 60)}...`);
      console.log(`Year:           ${row.year}`);
      console.log(`Difficulty:     ${row.difficulty}`);
      console.log(`Subject ID:     ${row.subject_id}`);
      console.log(`Topic ID:       ${row.topic_id}`);
      console.log(`Explanation:    ${hasExplanation ? '✅ PERSISTED' : '❌ EMPTY'}`);
      console.log(`Snippet:        ${row.explanation ? row.explanation.slice(0, 120).replace(/\n/g, ' ') + '...' : 'NONE'}`);

      if (!hasExplanation) {
        throw new Error(`Question ${row.id} does not have a persisted explanation!`);
      }
    }

    // 4. Test /api/questions/upsert endpoint with direct update
    console.log('\n⏳ Testing /api/questions/upsert with new explanation...');
    const upsertRes = await fetch(`${SERVER_URL}/api/questions/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN
      },
      body: JSON.stringify({
        questions: [
          {
            id: q1.id,
            explanation: `Verified manual update: By power rule d/dx(3x^2 + 5x - 8) = 6x + 5.`,
            year: 2024,
            difficulty: 'easy'
          }
        ]
      })
    });
    const upsertJson = await upsertRes.json();
    console.log(`   - Upsert response: success=${upsertJson.success}, count=${upsertJson.count}`);

    const verifyUpsert = await client.query(`SELECT explanation, year, difficulty FROM public.questions WHERE id = $1`, [q1.id]);
    console.log(`   - Post-upsert DB state: year=${verifyUpsert.rows[0]?.year}, difficulty=${verifyUpsert.rows[0]?.difficulty}`);
    console.log(`   - Post-upsert Explanation: ${verifyUpsert.rows[0]?.explanation}`);

    if (verifyUpsert.rows[0]?.year !== 2024) {
      throw new Error(`Upsert year did not update to 2024!`);
    }

    console.log('\n================================================================================');
    console.log('🎉 AUDIT COMPLETE: ALL CHECKS PASSED WITH 100% PERSISTENCE INTEGRITY!');
    console.log('================================================================================\n');

  } finally {
    // Clean up test questions
    if (testQuestionIds.length > 0) {
      await client.query(`DELETE FROM public.questions WHERE id = ANY($1::uuid[])`, [testQuestionIds]);
      console.log(`🧹 Cleaned up ${testQuestionIds.length} test records from database.`);
    }
    await client.end();
  }
}

runEndToEndAudit().catch(err => {
  console.error('❌ Audit Failed:', err);
  process.exit(1);
});
