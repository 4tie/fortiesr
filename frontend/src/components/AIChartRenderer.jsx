import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

// Initialize mermaid
mermaid.initialize({ startOnLoad: false, theme: 'dark' });

// Helper function to render text content
function renderContent(text) {
  return String(text || "").split("\n").map((line, idx) => (
    <span key={idx}>
      {line}
      {idx < String(text || "").split("\n").length - 1 && <br />}
    </span>
  ));
}

// Code block component
function CodeBlock({ language, content }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <div className="my-2 rounded-lg bg-base-300 border border-base-400 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-400/30 border-b border-base-400">
        <span className="text-[10px] font-mono text-base-content/60">{language}</span>
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-xs px-1.5 py-0.5 h-5 min-h-0 gap-1 text-[10px]"
          title="Copy to clipboard"
        >
          {copied ? <CheckIcon className="h-3 w-3" /> : <ClipboardDocumentIcon className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto text-base-content/90 whitespace-pre-wrap break-all">
        {content}
      </pre>
    </div>
  );
}

// Brand colors matching the app theme
const COLORS = {
  emerald: '#059669',
  emerald_dark: '#064e3b',
  red: '#ef4444',
  grid: '#27272a',
  muted: '#52525b',
  bg: '#09090b',
};

export function MermaidDiagram({ code }) {
  const diagramRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!diagramRef.current || !code) return;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        if (diagramRef.current) {
          diagramRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="my-2 rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div 
      ref={diagramRef} 
      className="my-2 flex justify-center bg-base-200 rounded-lg p-4 border border-base-300"
    />
  );
}

export function StructuredChart({ chartData }) {
  if (!chartData || !chartData.chartType) return null;

  const { chartType, data, title } = chartData;

  if (chartType === 'bar') {
    return (
      <div className="my-4 bg-base-200 border border-base-300 rounded-lg p-4">
        {title && <h4 className="text-sm font-semibold mb-3">{title}</h4>}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis 
              dataKey="label" 
              stroke={COLORS.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={COLORS.muted}
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: COLORS.bg, 
                border: `1px solid ${COLORS.grid}`,
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar 
              dataKey="value" 
              fill={COLORS.emerald}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'line') {
    return (
      <div className="my-4 bg-base-200 border border-base-300 rounded-lg p-4">
        {title && <h4 className="text-sm font-semibold mb-3">{title}</h4>}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
            <XAxis 
              dataKey="x" 
              stroke={COLORS.muted}
              fontSize={12}
            />
            <YAxis 
              stroke={COLORS.muted}
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: COLORS.bg, 
                border: `1px solid ${COLORS.grid}`,
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke={COLORS.emerald}
              strokeWidth={2}
              dot={{ fill: COLORS.emerald }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === 'pie') {
    const pieColors = data.map((item, idx) => 
      item.color || (idx % 2 === 0 ? COLORS.emerald : COLORS.red)
    );

    return (
      <div className="my-4 bg-base-200 border border-base-300 rounded-lg p-4">
        {title && <h4 className="text-sm font-semibold mb-3">{title}</h4>}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={pieColors[index]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: COLORS.bg, 
                border: `1px solid ${COLORS.grid}`,
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

export function ChartImage({ imageData }) {
  if (!imageData) return null;

  return (
    <div className="my-4 flex justify-center bg-base-200 rounded-lg p-4 border border-base-300">
      <img 
        src={imageData} 
        alt="Generated chart" 
        className="max-w-full h-auto rounded"
      />
    </div>
  );
}

// Enhanced message renderer that handles charts
export function renderMessageWithCharts(content) {
  if (!content) return null;

  try {
    const segments = [];
    const lines = content.split('\n');
    let currentText = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for mermaid code blocks
      if (line.trim().startsWith('```mermaid')) {
        if (currentText.length > 0) {
          segments.push({ type: 'text', content: currentText.join('\n') });
          currentText = [];
        }
        inCodeBlock = true;
        codeLanguage = 'mermaid';
        codeContent = [];
      } else if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          if (codeLanguage === 'mermaid') {
            segments.push({ type: 'mermaid', content: codeContent.join('\n') });
          } else if (codeLanguage === 'json') {
            // Try to parse as structured chart data
            try {
              const chartData = JSON.parse(codeContent.join('\n'));
              if (chartData.chartType) {
                segments.push({ type: 'chart', data: chartData });
              } else {
                segments.push({ type: 'code', language: codeLanguage, content: codeContent.join('\n') });
              }
            } catch {
              segments.push({ type: 'code', language: codeLanguage, content: codeContent.join('\n') });
            }
          } else {
            segments.push({ type: 'code', language: codeLanguage, content: codeContent.join('\n') });
          }
          codeContent = [];
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          codeLanguage = line.trim().replace('```', '').trim() || 'text';
          inCodeBlock = true;
        }
      } else if (inCodeBlock) {
        codeContent.push(line);
      } else {
        currentText.push(line);
      }
    }

    // Handle remaining text
    if (currentText.length > 0) {
      segments.push({ type: 'text', content: currentText.join('\n') });
    }

    // Handle unclosed code block
    if (inCodeBlock && codeContent.length > 0) {
      if (codeLanguage === 'mermaid') {
        segments.push({ type: 'mermaid', content: codeContent.join('\n') });
      } else {
        segments.push({ type: 'code', language: codeLanguage, content: codeContent.join('\n') });
      }
    }

    // Map segments to React elements
    const elements = segments.map((segment, idx) => {
      if (segment.type === 'mermaid') {
        return <MermaidDiagram key={`mermaid-${idx}`} code={segment.content} />;
      }
      if (segment.type === 'chart') {
        return <StructuredChart key={`chart-${idx}`} chartData={segment.data} />;
      }
      if (segment.type === 'code') {
        return <CodeBlock key={`code-${idx}`} language={segment.language} content={segment.content} />;
      }
      return <span key={`text-${idx}`}>{renderContent(segment.content)}</span>;
    });

    // Wrap in fragment to ensure proper rendering
    return <>{elements}</>;
  } catch (err) {
    console.error('Error rendering message with charts:', err);
    // Fallback to simple text rendering
    return <span>{renderContent(content)}</span>;
  }
}
