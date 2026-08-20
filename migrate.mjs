import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Halimot0%2A%40%23%23@db.syoodykedvqaoeplmamd.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase Database!');
    
    console.log('Executing 0040_fix_rls_policies_and_schema_columns.sql...');
    const sql = fs.readFileSync('supabase/migrations/0040_fix_rls_policies_and_schema_columns.sql', 'utf8');
    await client.query(sql);
    console.log('Migration 0040 executed successfully.');
    
    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema reloaded successfully.');
    
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

run();
