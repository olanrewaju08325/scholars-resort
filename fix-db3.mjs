import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres.syoodykedvqaoeplmamd:Halimot0%2A%40%23%23@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT email, role, has_paid FROM public.profiles LIMIT 10;");
    console.log(res.rows);
  } finally {
    await client.end();
  }
}
run();
