import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT email, role, has_paid FROM public.profiles WHERE email = 'olanrewajuhamilot@gmail.com' OR email = 'admitwise2@gmail.com'");
    console.log(res.rows);
  } finally {
    await client.end();
  }
}
run();
