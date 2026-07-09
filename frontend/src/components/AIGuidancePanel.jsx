import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { XMarkIcon, MinusIcon, ArrowsPointingOutIcon, SparklesIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import { useGuidanceContext } from "../features/guidance/hooks/useGuidanceContext";
import { guidanceApi } from "../features/guidance/api";

const DEFAULT_POSITION = { x: 20, y: 20 };
const MIN_SIZE = { width: 300, height: 200 };
const PANEL_Z_INDEX = 9999;

function MarkdownRenderer({ content }) {
  if (!content || typeof content !== 'string') return <span>{content}</span>;
  
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AIGuidancePanel({ activeTab = null }) {
  const { context, getContextSuggestions } = useGuidanceContext(activeTab);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("guidancePanelPosition");
    return saved ? JSON.parse(saved) : DEFAULT_POSITION;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [selectedScenario, setSelectedScenario] = useState("");
  const [customIssue, setCustomIssue] = useState("");
  const [guidanceResponse, setGuidanceResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("guidancePanelPosition", JSON.stringify(position));
  }, [position]);

  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest(".drag-handle") || e.target.closest(".panel-header")) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - (isMaximized ? size.width : MIN_SIZE.width);
    const maxY = window.innerHeight - 40;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support
  const handleTouchStart = (e) => {
    if (e.target.closest(".drag-handle") || e.target.closest(".panel-header")) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragOffset.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    
    const maxX = window.innerWidth - (isMaximized ? size.width : MIN_SIZE.width);
    const maxY = window.innerHeight - 40;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
      
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, position, isMaximized, size]);

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (!isMaximized) {
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 100 });
      setPosition({ x: 20, y: 20 });
    } else {
      setSize({ width: 400, height: 500 });
    }
  };

  const handleClose = () => {
    // Could add logic to hide panel temporarily
    setIsMinimized(true);
  };

  const handleScenarioChange = (e) => {
    setSelectedScenario(e.target.value);
    setGuidanceResponse(null);
  };

  const handleStartGuidance = async () => {
    setIsLoading(true);
    try {
      const userInput = customIssue || selectedScenario;
      const response = await guidanceApi.getGuidance(context, userInput, selectedScenario);
      setGuidanceResponse(response);
    } catch (error) {
      console.error("Failed to get guidance:", error);
      // Use fallback
      const fallback = guidanceApi.getFallbackGuidance(context, customIssue, selectedScenario);
      setGuidanceResponse(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedScenario("");
    setCustomIssue("");
    setGuidanceResponse(null);
  };

  const panelStyle = {
    position: "fixed",
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: isMaximized ? `${size.width}px` : (isMinimized ? "auto" : "400px"),
    height: isMinimized ? "auto" : (isMaximized ? `${size.height}px` : "500px"),
    zIndex: PANEL_Z_INDEX,
    cursor: isDragging ? "grabbing" : "default",
  };

  return (
    <div
      ref={panelRef}
      className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
      style={panelStyle}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Header */}
      <div className="panel-header drag-handle bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between cursor-grab">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-white" />
          <h3 className="text-white font-semibold text-sm">AI Guidance Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <MinusIcon className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            <ArrowsPointingOutIcon className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Close"
          >
            <XMarkIcon className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4 h-full overflow-y-auto" style={{ maxHeight: isMaximized ? "calc(100vh - 100px)" : "450px" }}>
          <div className="space-y-4">
            {/* Context Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <strong>Current Context:</strong> {context.currentPage || "Unknown"}
              </p>
              {context.strategy && (
                <p className="text-xs text-gray-500 mt-1">
                  Strategy: {context.strategy}
                </p>
              )}
              {context.pipelineRunning && (
                <p className="text-xs text-orange-600 mt-1">
                  Pipeline running: {context.pipelineStage || "initializing"}
                </p>
              )}
            </div>

            {/* Show guidance response if available */}
            {guidanceResponse ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {guidanceResponse.title || "Guidance"}
                  </h4>
                  <button
                    onClick={handleReset}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Start Over
                  </button>
                </div>

                {guidanceResponse.message && (
                  <MarkdownRenderer content={guidanceResponse.message} />
                )}

                {guidanceResponse.steps && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Steps:</p>
                    <MarkdownRenderer content={guidanceResponse.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')} />
                  </div>
                )}

                {guidanceResponse.recommendations && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-800 mb-2">Recommendations:</p>
                    <MarkdownRenderer content={guidanceResponse.recommendations.map(rec => `- ${rec}`).join('\n')} />
                  </div>
                )}

                {guidanceResponse.issues && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-800 mb-2">Issues Detected:</p>
                    <MarkdownRenderer content={guidanceResponse.issues.map(issue => `- ${issue}`).join('\n')} />
                  </div>
                )}

                {guidanceResponse.metrics && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-800 mb-2">Key Metrics:</p>
                    <MarkdownRenderer content={guidanceResponse.metrics.map(metric => `- ${metric}`).join('\n')} />
                  </div>
                )}

                {guidanceResponse.tips && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-800 mb-2">Tips:</p>
                    <MarkdownRenderer content={guidanceResponse.tips.map(tip => `- ${tip}`).join('\n')} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Welcome Message */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Welcome!</strong> I'm your AI guidance assistant. I can help you:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Create new trading strategies</li>
                    <li>Improve existing strategies</li>
                    <li>Analyze backtest results</li>
                    <li>Optimize strategy parameters</li>
                    <li>Debug failing strategies</li>
                  </ul>
                </div>

                {/* Scenario Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What would you like to do?
                  </label>
                  <select
                    value={selectedScenario}
                    onChange={handleScenarioChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a scenario...</option>
                    <option value="new-strategy">Create a new strategy</option>
                    <option value="improve-strategy">Improve existing strategy</option>
                    <option value="analyze-backtest">Analyze backtest results</option>
                    <option value="optimize-parameters">Optimize parameters</option>
                    <option value="debug-strategy">Debug failing strategy</option>
                    <option value="custom">Describe custom issue</option>
                  </select>
                </div>

                {/* Custom Issue Input */}
                {selectedScenario === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe your specific issue:
                    </label>
                    <textarea
                      value={customIssue}
                      onChange={(e) => setCustomIssue(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      placeholder="E.g., 'My strategy works well on BTC/USDT but fails on other pairs...'"
                    />
                  </div>
                )}

                {/* Start Button */}
                <button
                  onClick={handleStartGuidance}
                  disabled={isLoading || !selectedScenario}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Getting Guidance..." : "Start Guidance"}
                </button>
              </>
            )}

            {/* AI Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500">
                <strong>AI Status:</strong> Ollama Integration
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Fallback to rule-based guidance if AI unavailable
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
