import { useState, useRef, useMemo } from "react";

function IndicatorChip({ name, params }) {
  return (
    <div className="badge badge-neutral badge-sm gap-1.5 font-mono">
      <span className="font-medium">{name}</span>
      {params && Object.keys(params).length > 0 && (
        <span className="opacity-60">
          {Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ')}
        </span>
      )}
    </div>
  );
}

// Syntax highlighting for JSON
function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'text-orange-400'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-purple-400'; // key
      } else {
        cls = 'text-green-400'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-blue-400'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-gray-400'; // null
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// Component for raw JSON with enhancements
function JsonPreviewWithFeatures({ json, validationErrors }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const jsonString = JSON.stringify(json, null, 2);
  const lines = jsonString.split('\n');

  // Search functionality
  const matches = useMemo(() => {
    if (!searchQuery) return [];
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const results = [];
    lines.forEach((line, idx) => {
      const match = line.match(regex);
      if (match) {
        results.push({ lineIndex: idx, text: match[0] });
      }
    });
    return results;
  }, [searchQuery, lines]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Sync scroll between line numbers and content
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Navigate matches
  const navigateMatch = (direction) => {
    if (matches.length === 0) return;
    const newIndex = direction === 'next' 
      ? (currentMatchIndex + 1) % matches.length 
      : (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(newIndex);
    
    // Scroll to match
    const matchLine = matches[newIndex].lineIndex;
    const lineElement = contentRef.current?.children[matchLine];
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Highlight search matches
  const highlightSearch = (text) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-400 text-black px-0.5 rounded">$1</mark>');
  };

  // Get validation status for a line
  const getLineValidationStatus = (lineContent) => {
    if (!validationErrors || validationErrors.length === 0) return null;
    
    // Check if this line contains validation-relevant content
    const lowerLine = lineContent.toLowerCase();
    const hasError = validationErrors.some(error => {
      const lowerError = error.toLowerCase();
      // Simple heuristic: if error keywords appear in the line
      if (lowerError.includes('indicator') && lowerLine.includes('indicator')) return true;
      if (lowerError.includes('name') && lowerLine.includes('name')) return true;
      if (lowerError.includes('timeframe') && lowerLine.includes('timeframe')) return true;
      if (lowerError.includes('pair') && lowerLine.includes('pair')) return true;
      return false;
    });
    
    return hasError ? 'error' : null;
  };

  return (
    <div className="space-y-2">
      {/* Search and actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search JSON..."
            className="input input-bordered input-xs w-full"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentMatchIndex(0);
            }}
          />
        </div>
        {matches.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-base-content/60">
              {currentMatchIndex + 1}/{matches.length}
            </span>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => navigateMatch('prev')}
              disabled={matches.length === 0}
            >
              ‹
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => navigateMatch('next')}
              disabled={matches.length === 0}
            >
              ›
            </button>
          </div>
        )}
        <button
          className="btn btn-xs btn-ghost"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      {/* Validation summary */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="alert alert-error alert-xs py-2">
          <span className="text-xs">
            {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''} found
          </span>
        </div>
      )}

      {/* JSON viewer with line numbers */}
      <div className="relative bg-base-100 border border-base-300 rounded-lg overflow-hidden">
        <div className="flex">
          {/* Line numbers */}
          <div
            ref={lineNumbersRef}
            className="bg-base-200 text-base-content/40 text-xs font-mono py-3 px-2 text-right select-none overflow-hidden"
            style={{ minWidth: '40px' }}
          >
            {lines.map((_, idx) => (
              <div key={idx} className="leading-5">
                {idx + 1}
              </div>
            ))}
          </div>
          
          {/* JSON content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-auto max-h-96 py-3 px-3 text-xs font-mono"
            onScroll={handleScroll}
          >
            {lines.map((line, idx) => {
              const validationStatus = getLineValidationStatus(line, idx);
              const isCurrentMatch = matches[currentMatchIndex]?.lineIndex === idx;
              
              return (
                <div
                  key={idx}
                  className={`leading-5 ${validationStatus === 'error' ? 'bg-error/10 border-l-2 border-error' : ''} ${isCurrentMatch ? 'bg-yellow-400/20' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: highlightSearch(syntaxHighlight(line))
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionItem({ condition }) {
  const getOperatorSymbol = (op) => {
    const symbols = {
      '>': 'greater than',
      '<': 'less than',
      '>=': 'at least',
      '<=': 'at most',
      '==': 'equals',
      '!=': 'not equals',
      'crosses_above': 'crosses above',
      'crosses_below': 'crosses below',
    };
    return symbols[op] || op;
  };

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-base-300/50">
      <span className="text-base-content/40 text-xs mt-0.5">•</span>
      <div className="flex-1 text-sm">
        <span className="font-medium text-primary">{condition.indicator_a}</span>
        <span className="mx-1.5 text-base-content/40">{getOperatorSymbol(condition.operator)}</span>
        <span className="font-medium text-accent">
          {typeof condition.value_or_indicator_b === 'string' ? condition.value_or_indicator_b : condition.value_or_indicator_b}
        </span>
      </div>
    </div>
  );
}

export default function StrategySpecPreview({ spec, validationErrors }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!spec) {
    return (
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4">
          <div className="text-center text-base-content/40 text-sm py-4">
            No strategy spec to preview
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{spec.name || "Unnamed Strategy"}</h3>
            {spec.description && (
              <p className="text-sm text-base-content/60 mt-1">{spec.description}</p>
            )}
          </div>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? "Hide JSON" : "Show JSON"}
          </button>
        </div>

        {showRaw ? (
          <JsonPreviewWithFeatures json={spec} validationErrors={validationErrors} />
        ) : (
          <div className="space-y-4">
            {/* Meta Info */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="badge badge-outline badge-sm">
                🕐 {spec.timeframe}
              </div>
              <div className="badge badge-outline badge-sm">
                📊 {spec.trading_style}
              </div>
              <div className="badge badge-outline badge-sm">
                📈 {spec.max_open_trades} max trades
              </div>
              <div className="badge badge-outline badge-sm">
                🛑 {(spec.stoploss * 100).toFixed(0)}% stop loss
              </div>
            </div>

            {/* Indicators */}
            <div>
              <div className="text-xs font-semibold text-base-content/60 mb-2 uppercase tracking-wide">
                Indicators
              </div>
              <div className="flex flex-wrap gap-2">
                {spec.indicators?.length > 0 ? (
                  spec.indicators.map((ind, idx) => (
                    <IndicatorChip key={idx} name={ind.name} params={ind.params} />
                  ))
                ) : (
                  <span className="text-xs text-base-content/40">No indicators configured</span>
                )}
              </div>
            </div>

            {/* Entry Conditions */}
            <div>
              <div className="text-xs font-semibold text-base-content/60 mb-2 uppercase tracking-wide">
                Entry Conditions
              </div>
              <div className="space-y-1.5">
                {spec.entry_conditions?.length > 0 ? (
                  spec.entry_conditions.map((cond, idx) => (
                    <ConditionItem key={idx} condition={cond} />
                  ))
                ) : (
                  <span className="text-xs text-base-content/40">No entry conditions</span>
                )}
              </div>
            </div>

            {/* Exit Conditions */}
            <div>
              <div className="text-xs font-semibold text-base-content/60 mb-2 uppercase tracking-wide">
                Exit Conditions
              </div>
              <div className="space-y-1.5">
                {spec.exit_conditions?.length > 0 ? (
                  spec.exit_conditions.map((cond, idx) => (
                    <ConditionItem key={idx} condition={cond} />
                  ))
                ) : (
                  <span className="text-xs text-base-content/40">No exit conditions</span>
                )}
              </div>
            </div>

            {/* Risk Management */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-base-300/50">
              <div className="bg-base-300/30 rounded p-2.5">
                <div className="text-xs text-base-content/60 mb-1">Position Sizing</div>
                <div className="text-sm font-medium capitalize">{spec.position_sizing?.method || "fixed"}</div>
                {spec.position_sizing?.atr_multiplier && (
                  <div className="text-xs text-base-content/40 mt-0.5">ATR: {spec.position_sizing.atr_multiplier}x</div>
                )}
                {spec.position_sizing?.risk_per_trade_pct && (
                  <div className="text-xs text-base-content/40 mt-0.5">Risk: {spec.position_sizing.risk_per_trade_pct}%</div>
                )}
              </div>
              <div className="bg-base-300/30 rounded p-2.5">
                <div className="text-xs text-base-content/60 mb-1">Trailing Stop</div>
                <div className="text-sm font-medium">
                  {spec.trailing?.trailing_stop ? "Enabled" : "Disabled"}
                </div>
                {spec.trailing?.trailing_stop && spec.trailing?.trailing_stop_positive && (
                  <div className="text-xs text-base-content/40 mt-0.5">
                    +{spec.trailing.trailing_stop_positive}%
                  </div>
                )}
              </div>
            </div>

            {/* ROI Targets */}
            {spec.roi && spec.roi.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-base-content/60 mb-2 uppercase tracking-wide">
                  ROI Targets
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {spec.roi.map(([mins, pct], idx) => (
                    <span key={idx} className="badge badge-sm badge-success/20 text-success border-success/30">
                      {mins}m: +{(pct * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
