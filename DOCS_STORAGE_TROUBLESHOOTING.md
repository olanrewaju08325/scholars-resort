# Scholars Resort: Study Material Upload & Supabase Storage Troubleshooting Guide

This guide provides step-by-step diagnostic verification and resolution instructions for the study material upload pipeline in Scholars Resort.

---

## 1. Storage Architecture Overview

The study material ingestion pipeline consists of three core stages:
1. **Frontend Storage Upload**: Files are uploaded to the Supabase Storage bucket `study-materials` (with fallback to `materials` and `raw_content`).
2. **AI Document Analysis**: Groq Llama 3.3 extracts key formulas, chapter summaries, and generates tailored UTME practice questions.
3. **Database Metadata Persistence**: The `/api/admin/materials/upload-metadata` endpoint inserts record entries into the `materials`, `library_materials`, and `study_materials` tables, bypassing client-side RLS constraints.

---

## 2. Supabase Storage Bucket Provisioning (SQL)

If the `study-materials` bucket is missing or throws an authorization error (`row-level security policy violation` or `Bucket not found`), run the following SQL commands in your Supabase SQL Editor:

```sql
-- 1. Create the 'study-materials' bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials',
  'study-materials',
  true,
  52428800, -- 50 MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- 2. Create the 'materials' fallback bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('materials', 'materials', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage RLS: Allow Public Read Access for Study Materials
CREATE POLICY "Public Read Access for Study Materials"
ON storage.objects FOR SELECT
USING (bucket_id IN ('study-materials', 'materials', 'raw_content'));

-- 4. Storage RLS: Allow Authenticated Users & Admins to Upload Study Materials
CREATE POLICY "Authenticated & Admin Upload to Study Materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('study-materials', 'materials', 'raw_content'));

-- 5. Storage RLS: Allow Anonymous / Public Upload with size guard (Development Fallback)
CREATE POLICY "Public Upload Fallback for Study Materials"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id IN ('study-materials', 'materials', 'raw_content'));

-- 6. Storage RLS: Allow Admins to Update and Delete Files
CREATE POLICY "Allow Object Updates"
ON storage.objects FOR UPDATE
USING (bucket_id IN ('study-materials', 'materials', 'raw_content'));

CREATE POLICY "Allow Object Deletions"
ON storage.objects FOR DELETE
USING (bucket_id IN ('study-materials', 'materials', 'raw_content'));
```

---

## 3. Frontend File Pathing Best Practices

When calling `supabase.storage.from('study-materials').upload(filePath, file)`, follow these rules:

1. **Path Sanitization**:
   - Strip spaces and special characters: `const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');`
   - Prefix with a folder and unique timestamp:
     ```ts
     const fileExt = file.name.split('.').pop() || 'pdf';
     const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
     const filePath = `study_materials/${fileName}`;
     ```

2. **MIME Type & Header Specification**:
   - Always supply `contentType: file.type || 'application/pdf'` in the upload options.
   - Set `upsert: true` to prevent collision aborts.

3. **Public URL Retrieval**:
   ```ts
   const { data: urlData } = supabase.storage.from('study-materials').getPublicUrl(filePath);
   const publicUrl = urlData.publicUrl;
   ```

---

## 4. Diagnostic Logging Tool

You can run the built-in diagnostic script at any time in your terminal or backend console:

```bash
node scripts/diagnose-storage-upload.js
```

### Expected Output Checklist:
- `✅ Supabase Database connected successfully!`
- `✅ Storage buckets discovered (study-materials, materials)`
- `✅ Upload to 'study-materials' bucket SUCCEEDED at path: study_materials/...`
- `✅ Generated Public URL: https://...`
- `✅ Test study material metadata inserted into database`

---

## 5. Troubleshooting Common Error Codes

| Error Message | Root Cause | Resolution |
|---|---|---|
| `Bucket not found` | The `study-materials` bucket hasn't been created in Supabase Storage. | Run the bucket provisioning SQL script in Section 2 above. |
| `new row violates row-level security policy` | Storage bucket is missing an INSERT policy for `storage.objects`. | Execute policies #4 and #5 in Section 2 above. |
| `The resource was not found` (404 on download) | The bucket is set to `private` or the generated path has unescaped characters. | Ensure `public = true` on the bucket and use sanitized path strings. |
| `Failed to insert material metadata` | Client token lacks insert permissions on `materials` table. | The frontend automatically delegates to `/api/admin/materials/upload-metadata` which executes on the backend with elevated privileges. |
