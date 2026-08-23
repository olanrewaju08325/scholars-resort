import fs from 'fs';

let content = fs.readFileSync('src/pages/Flashcards.tsx', 'utf8');

// Remove generateFallbackFlashcards completely
content = content.replace(/const generateFallbackFlashcards[\s\S]*?return defaults\.slice\(0, count\);\n};\n/, '');

// Replace the generation logic
const oldLogic = `      let generatedCards: { front: string; back: string }[] = [];
      try {
        const text = await callGroqAPI([{ role: 'user', content: prompt }], 'qwen/qwen3.6-27b', 0.5);
        const parsed = safeParseAIJSON(text);
        if (Array.isArray(parsed)) {
          generatedCards = parsed.map((item: any) => ({
            front: String(item.front || item.front_text || item.question || item.term || item.title || '').trim(),
            back: String(item.back || item.back_text || item.answer || item.definition || item.description || item.explanation || '').trim()
          })).filter(c => c.front.length > 0 && c.back.length > 0);
        }
      } catch (parseErr) {
        console.warn('AI Flashcards raw response parse warning, using fallback:', parseErr);
      }

      if (generatedCards.length === 0) {
        generatedCards = generateFallbackFlashcards(aiTopic.trim(), aiCount);
      }`;

const newLogic = `      let generatedCards: { front: string; back: string }[] = [];
      
      const text = await callGroqAPI([{ role: 'user', content: prompt }], 'qwen/qwen3.6-27b', 0.5);
      const parsed = safeParseAIJSON(text);
      if (Array.isArray(parsed)) {
        generatedCards = parsed.map((item: any) => ({
          front: String(item.front || item.front_text || item.question || item.term || item.title || '').trim(),
          back: String(item.back || item.back_text || item.answer || item.definition || item.description || item.explanation || '').trim()
        })).filter(c => c.front.length > 0 && c.back.length > 0);
      }
      
      if (generatedCards.length === 0) {
        throw new Error('AI failed to generate valid flashcards. Please try another topic.');
      }`;

content = content.replace(oldLogic, newLogic);
content = content.replace("toast.error('AI Flashcard Notice: ' + (err.message || 'Saved cards to deck.'));", "toast.error('AI Generation Failed: ' + (err.message || 'Unknown error'));");

fs.writeFileSync('src/pages/Flashcards.tsx', content);
console.log('Fixed Flashcards AI logic');
