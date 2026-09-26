import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';
import { processAcademicContent } from '@/utils/academicFormatter';
import { Maximize2, X } from 'lucide-react';

interface MathTextProps {
  text: string;
  className?: string;
  subject?: string;
}

/**
 * Universal Academic Text Component
 * Formats LaTeX formulas ($...$, $$...$$), raw algebraic expressions (e.g. 4a^2-9b^2, a^3+27b^3),
 * chemistry formulas (H2SO4, CaCO3), physics variables, Markdown tables, Markdown images, and Mermaid flowcharts.
 */
export const MathText: React.FC<MathTextProps> = ({ text, className = '', subject }) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  if (!text) return null;

  // Check if text contains Markdown table structure, Mermaid diagram, or Markdown images
  const hasMarkdownTable = /\|.+?\|.+?\|\s*\n\s*\|[-:\s|]+\|/m.test(text);
  const hasMermaid = /```(?:mermaid)?\s*[\s\S]+?```/i.test(text);
  const hasMarkdownImage = /!\[.*?\]\(.*?\)/.test(text);

  if (hasMarkdownTable || hasMermaid || hasMarkdownImage) {
    return (
      <div className={`markdown-math-wrapper w-full overflow-x-auto my-2 ${className}`}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ src, alt }) => {
              if (!src) return null;
              return (
                <div className="my-3 inline-block max-w-full">
                  <div className="relative group rounded-xl overflow-hidden border border-border bg-card p-2 shadow-xs inline-block">
                    <img
                      src={src}
                      alt={alt || 'Question Diagram Figure'}
                      className="max-h-64 sm:max-h-80 w-auto object-contain rounded-lg cursor-zoom-in transition-transform group-hover:scale-[1.01]"
                      onClick={() => setZoomedImage(src)}
                    />
                    <button
                      type="button"
                      onClick={() => setZoomedImage(src)}
                      className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Enlarge
                    </button>
                  </div>
                </div>
              );
            },
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
                  <p className="my-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: processAcademicContent(children, subject) }} />
                );
              }
              return <p className="my-1 leading-relaxed">{children}</p>;
            }
          }}
        >
          {text}
        </Markdown>

        {/* Modal Lightbox for Zoomed Image */}
        {zoomedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] bg-card p-3 rounded-2xl border border-border shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground p-2 rounded-full z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={zoomedImage}
                alt="Enlarged academic diagram"
                className="max-h-[80vh] w-auto object-contain rounded-xl mx-auto"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  const htmlContent = processAcademicContent(text, subject);

  return (
    <span
      className={`math-text inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
