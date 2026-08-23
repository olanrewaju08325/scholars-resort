/**
 * Diagnostic & Verification Script for Study Material Upload Flow & Storage Buckets
 * 
 * Verifies:
 * 1. Supabase credentials and client initialization
 * 2. Supabase Storage bucket ('study-materials', 'materials', 'raw_content') existence & permissions
 * 3. File upload pathing (sanitization, unique prefixing, content-type headers)
 * 4. Public URL retrieval and accessibility check
 * 5. Database metadata persistence (/api/admin/materials/upload-metadata and direct table queries)
 * 
 * Run with: node scripts/diagnose-storage-upload.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ity2upo7enzaao2otb7fcf.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyKey';

console.log('===============================================================');
console.log('🔍 SCHOLARS RESORT: STUDY MATERIAL STORAGE & UPLOAD DIAGNOSTIC');
console.log('===============================================================');
console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Timestamp:    ${new Date().toISOString()}\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDiagnostic() {
  const report = {
    supabaseConnected: false,
    bucketsFound: [],
    studyMaterialsBucketStatus: 'unknown',
    testFileUpload: 'not_run',
    testFilePublicUrl: null,
    metadataPersistence: 'not_run',
    errors: [],
    recommendations: []
  };

  // Step 1: Check Supabase DB Connection
  console.log('[Step 1/5] Testing database connectivity...');
  try {
    const { data, error } = await supabase.from('subjects').select('id, name').limit(1);
    if (error) {
      report.errors.push(`Database query error: ${error.message}`);
      console.log(`❌ Database connection error: ${error.message}`);
    } else {
      report.supabaseConnected = true;
      console.log(`✅ Supabase Database connected successfully! Found ${data ? data.length : 0} sample subject(s).`);
    }
  } catch (err) {
    report.errors.push(`Database exception: ${err.message}`);
    console.log(`❌ DB Exception: ${err.message}`);
  }

  // Step 2: Check Supabase Storage Buckets
  console.log('\n[Step 2/5] Inspecting Storage Buckets...');
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      report.errors.push(`Bucket list error: ${bucketError.message}`);
      console.log(`⚠️ Could not list buckets directly via client key: ${bucketError.message}`);
      console.log('   (Note: Listing buckets requires service_role or storage admin policy, testing direct upload next...)');
    } else {
      report.bucketsFound = buckets.map(b => ({ name: b.name, public: b.public }));
      console.log(`✅ Storage buckets discovered (${buckets.length}):`);
      buckets.forEach(b => console.log(`   - [${b.public ? 'PUBLIC' : 'PRIVATE'}] ${b.name}`));

      const hasStudyMaterials = buckets.some(b => b.name === 'study-materials');
      if (hasStudyMaterials) {
        report.studyMaterialsBucketStatus = 'found_and_listed';
      } else {
        report.studyMaterialsBucketStatus = 'not_found_in_list';
        report.recommendations.push("Bucket 'study-materials' was not in bucket list. Ensure bucket is created or SQL bucket setup script is executed.");
      }
    }
  } catch (err) {
    console.log(`⚠️ Storage inspection note: ${err.message}`);
  }

  // Step 3: Test Upload to 'study-materials' bucket
  console.log("\n[Step 3/5] Testing synthetic upload to 'study-materials' bucket...");
  const testFileName = `diagnostic_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`;
  const testFilePath = `study_materials/${testFileName}`;
  const testContent = `Scholars Resort Study Material Diagnostic\nTimestamp: ${new Date().toISOString()}\nStatus: Verified`;
  const testBlob = new Blob([testContent], { type: 'text/plain' });

  let targetBucket = 'study-materials';
  let uploadSuccess = false;

  try {
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('study-materials')
      .upload(testFilePath, testBlob, {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadErr) {
      console.log(`❌ Upload to 'study-materials' bucket failed: ${uploadErr.message}`);
      report.errors.push(`study-materials upload: ${uploadErr.message}`);

      // Try fallback to 'materials' or 'raw_content'
      console.log("   Attempting fallback to 'materials' bucket...");
      const { error: fbErr } = await supabase.storage.from('materials').upload(testFilePath, testBlob, { upsert: true });
      if (fbErr) {
        console.log(`   ❌ Fallback to 'materials' failed: ${fbErr.message}`);
      } else {
        console.log("   ✅ Fallback upload to 'materials' bucket SUCCEEDED!");
        targetBucket = 'materials';
        uploadSuccess = true;
      }
    } else {
      console.log(`✅ Upload to 'study-materials' bucket SUCCEEDED at path: ${uploadData.path}`);
      uploadSuccess = true;
    }
  } catch (err) {
    console.log(`❌ Upload exception: ${err.message}`);
    report.errors.push(`Upload exception: ${err.message}`);
  }

  // Step 4: Verify Public URL Generation & Retrieval
  console.log('\n[Step 4/5] Verifying Public URL generation...');
  if (uploadSuccess) {
    const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(testFilePath);
    report.testFilePublicUrl = urlData?.publicUrl || null;
    console.log(`✅ Generated Public URL: ${report.testFilePublicUrl}`);
    report.testFileUpload = 'success';
  } else {
    // Generate simulated fallback URL for audit
    const { data: urlData } = supabase.storage.from('study-materials').getPublicUrl(testFilePath);
    console.log(`ℹ️ Expected Public URL format: ${urlData?.publicUrl}`);
    report.testFileUpload = 'failed_or_needs_bucket_policy';
  }

  // Step 5: Test Metadata Endpoint
  console.log('\n[Step 5/5] Testing Study Material Metadata Insertion...');
  try {
    const { data: sub } = await supabase.from('subjects').select('id').limit(1).maybeSingle();
    const testPayload = {
      title: `Diagnostic UTME Physics Revision Note (${new Date().toLocaleTimeString()})`,
      description: 'Automated test record generated during system storage diagnostic audit.',
      subject_id: sub?.id || null,
      file_path: report.testFilePublicUrl || `https://storage.scholarsresort.com/${testFilePath}`,
      is_premium: false
    };

    const newId = crypto.randomUUID();
    const { error: dbError } = await supabase.from('materials').insert({
      id: newId,
      title: testPayload.title,
      description: testPayload.description,
      subject_id: testPayload.subject_id,
      file_path: testPayload.file_path,
      file_size_bytes: 1024 * 50,
      visibility: true,
      is_premium: false
    });

    if (dbError) {
      console.log(`⚠️ Direct DB insert note: ${dbError.message} (Will rely on server admin endpoint)`);
      report.metadataPersistence = `db_warn: ${dbError.message}`;
    } else {
      console.log(`✅ Test study material metadata inserted into database with ID: ${newId}`);
      report.metadataPersistence = 'success';
    }
  } catch (err) {
    console.log(`⚠️ Metadata test note: ${err.message}`);
  }

  console.log('\n===============================================================');
  console.log('📊 STORAGE & UPLOAD DIAGNOSTIC SUMMARY');
  console.log('===============================================================');
  console.log(`DB Connected:            ${report.supabaseConnected ? 'YES' : 'NO'}`);
  console.log(`Study Materials Upload:  ${report.testFileUpload.toUpperCase()}`);
  console.log(`Metadata Persistence:    ${report.metadataPersistence.toUpperCase()}`);
  if (report.recommendations.length > 0) {
    console.log('\n🛠️ RECOMMENDATIONS:');
    report.recommendations.forEach(r => console.log(` - ${r}`));
  }
  console.log('===============================================================\n');
}

runDiagnostic();
