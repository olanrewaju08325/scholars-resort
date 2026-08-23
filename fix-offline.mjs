import fs from 'fs';

let content = fs.readFileSync('src/pages/OfflinePackManager.tsx', 'utf8');

const targetStr = `                      {isDownloaded && !hasUpdate && (
                        <Button size="sm" variant="outline" onClick={() => handleDelete(sub.id, sub.name)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}`;

const replaceStr = `                      {isDownloaded && !hasUpdate && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => navigate(\`/practice?mode=subject&subjectId=\${sub.id}\`)} className="font-bold gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/30">
                            <PlayCircle className="w-4 h-4" /> Start Offline
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(sub.id, sub.name)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}`;

content = content.replace(targetStr, replaceStr);

// add navigate
if (!content.includes('const navigate = useNavigate();')) {
  content = content.replace('const OfflinePackManager = () => {', 'import { useNavigate } from "react-router-dom";\nimport { PlayCircle } from "lucide-react";\n\nconst OfflinePackManager = () => {\n  const navigate = useNavigate();');
}

fs.writeFileSync('src/pages/OfflinePackManager.tsx', content);
console.log('Fixed OfflinePackManager.tsx');
