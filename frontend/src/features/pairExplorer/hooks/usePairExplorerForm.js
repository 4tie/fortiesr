import { useEffect, useMemo, useRef, useState } from "react";
import { defaultDateRange } from "../formatters";
import { hydrateFormFromSharedState, sharedStatePatchFromForm } from "../utils";

const LOCAL_STORAGE_KEY = "pair_explorer_form";

function loadFromLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToLocalStorage(form) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(form));
  } catch (err) {
    console.debug("Failed to save form to localStorage:", err);
  }
}

export function usePairExplorerForm({ sharedState, sharedLoading, syncSharedState }) {
  const initialDates = useMemo(() => defaultDateRange(), []);
  const hydratedRef = useRef(false);
  const [form, setForm] = useState(() => {
    const saved = loadFromLocalStorage();
    return saved || {
      strategyName: "",
      timeframe: "1h",
      dateStart: initialDates.start,
      dateEnd: initialDates.end,
      pairs: [],
      wallet: "1000",
      maxTrades: "1",
    };
  });

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setPairs = (pairs) => {
    setField("pairs", pairs);
  };

  useEffect(() => {
    if (sharedLoading || hydratedRef.current) return;
    hydratedRef.current = true;
    
    // Try to hydrate from shared state first
    if (sharedState) {
      const patch = hydrateFormFromSharedState(sharedState);
      if (Object.keys(patch).length > 0) {
        const timeoutId = setTimeout(() => {
          setForm((prev) => ({ ...prev, ...patch }));
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [sharedLoading, sharedState]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    
    // Save to localStorage on every form change
    saveToLocalStorage(form);
    
    // Also sync to backend shared state if available
    if (syncSharedState) {
      const patch = sharedStatePatchFromForm(form);
      if (Object.keys(patch).length > 0) {
        syncSharedState(patch);
      }
    }
  }, [form, syncSharedState]);

  return {
    form,
    setField,
    setPairs,
  };
}
