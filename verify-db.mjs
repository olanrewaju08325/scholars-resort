import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    
    // 1. List all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log("=== PUBLIC SCHEMA TABLES ===");
    console.log(tables.join(', '));
    console.log(`Total Tables: ${tables.length}\n`);

    // 2. Fetch RLS status for all public tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log("=== ROW-LEVEL SECURITY (RLS) STATUS ===");
    rlsRes.rows.forEach(r => {
      console.log(`${r.tablename}: ${r.rowsecurity ? 'RLS ENABLED' : 'RLS DISABLED'}`);
    });
    console.log("");

    // 3. Row counts of critical tables
    console.log("=== TABLE ROW COUNTS ===");
    for (const table of tables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM public."${table}"`);
        console.log(`${table}: ${countRes.rows[0].count} records`);
      } catch (err) {
        console.log(`${table}: ERROR (${err.message})`);
      }
    }
  } catch (globalErr) {
    console.error("Diagnostic error:", globalErr);
  } finally {
    await client.end();
  }
}
run();
