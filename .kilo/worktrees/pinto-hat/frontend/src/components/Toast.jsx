import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastCtx = createContext(null);

let _globalToast = null;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const push = useCallback((message, type = "error", duration = 5000) => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  _globalToast = push;

  const alertClass = (type) => {
    switch (type) {
      case "success": return "alert-success";
      case "warning": return "alert-warning";
      case "info":    return "alert-info";
      default:        return "alert-error";
    }
  };

  const icon = (type) => {
    if (type === "success") return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
    if (type === "info") return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    );
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    );
  };

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}

      {toasts.length > 0 && (
        <div className="toast toast-end toast-bottom z-[9999] max-w-sm gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`alert ${alertClass(t.type)} text-xs shadow-lg flex items-start gap-2 py-2.5 px-3`}
            >
              {icon(t.type)}
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                className="btn btn-ghost btn-xs btn-square shrink-0 opacity-60 hover:opacity-100 -mr-1 -mt-0.5"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function toast(message, type = "error", duration = 5000) {
  if (_globalToast) _globalToast(message, type, duration);
}
