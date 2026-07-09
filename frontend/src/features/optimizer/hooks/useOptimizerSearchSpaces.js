/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTO_SAFE_PARAM_CAP } from "../constants";
import { getOptimizerSearchSpaces } from "../api";
import { autoSafeSpaces, groupedSearchSpaces, gridEstimate, inferSpace } from "../utils";

export function useOptimizerSearchSpaces({ strategyName, parameterMode, setParameterMode }) {
  const [searchSpaces, setSearchSpaces] = useState([]);
  const [spacesLoading, setSpacesLoading] = useState(false);

  useEffect(() => {
    if (!strategyName) {
      setSearchSpaces([]);
      return;
    }
    let cancelled = false;
    setSpacesLoading(true);
    getOptimizerSearchSpaces(strategyName)
      .then((data) => {
        if (cancelled) return;
        const spaces = (data.search_spaces || []).map((s) => ({ ...s, enabled: s.enabled ?? true }));
        setSearchSpaces(parameterMode === "auto_safe" ? autoSafeSpaces(spaces) : spaces);
      })
      .catch(() => {
        if (!cancelled) setSearchSpaces([]);
      })
      .finally(() => {
        if (!cancelled) setSpacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [strategyName, parameterMode]);

  useEffect(() => {
    if (parameterMode !== "auto_safe") return;
    setSearchSpaces((prev) => autoSafeSpaces(prev));
  }, [parameterMode]);

  const toggleParam = useCallback((idx) => {
    setParameterMode("manual");
    setSearchSpaces((prev) => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
  }, [setParameterMode]);

  const updateParam = useCallback((idx, field, raw) => {
    setParameterMode("manual");
    const val = raw === "" ? null : Number(raw);
    setSearchSpaces((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: Number.isNaN(val) ? null : val } : s));
  }, [setParameterMode]);

  const setAllParams = useCallback((enabled) => {
    setParameterMode("manual");
    setSearchSpaces((prev) => prev.map((s) => ({ ...s, enabled })));
  }, [setParameterMode]);

  const enabledSpaces = useMemo(() => searchSpaces.filter((s) => s.enabled), [searchSpaces]);
  const autoSafeEligibleCount = useMemo(
    () => searchSpaces.filter((s) => {
      const group = inferSpace(s);
      return (group === "buy" || group === "sell") && s.optimizable !== false;
    }).length,
    [searchSpaces],
  );
  const gridCount = useMemo(() => gridEstimate(searchSpaces), [searchSpaces]);
  const groupedSpaces = useMemo(() => groupedSearchSpaces(searchSpaces), [searchSpaces]);

  return {
    searchSpaces,
    setSearchSpaces,
    spacesLoading,
    enabledSpaces,
    autoSafeEligibleCount,
    autoSafeCap: AUTO_SAFE_PARAM_CAP,
    gridCount,
    groupedSpaces,
    toggleParam,
    updateParam,
    setAllParams,
  };
}
