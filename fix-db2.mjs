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
      -- Disable trigger
      ALTER TABLE public.profiles DISABLE TRIGGER enforce_role_protection;

      -- Update rows
      UPDATE public.profiles 
      SET role = 'admin', has_paid = true, onboarding_completed = true 
      WHERE email IN ('admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com');

      -- Re-enable trigger
      ALTER TABLE public.profiles ENABLE TRIGGER enforce_role_protection;
    `;
    
    await client.query(sql);
    console.log('Successfully applied database master overrides (with trigger disabled)!');

    const res = await client.query("SELECT email, role, has_paid FROM public.profiles WHERE email = 'olanrewajuhamilot@gmail.com' OR email = 'admitwise2@gmail.com'");
    console.log(res.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
