import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';
import { processAcademicContent } from '@/utils/academicFormatter';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Universal Academic Text Component
 * Formats LaTeX formulas ($...$, $$...$$), raw algebraic expressions (e.g. 4a^2-9b^2, a^3+27b^3),
 * chemistry formulas (H2SO4, CaCO3), physics variables, Markdown tables, and Mermaid flowcharts.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Check if text contains a Markdown table structure or Mermaid diagram
  const hasMarkdownTable = /\|.+?\|.+?\|\s*\n\s*\|[-:\s|]+\|/m.test(text);
  const hasMermaid = /```(?:mermaid)?\s*[\s\S]+?```/i.test(text);

  if (hasMarkdownTable || hasMermaid) {
    return (
      <div className={`markdown-math-wrapper w-full overflow-x-auto my-2 ${className}`}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match ? match[1] : '';
              const codeString = String(children).replace(/\n$/, '');

              if (lang === 'mermaid' || codeString.trim().startsWith('graph ') || codeString.trim().startsWith('flowchart ') || codeString.trim().startsWith('sequenceDiagram')) {
                return <MermaidDiagram chart={codeString} />;
              }

              return (
                <code className={`px-1.5 py-0.5 rounded bg-muted font-mono text-xs ${className || ''}`} {...props}>
                  {children}
                </code>
              );
            },
            table: ({ ...props }) => (
              <table className="w-full my-3 border-collapse border border-border rounded-xl overflow-hidden shadow-xs text-sm md:text-base bg-card text-foreground" {...props} />
            ),
            thead: ({ ...props }) => (
              <thead className="bg-muted/70 text-foreground font-bold border-b border-border text-left" {...props} />
            ),
            tbody: ({ ...props }) => (
              <tbody className="divide-y divide-border" {...props} />
            ),
            tr: ({ ...props }) => (
              <tr className="hover:bg-muted/30 transition-colors even:bg-muted/15" {...props} />
            ),
            th: ({ ...props }) => (
              <th className="p-3 text-left border-r border-border last:border-r-0 font-bold text-foreground" {...props} />
            ),
            td: ({ ...props }) => (
              <td className="p-3 border-r border-border last:border-r-0 text-foreground align-top" {...props} />
            ),
            p: ({ children }) => {
              if (typeof children === 'string') {
                return (
                  <p className="my-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: processAcademicContent(children) }} />
                );
              }
              return <p className="my-1 leading-relaxed">{children}</p>;
            }
          }}
        >
          {text}
        </Markdown>
      </div>
    );
  }

  const htmlContent = processAcademicContent(text);

  return (
    <span
      className={`math-text inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
