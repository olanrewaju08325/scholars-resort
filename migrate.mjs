import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.syoodykedvqaoeplmamd:Halimot0%2A%40%23%23@aws-0-eu-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase Database!');
    
    console.log('Executing 0010_admin_select_profiles.sql...');
    const sql10 = fs.readFileSync('supabase/migrations/0010_admin_select_profiles.sql', 'utf8');
    await client.query(sql10);
    console.log('Migration 10 executed successfully.');
    
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
