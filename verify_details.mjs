import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("=== CHECKING NOVEL SERVICE AND JAMB NOVEL HUB ===");
  const jnh = fs.readFileSync('src/pages/JambNovelHub.tsx', 'utf8');
  console.log("JambNovelHub lines:", jnh.split('\n').length);
  const ns = fs.readFileSync('src/services/novelService.ts', 'utf8');
  console.log("novelService lines:", ns.split('\n').length);

  // Check admin_settings.jamb_novels_db in live db
  const { data: novelSetting } = await supabase.from('admin_settings').select('*').eq('setting_key', 'jamb_novels_db').maybeSingle();
  console.log("Live jamb_novels_db in admin_settings:", novelSetting ? `Present (${JSON.stringify(novelSetting.setting_value).length} chars)` : 'NULL');

  console.log("\n=== CHECKING BADGES ===");
  const { data: dbBadges } = await supabase.from('badges').select('*');
  console.log("DB Badges count:", dbBadges ? dbBadges.length : 0);
  const badgesComp = fs.readFileSync('src/components/Badges.tsx', 'utf8');
  console.log("Badges.tsx has BADGE_DEFINITIONS:", badgesComp.includes('BADGE_DEFINITIONS'));

  console.log("\n=== CHECKING CANONICAL_SYLLABUS_DETAILS USAGE ===");
  const files = ['src/services/questionClassificationService.ts', 'src/pages/admin-tabs/SyllabusAdminTab.tsx', 'src/pages/PracticeSetup.tsx', 'src/utils/subjectTaxonomy.ts'];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      console.log(`${f} references CANONICAL_SYLLABUS_DETAILS:`, c.includes('CANONICAL_SYLLABUS_DETAILS'));
    }
  }

  console.log("\n=== MUTATION VERIFICATION CHECK ===");
  const { count: totalQ } = await supabase.from('questions').select('*', { count: 'exact', head: true });
  const { count: activeQ } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { count: topicsCount } = await supabase.from('topics').select('*', { count: 'exact', head: true });
  const { count: subjectsCount } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
  console.log({ totalQ, activeQ, topicsCount, subjectsCount });
}

run();
