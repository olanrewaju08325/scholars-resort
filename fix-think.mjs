import fs from 'fs';

let content = fs.readFileSync('src/services/aiService.ts', 'utf8');

// Add helper to strip think tags
const stripFn = `
export function stripThinkTags(text: string): string {
  if (!text) return text;
  return text.replace(/<think>[\\s\\S]*?<\\/think>/gi, '').trim();
}
`;

if (!content.includes('stripThinkTags')) {
  content = content.replace("export const callGroqAPI", stripFn + "\nexport const callGroqAPI");
}

// Update the return statement inside callGroqAPI (for direct call)
// Need to find all occurrences where it returns the AI response and wrap it.
// Specifically, let's just intercept the end of callGroqAPI and parse it.
content = content.replace(/return content;/g, 'return stripThinkTags(content);');
content = content.replace(/return data\.content;/g, 'return stripThinkTags(data.content);');
content = content.replace(/return result\.content;/g, 'return stripThinkTags(result.content);');
content = content.replace(/return fallbackText;/g, 'return stripThinkTags(fallbackText);');

// And in safeParseAIJSON, we should also strip think tags BEFORE parsing
content = content.replace('let clean = rawText', 'let clean = rawText.replace(/<think>[\\s\\S]*?<\\/think>/gi, "")');

fs.writeFileSync('src/services/aiService.ts', content);
console.log('Fixed think tags');
