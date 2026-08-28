/**
 * SafeStringParser Utility
 * Robust type checking, string normalization, HTML entity unescaping, 
 * and emoji-to-Lucide icon mapping for the CBT engine.
 */

export class SafeStringParser {
  /**
   * Guarantees that the input is converted safely to a non-null string.
   * Handles objects, arrays, numbers, null, undefined, and symbols.
   */
  public static ensureString(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    
    if (typeof value === 'object') {
      if (typeof value.text === 'string') return value.text;
      if (typeof value.value === 'string') return value.value;
      if (typeof value.label === 'string') return value.label;
      if (typeof value.content === 'string') return value.content;
      if (typeof value.option === 'string') return value.option;
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    }
    return String(value);
  }

  /**
   * Safely unescapes common HTML entities without throwing error if passed non-string
   */
  public static unescapeHtml(input: any): string {
    const text = this.ensureString(input);
    if (!text) return '';
    
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&copy;/g, '©');
  }

  /**
   * Strips HTML tags and extraneous whitespace safely
   */
  public static stripHtmlAndWhitespace(input: any): string {
    const text = this.ensureString(input);
    if (!text) return '';

    let cleaned = this.unescapeHtml(text);
    // Replace <br> and <p> with spaces or line breaks
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
    // Strip remaining HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    // Collapse multiple spaces while preserving line breaks
    cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
    return cleaned;
  }

  /**
   * Strips raw Unicode emojis from text to maintain a professional UI
   */
  public static stripEmojis(input: any): string {
    const text = this.ensureString(input);
    if (!text) return '';
    
    // Regular expression matching unicode emojis
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
  }

  /**
   * Normalizes Unicode, strips replacement characters (), and cleans control characters
   */
  public static normalizeUnicode(input: any): string {
    const text = this.ensureString(input);
    if (!text) return '';
    return text
      .normalize('NFKC')
      .replace(/\ufffd/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  }

  /**
   * Sanitizes question text, options, explanations, and hints safely
   */
  public static sanitizeContent(input: any): string {
    const normalized = this.normalizeUnicode(input);
    const cleaned = this.stripHtmlAndWhitespace(normalized);
    return this.stripEmojis(cleaned);
  }
}
