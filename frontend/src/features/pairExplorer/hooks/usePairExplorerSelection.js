import { useEffect, useRef, useState } from "react";

export function usePairExplorerSelection() {
  const [checkedPairs, setCheckedPairs] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const successTimerRef = useRef(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const resetSelection = () => {
    setCheckedPairs(new Set());
  };

  const togglePairs = (pairs, checked) => {
    setCheckedPairs((prev) => {
      const next = new Set(prev);
      pairs.forEach((pair) => {
        if (checked) next.add(pair);
        else next.delete(pair);
      });
      return next;
    });
  };

  const applyPairs = ({ syncSharedState }) => {
    if (!syncSharedState || checkedPairs.size === 0) return;
    setApplying(true);
    try {
      syncSharedState({ pairs: [...checkedPairs] });
      setApplySuccess(true);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setApplySuccess(false);
        successTimerRef.current = null;
      }, 2500);
    } finally {
      setApplying(false);
    }
  };

  return {
    checkedPairs,
    setCheckedPairs,
    applying,
    applySuccess,
    resetSelection,
    togglePairs,
    applyPairs,
  };
}
