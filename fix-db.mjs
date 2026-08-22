import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const sql = `
      -- 1. Ensure master admins have the 'admin' role in the DB
      UPDATE public.profiles 
      SET role = 'admin', has_paid = true, onboarding_completed = true 
      WHERE email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com');

      -- 2. Modify is_admin() to explicitly grant admin access to the master emails
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS BOOLEAN AS $$
      DECLARE
        v_role text;
        v_email text;
      BEGIN
        IF auth.uid() IS NULL THEN
          RETURN false;
        END IF;

        -- Master Admin Email Override (bulletproof check)
        v_email := coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email');
        IF v_email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com') THEN
          RETURN true;
        END IF;

        -- Check JWT metadata first for speed
        v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role');
        IF v_role = 'admin' OR v_role = 'superadmin' THEN
          RETURN true;
        END IF;

        -- Direct profiles check (bypasses RLS because row_security = off inside SECURITY DEFINER)
        RETURN EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin' OR email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'))
        );
      EXCEPTION WHEN OTHERS THEN
        RETURN false;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

      -- 3. Modify the protect_role_column() trigger to explicitly allow master admins to bypass role locks
      CREATE OR REPLACE FUNCTION public.protect_role_column()
      RETURNS TRIGGER AS $$
      BEGIN
        -- If the user doing the update is NOT an admin, and the role is changing, revert it.
        IF NOT public.is_admin() THEN
          NEW.role = OLD.role;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Reload PostgREST schema cache
      NOTIFY pgrst, 'reload schema';
    `;
    
    await client.query(sql);
    console.log('Successfully applied database master overrides!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
