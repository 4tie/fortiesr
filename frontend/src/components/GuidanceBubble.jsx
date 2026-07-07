import { useCallback, useEffect, useRef, useState } from "react";
import MiniAIAssistantContainer from "./MiniAIAssistantContainer.jsx";

const DEFAULT_POSITION = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
const BUBBLE_SIZE = 56;
const BUBBLE_Z_INDEX = 9999;

export default function GuidanceBubble({ contextOverrides = {} }) {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("guidanceBubblePosition");
    return saved ? JSON.parse(saved) : DEFAULT_POSITION;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

  const dragOffset = useRef({ x: 0, y: 0 });
  const bubbleRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("guidanceBubblePosition", JSON.stringify(position));
  }, [position]);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStarted(false);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    setDragStarted(true);
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!dragStarted) {
      setIsPopupOpen((open) => !open);
      setPopupPosition({
        x: Math.min(window.innerWidth - 400, Math.max(10, position.x)),
        y: Math.max(10, position.y - 250),
      });
    }
    setDragStarted(false);
  }, [dragStarted, position]);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  };

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;

    setDragStarted(true);
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (!dragStarted) {
      handleClick();
    }
  }, [dragStarted, handleClick]);

  useEffect(() => {
    if (!isDragging) return undefined;

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
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchEnd, handleTouchMove]);

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

  return (
    <>
      <div
        ref={bubbleRef}
        className="bg-gradient-to-br from-violet-600 to-cyan-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200"
        style={bubbleStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        title="AI Assistant"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      </div>

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
          <MiniAIAssistantContainer contextOverrides={contextOverrides} />
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
