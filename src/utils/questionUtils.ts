import { ContentNormalizer } from './ContentNormalizer';

export { ContentNormalizer };

export function cleanQuestionText(text: string | null | undefined): string {
  return ContentNormalizer.cleanQuestionText(text);
}

export function cleanOptionText(text: string | null | undefined): string {
  return ContentNormalizer.cleanOptionText(text);
}

