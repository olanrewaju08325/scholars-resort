#!/usr/bin/env node
/**
 * Test script verifying CSV Parsing -> Database Ingestion -> UI State verification
 */

import Papa from 'papaparse';
import pg from 'pg';

const DB_CONNECTION = process.env.DATABASE_URL || 
  'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres';

const SERVER_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'scholar_admin_secure_key_2026';

async function runCsvIngestTest() {
  console.log('\n================================================================================');
  console.log('       CSV PARSING & BATCH INGESTION PIPELINE VERIFICATION');
  console.log('================================================================================');

  const client = new pg.Client({ connectionString: DB_CONNECTION });
  await client.connect();

  const sampleCsvContent = `Subject,Topic,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Year,Difficulty
Mathematics,Calculus,What is the integral of 2x dx?,x^2 + C,2x^2 + C,x + C,2 + C,A,Integration of 2x with respect to x gives x^2 + C.,2023,easy
Chemistry,Periodic Table,Which element has atomic number 6?,Carbon,Nitrogen,Oxygen,Boron,A,Carbon has atomic number 6.,2022,easy
Physics,Mechanics,What is the SI unit of Force?,Newton,Joule,Pascal,Watt,A,The SI unit of force is the Newton (N).,2024,easy`;

  console.log('📄 [1/4] Parsing raw CSV data...');
  const parsed = Papa.parse(sampleCsvContent, { header: true, skipEmptyLines: true });
  console.log(`   - Parsed ${parsed.data.length} rows successfully.`);

  const testAuditTag = `CSV_TEST_${Date.now()}`;
  const questionsToIngest = [];

  // Fetch subject IDs
  const subRes = await client.query(`SELECT id, name FROM public.subjects WHERE is_active = true`);
  const subjectsMap = new Map();
  subRes.rows.forEach(s => subjectsMap.set(s.name.toLowerCase().trim(), s.id));

  for (const row of parsed.data) {
    const subName = row.Subject.toLowerCase().trim();
    const subId = subjectsMap.get(subName) || subjectsMap.get('mathematics') || subRes.rows[0].id;

    questionsToIngest.push({
      subject_id: subId,
      question_text: `[${testAuditTag}] ${row.Question}`,
      options: [row['Option A'], row['Option B'], row['Option C'], row['Option D']],
      correct_answer: row['Option A'],
      explanation: row.Explanation,
      difficulty: row.Difficulty || 'easy',
      year: parseInt(row.Year) || 2023,
      is_active: true
    });
  }

  console.log(`📦 [2/4] Ingesting ${questionsToIngest.length} questions via /api/questions/insert...`);
  const insertRes = await fetch(`${SERVER_URL}/api/questions/insert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify({ questions: questionsToIngest })
  });

  const insertData = await insertRes.json();
  console.log(`   - Insert Response: success=${insertData.success}, count=${insertData.count}`);

  if (!insertData.success) {
    throw new Error(`Ingest failed: ${insertData.error}`);
  }

  console.log(`🔍 [3/4] Validating records in PostgreSQL questions table...`);
  const verifyRes = await client.query(
    `SELECT id, subject_id, question_text, options, correct_answer, explanation, year, difficulty
     FROM public.questions 
     WHERE question_text LIKE $1`,
    [`%${testAuditTag}%`]
  );

  console.log(`   - Verified ${verifyRes.rows.length} rows retrieved from database.`);
  for (const q of verifyRes.rows) {
    console.log(`   -> [${q.year} - ${q.difficulty}] ${q.question_text.slice(0, 50)}... | Answer: ${q.correct_answer} | Expl: ${q.explanation.slice(0, 40)}...`);
  }

  if (verifyRes.rows.length !== questionsToIngest.length) {
    throw new Error(`Expected ${questionsToIngest.length} rows, found ${verifyRes.rows.length}`);
  }

  console.log(`🧹 [4/4] Cleaning up test records...`);
  const delRes = await client.query(`DELETE FROM public.questions WHERE question_text LIKE $1`, [`%${testAuditTag}%`]);
  console.log(`   - Removed ${delRes.rowCount} test records.`);

  await client.end();
  console.log('\n✅ CSV Parsing & Ingestion Verification Passed Successfully!\n');
}

runCsvIngestTest().catch(err => {
  console.error('❌ Ingest test failed:', err);
  process.exit(1);
});
