import { useState, useEffect, useRef } from "react";
import { useGuidanceContext } from "../features/guidance/hooks/useGuidanceContext";
import { guidanceApi } from "../features/guidance/api";
import { useTheme } from "../hooks/useTheme";

const DEFAULT_POSITION = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
const BUBBLE_SIZE = 56;
const BUBBLE_Z_INDEX = 9999;

export default function GuidanceBubble({ activeTab = null, onNavigate = null }) {
  const { context, getNextStep, WORKFLOW_STEPS } = useGuidanceContext(activeTab);
  const { theme } = useTheme();
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("guidanceBubblePosition");
    return saved ? JSON.parse(saved) : DEFAULT_POSITION;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [guidanceResponse, setGuidanceResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const bubbleRef = useRef(null);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  const nextStep = getNextStep();

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("guidanceBubblePosition", JSON.stringify(position));
  }, [position]);

  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStarted(false);
    isLongPress.current = false;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };

    // Start long-press timer
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsQuickActionsOpen(true);
    }, 500);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setDragStarted(true);
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    // Clear long-press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e) => {
    // Only trigger if not dragged and not long press
    if (!dragStarted && !isLongPress.current) {
      setIsPopupOpen(!isPopupOpen);
      // Position popup above bubble, but ensure it stays in viewport
      const popupY = Math.max(10, position.y - 250);
      const popupX = Math.min(window.innerWidth - 400, Math.max(10, position.x));
      setPopupPosition({
        x: popupX,
        y: popupY,
      });
    }
    // Reset drag state
    setDragStarted(false);
    isLongPress.current = false;
  };

  // Touch support
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    isLongPress.current = false;
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsQuickActionsOpen(true);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!isLongPress.current) {
      handleClick();
    }
  };

  const handleScenarioChange = (e) => {
    setSelectedScenario(e.target.value);
    setGuidanceResponse(null);
  };

  const handleStartGuidance = async () => {
    setIsLoading(true);
    try {
      const response = await guidanceApi.getGuidance(context, selectedScenario, selectedScenario);
      setGuidanceResponse(response);
    } catch (error) {
      console.error("Failed to get guidance:", error);
      const fallback = guidanceApi.getFallbackGuidance(context, "", selectedScenario);
      setGuidanceResponse(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedScenario("");
    setGuidanceResponse(null);
  };

  const handleQuickAction = (scenario) => {
    setSelectedScenario(scenario);
    setIsQuickActionsOpen(false);
    setIsPopupOpen(true);
    handleStartGuidance();
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
  }, [isDragging, position]);

  // Close quick actions after 3 seconds
  useEffect(() => {
    if (isQuickActionsOpen) {
      const timer = setTimeout(() => {
        setIsQuickActionsOpen(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isQuickActionsOpen]);

  const bubbleStyle = {
    position: "fixed",
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${BUBBLE_SIZE}px`,
    height: `${BUBBLE_SIZE}px`,
    borderRadius: "50%",
    zIndex: BUBBLE_Z_INDEX,
    cursor: isDragging ? "grabbing" : "grab",
    animation: "bounce 0.5s ease-out",
  };

  const quickActions = [
    { id: "quick-analyze", label: "Quick Analyze", scenario: "analyze-backtest", icon: "🔍" },
    { id: "new-strategy", label: "New Strategy", scenario: "new-strategy", icon: "🆕" },
    { id: "improve-strategy", label: "Improve", scenario: "improve-strategy", icon: "⚡" },
    { id: "debug-strategy", label: "Debug", scenario: "debug-strategy", icon: "🔧" },
  ];

  return (
    <>
      {/* Bubble Icon */}
      <div
        ref={bubbleRef}
        className="bg-gradient-to-br from-violet-600 to-cyan-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200"
        style={bubbleStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        title="AI Guidance Assistant"
      >
        {/* Compass Icon */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      </div>

      {/* Quick Actions Menu */}
      {isQuickActionsOpen && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: `${position.x + BUBBLE_SIZE / 2}px`,
            top: `${position.y + BUBBLE_SIZE / 2}px`,
            zIndex: BUBBLE_Z_INDEX + 1,
          }}
        >
          {quickActions.map((action, index) => {
            const angle = (index * 90 - 90) * (Math.PI / 180);
            const radius = 80;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return (
              <button
                key={action.id}
                className="pointer-events-auto absolute bg-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center hover:scale-110 transition-transform duration-200"
                style={{
                  left: `${x - 24}px`,
                  top: `${y - 24}px`,
                  animation: `popOut 0.3s ease-out ${index * 0.1}s both`,
                }}
                onClick={() => handleQuickAction(action.scenario)}
                title={action.label}
              >
                <span className="text-xl">{action.icon}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Popup Menu */}
      {isPopupOpen && (
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-violet-200 overflow-hidden"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            width: "380px",
            maxHeight: "500px",
            zIndex: BUBBLE_Z_INDEX + 2,
            animation: "fadeInScale 0.3s ease-out",
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">AI Guidance Assistant</h3>
            <button
              onClick={() => setIsPopupOpen(false)}
              className="text-white hover:bg-white/20 rounded p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto" style={{ maxHeight: "450px" }}>
            {/* Workflow Progress */}
            {context.workflowStep && (
              <div className="bg-gradient-to-r from-violet-50 to-cyan-50 border border-violet-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-violet-800 mb-2">Workflow Progress</p>
                <div className="space-y-2">
                  {WORKFLOW_STEPS.map((step) => {
                    const isActive = step.id === context.workflowStep?.id;
                    const isCompleted = step.order < context.workflowStep?.order;
                    const isPending = step.order > context.workflowStep?.order;

                    return (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        <div
                          className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium ${
                            isActive
                              ? "bg-gradient-to-br from-violet-600 to-cyan-600 text-white"
                              : isCompleted
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {isCompleted ? "✓" : step.order}
                        </div>
                        <span
                          className={`${
                            isActive
                              ? "text-violet-800 font-medium"
                              : isCompleted
                              ? "text-green-700"
                              : "text-gray-500"
                          }`}
                        >
                          {step.label} - {step.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next Step Notification */}
            {nextStep && (
              <div className="bg-gradient-to-r from-cyan-50 to-violet-50 border border-cyan-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-cyan-800 mb-1">Recommended Next Step</p>
                    <p className="text-xs text-gray-700 mb-2">{nextStep.message}</p>
                    {nextStep.action && onNavigate && (
                      <button
                        onClick={() => onNavigate(nextStep.tabId)}
                        className="text-xs bg-gradient-to-r from-violet-600 to-cyan-600 text-white px-3 py-1 rounded-full hover:from-violet-700 hover:to-cyan-700 transition-colors"
                      >
                        {nextStep.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Context Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600">
                <strong>Current Context:</strong> {context.currentPage || "Unknown"}
              </p>
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
                  <p className="text-sm text-gray-700">{guidanceResponse.message}</p>
                )}

                {guidanceResponse.steps && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">Steps:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {guidanceResponse.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-600">{idx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {guidanceResponse.recommendations && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-800 mb-2">Recommendations:</p>
                    <ul className="text-xs text-green-700 space-y-1">
                      {guidanceResponse.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
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
                  </select>
                </div>

                {/* Start Button */}
                <button
                  onClick={handleStartGuidance}
                  disabled={isLoading || !selectedScenario}
                  className="w-full mt-4 bg-gradient-to-r from-violet-600 to-cyan-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:from-violet-700 hover:to-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Getting Guidance..." : "Start Guidance"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes popOut {
          from { opacity: 0; transform: scale(0) rotate(-180deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </>
  );
}
