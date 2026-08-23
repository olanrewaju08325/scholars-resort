import fs from 'fs';

let content = fs.readFileSync('src/pages/OfflinePackManager.tsx', 'utf8');
content = content.replace('export import { useNavigate } from "react-router-dom";\nimport { PlayCircle } from "lucide-react";\n\nconst OfflinePackManager = () => {', 'import { useNavigate } from "react-router-dom";\nimport { PlayCircle } from "lucide-react";\n\nexport const OfflinePackManager = () => {');
fs.writeFileSync('src/pages/OfflinePackManager.tsx', content);

let wc = fs.readFileSync('src/components/dashboard/WeeklyChallenge.tsx', 'utf8');
wc = wc.replace("import { fetchQuestionsForSubject } from '@/utils/subjectUtils'; from '@/services/aiService';", "import { callGroqAPI } from '@/services/aiService';\nimport { fetchQuestionsForSubject } from '@/utils/subjectUtils';");
fs.writeFileSync('src/components/dashboard/WeeklyChallenge.tsx', wc);
console.log('Fixed syntax errors');
