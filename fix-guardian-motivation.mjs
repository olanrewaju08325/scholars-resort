import fs from 'fs';

let content = fs.readFileSync('src/pages/GuardianPortal.tsx', 'utf8');

// Ensure callGroqAPI is imported
if (!content.includes('callGroqAPI')) {
  content = content.replace("import { sendNotification } from '@/lib/notifications';", "import { sendNotification } from '@/lib/notifications';\nimport { callGroqAPI, stripThinkTags } from '@/services/aiService';");
}

const oldLogic = `<Button 
                        onClick={async () => {
                          if (activeStudentData?.id) {
                            await sendNotification(
                              activeStudentData.id,
                              'Motivation from Guardian! 🌟',
                              \`\${profile?.full_name || 'Your Guardian'} sent you a study boost! Keep pushing toward your target JAMB score of \${activeStudentData.target}!\`,
                              'success'
                            );
                          }
                          toast.success(\`Motivation Nudge sent to \${activeStudentData.name}!\`);
                        }}
                        className="w-full justify-start gap-3 h-12"
                     >
                        <BellRing className="w-4 h-4" /> Send Motivation Nudge
                     </Button>`;

const newLogic = `<Button 
                        onClick={async () => {
                          if (activeStudentData?.id) {
                            const toastId = toast.loading('Generating personalized AI motivation...');
                            try {
                                const prompt = \`You are an academic counselor. Write a very short (1-2 sentences), highly motivating push notification for a student named \${activeStudentData.name}. Their target JAMB score is \${activeStudentData.target}. Current score average is \${activeStudentData.score}. Make it encouraging and personal. Do NOT use emojis.\`;
                                const aiMessage = await callGroqAPI([{ role: 'user', content: prompt }]);
                                const cleanMessage = stripThinkTags(aiMessage).replace(/"/g, '').trim();
                                
                                await sendNotification(
                                  activeStudentData.id,
                                  'Motivation from Guardian! 🌟',
                                  \`\${cleanMessage} - Sent by \${profile?.full_name || 'Your Guardian'}\`,
                                  'success'
                                );
                                toast.success(\`AI Motivation Nudge sent to \${activeStudentData.name}!\`, { id: toastId });
                            } catch (e) {
                                toast.error('Failed to generate motivation nudge.', { id: toastId });
                            }
                          }
                        }}
                        className="w-full justify-start gap-3 h-12"
                     >
                        <BellRing className="w-4 h-4" /> Send AI Motivation Nudge
                     </Button>`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync('src/pages/GuardianPortal.tsx', content);
console.log('Fixed Guardian Motivation');
