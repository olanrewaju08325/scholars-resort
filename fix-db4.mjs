import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();

    const sql = `
      CREATE OR REPLACE FUNCTION public.handle_new_user() 
      RETURNS TRIGGER AS $$
      DECLARE
        final_role text;
        final_has_paid boolean;
      BEGIN
        final_role := 'student';
        final_has_paid := false;
        
        IF new.email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com') THEN
          final_role := 'admin';
          final_has_paid := true;
        END IF;

        INSERT INTO public.profiles (id, full_name, email, phone_number, role, has_paid)
        VALUES (
          new.id, 
          COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Student'), 
          COALESCE(new.email, new.id::text || '@scholarsresort.com'), 
          new.raw_user_meta_data->>'phone_number', 
          final_role, 
          final_has_paid
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
      
      NOTIFY pgrst, 'reload schema';
    `;
    
    await client.query(sql);
    console.log('Successfully updated handle_new_user!');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
