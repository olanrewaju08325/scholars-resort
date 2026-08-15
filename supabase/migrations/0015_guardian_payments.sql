-- Allow guardians to insert manual payments on behalf of their linked wards
DROP POLICY IF EXISTS "Users can insert own payments" ON public.manual_payments;

CREATE POLICY "Users can insert own payments or for linked wards" 
ON public.manual_payments FOR INSERT 
WITH CHECK (
    auth.uid() = user_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.guardian_links 
        WHERE guardian_id = auth.uid() 
        AND student_id = manual_payments.user_id 
        AND status = 'active'
    )
);
