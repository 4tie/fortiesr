import { useCallback, useEffect, useRef, useState } from "react";
import MiniAIAssistantContainer from "./MiniAIAssistantContainer.jsx";

const DEFAULT_POSITION = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
const BUBBLE_SIZE = 56;
const BUBBLE_Z_INDEX = 9999;

export default function GuidanceBubble({ contextOverrides = {}, onNavigate, activeTab }) {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("guidanceBubblePosition");
    return saved ? JSON.parse(saved) : DEFAULT_POSITION;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStarted, setDragStarted] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [isPopupDragging, setIsPopupDragging] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const popupDragOffset = useRef({ x: 0, y: 0 });
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
        y: Math.max(10, position.y - 570),
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
    const handlePopupPointerMove = (e) => {
      if (!isPopupDragging) return;
      const newX = e.clientX - popupDragOffset.current.x;
      const newY = e.clientY - popupDragOffset.current.y;
      const maxX = window.innerWidth - 390;
      const maxY = window.innerHeight - 560;

      setPopupPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handlePopupPointerUp = () => {
      if (isPopupDragging) setIsPopupDragging(false);
    };

    if (isPopupDragging) {
      window.addEventListener("pointermove", handlePopupPointerMove);
      window.addEventListener("pointerup", handlePopupPointerUp);
    }

    if (!isDragging && !isPopupDragging) return undefined;

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("pointermove", handlePopupPointerMove);
      window.removeEventListener("pointerup", handlePopupPointerUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, isPopupDragging, handleMouseMove, handleMouseUp, handleTouchEnd, handleTouchMove]);

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
          className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-violet-200 dark:border-gray-700 overflow-hidden flex flex-col"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            width: "390px",
            height: "560px",
            zIndex: BUBBLE_Z_INDEX + 2,
            animation: "fadeInScale 0.3s ease-out",
          }}
        >
          <MiniAIAssistantContainer
            contextOverrides={contextOverrides}
            onNavigate={(tabId) => {
              onNavigate?.(tabId);
              setIsPopupOpen(false);
            }}
            onClose={() => setIsPopupOpen(false)}
            onHeaderPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              setIsPopupDragging(true);
              popupDragOffset.current = {
                x: e.clientX - popupPosition.x,
                y: e.clientY - popupPosition.y,
              };
            }}
          />
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
