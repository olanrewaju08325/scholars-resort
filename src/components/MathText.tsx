import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Component to render text with embedded LaTeX formulas ($...$, $$...$$, \(...\), \[...\])
 * or raw LaTeX math commands (e.g. \frac, \sqrt).
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Function to render single math token or return fallback
  const renderMathString = (rawStr: string): string => {
    try {
      // Split by common math delimiters or detect if whole string looks like LaTeX
      const parts = rawStr.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\[[\s\S]+?\\\]|\\\([^\)]+?\\\))/g);

      return parts
        .map((part) => {
          if (!part) return '';
          let mathStr = '';
          let displayMode = false;

          if (part.startsWith('$$') && part.endsWith('$$')) {
            mathStr = part.slice(2, -2);
            displayMode = true;
          } else if (part.startsWith('$') && part.endsWith('$')) {
            mathStr = part.slice(1, -1);
          } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
            mathStr = part.slice(2, -2);
            displayMode = true;
          } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
            mathStr = part.slice(2, -2);
          } else if (/\\(frac|sqrt|sum|int|lim|alpha|beta|gamma|pi|theta|infty|times|div|pm)/.test(part)) {
            // Whole string has raw LaTeX commands without delimiters
            mathStr = part;
          } else {
            // Plain text
            return escapeHtml(part);
          }

          try {
            return katex.renderToString(mathStr.trim(), {
              displayMode,
              throwOnError: false,
            });
          } catch (e) {
            return escapeHtml(part);
          }
        })
        .join('');
    } catch (err) {
      return escapeHtml(rawStr);
    }
  };

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const htmlContent = renderMathString(text);

  return (
    <span
      className={`math-text inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
