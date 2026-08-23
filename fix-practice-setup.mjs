import fs from 'fs';

let content = fs.readFileSync('src/pages/PracticeSetup.tsx', 'utf8');

if (!content.includes('getDownloadedPacks')) {
  content = content.replace("import { checkSubjectDataIntegrity } from '@/utils/subjectUtils';", "import { checkSubjectDataIntegrity } from '@/utils/subjectUtils';\nimport { getDownloadedPacks } from '@/lib/offlineStore';");
}

const targetStr = `  useEffect(() => {
    const fetchSubjects = async () => {
      // Check feature toggle
      const { data: settingsData } = await supabase.from('admin_settings').select('*').eq('setting_key', 'feature_toggles').single();
      if (settingsData && settingsData.setting_value && settingsData.setting_value.cbt_enabled === false) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase.from('subjects').select('*').eq('is_active', true);
      if (data) setSubjects(data);
      setLoading(false);
    };
    fetchSubjects();
  }, []);`;

const replaceStr = `  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        if (!navigator.onLine) {
          throw new Error('Offline');
        }
        // Check feature toggle
        const { data: settingsData } = await supabase.from('admin_settings').select('*').eq('setting_key', 'feature_toggles').maybeSingle();
        if (settingsData && settingsData.setting_value && settingsData.setting_value.cbt_enabled === false) {
          setEnabled(false);
          setLoading(false);
          return;
        }

        const { data } = await supabase.from('subjects').select('*').eq('is_active', true);
        if (data) setSubjects(data);
      } catch (err) {
        // Offline fallback
        const packs = getDownloadedPacks();
        const offlineSubjects = Object.values(packs).map(p => ({
          id: p.subjectId,
          name: p.subjectName,
          is_offline: true
        }));
        if (offlineSubjects.length > 0) {
          setSubjects(offlineSubjects);
          toast.info("You are offline. Showing downloaded subjects.");
        } else {
          toast.error("You are offline and have no downloaded subjects.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);`;

content = content.replace(targetStr, replaceStr);

const targetStr2 = `    if (selectedSubject) {
      setVerifyingIntegrity(true);
      
      // Perform Data Integrity Check using direct subject ID to ensure 100% accuracy and avoid name conflicts
      checkSubjectDataIntegrity(selectedSubject).then(res => {
        setAvailableQCount(res.availableCount);
        setVerifyingIntegrity(false);
      });

      supabase.from('topics').select('*').eq('subject_id', selectedSubject)
        .then(({ data }) => setTopics(data || []));
    } else {`;

const replaceStr2 = `    if (selectedSubject) {
      setVerifyingIntegrity(true);
      
      if (!navigator.onLine) {
         const packs = getDownloadedPacks();
         const pack = packs[selectedSubject];
         if (pack) {
            setAvailableQCount(pack.questionsCount);
         } else {
            setAvailableQCount(0);
         }
         setVerifyingIntegrity(false);
         setTopics([]);
      } else {
        // Perform Data Integrity Check using direct subject ID to ensure 100% accuracy and avoid name conflicts
        checkSubjectDataIntegrity(selectedSubject).then(res => {
          setAvailableQCount(res.availableCount);
          setVerifyingIntegrity(false);
        });

        supabase.from('topics').select('*').eq('subject_id', selectedSubject)
          .then(({ data }) => setTopics(data || []));
      }
    } else {`;

content = content.replace(targetStr2, replaceStr2);

fs.writeFileSync('src/pages/PracticeSetup.tsx', content);
console.log('Fixed PracticeSetup.tsx offline handling');
