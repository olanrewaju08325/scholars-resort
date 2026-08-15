-- V8: Allow students to upload receipts to the materials bucket

CREATE POLICY "Students can upload receipts" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'materials' AND 
  (storage.foldername(name))[1] = 'receipts' AND
  auth.role() = 'authenticated'
);
