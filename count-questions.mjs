import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT count(*) FROM public.questions;");
    console.log("Total Questions:", res.rows[0].count);
    
    const resActive = await client.query("SELECT count(*) FROM public.questions WHERE is_active = true;");
    console.log("Active Questions:", resActive.rows[0].count);

    const resSub = await client.query(`
      SELECT s.name, count(q.id) 
      FROM public.subjects s 
      LEFT JOIN public.questions q ON q.subject_id = s.id 
      GROUP BY s.name;
    `);
    console.log("By Subject:");
    console.table(resSub.rows);

  } finally {
    await client.end();
  }
}
run();
