import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

let mermaidInitialized = false;

function initMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
      themeVariables: {
        primaryColor: '#2563eb',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#1d4ed8',
        lineColor: '#64748b',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#ffffff',
      }
    });
    mermaidInitialized = true;
  }
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!chart || !chart.trim()) return;
      initMermaid();

      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      try {
        setRenderError(null);
        const { svg } = await mermaid.render(uniqueId, chart.trim());
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[Mermaid render notice]:', err?.message || err);
          setRenderError('Visual diagram format unavailable');
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (renderError) {
    return (
      <div className={`p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground font-mono overflow-x-auto my-2 ${className}`}>
        {chart}
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center p-6 bg-muted/20 rounded-xl animate-pulse">
        <span className="text-xs text-muted-foreground">Rendering academic diagram...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram-container overflow-x-auto p-4 rounded-xl bg-card border border-border my-3 flex justify-center shadow-xs ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
