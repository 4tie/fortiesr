import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_AUTOQUANT_FORM } from "../constants";
import { loadAutoQuantOptions, loadTimeframeThresholds, saveAutoQuantOptions } from "../api";
import { pairsEqualUnordered } from "../../../utils/pairs.js";

export default function useAutoQuantForm({ sharedState, sharedLoading, syncSharedState } = {}) {
  const [form, setForm] = useState(DEFAULT_AUTOQUANT_FORM);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [timeframeProfile, setTimeframeProfile] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hydrated = useRef(false);
  const lastUserPairChangeTime = useRef(0);
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Load saved options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const data = await loadAutoQuantOptions();
        setForm((prev) => ({
          ...prev,
          ...data,
          pair_universe: prev.pair_universe || data.pair_universe || "",
        }));
      } catch (err) {
        console.error("Failed to load saved options:", err);
      } finally {
        setOptionsLoaded(true);
      }
    };
    loadOptions();
  }, []);

  // Sync from sharedState
  useEffect(() => {
    if (sharedLoading || !sharedState) return;
    const currentForm = formRef.current;
    if (!hydrated.current) {
      hydrated.current = true;
      const updates = {};
      if (sharedState.strategy_name && currentForm.strategy !== sharedState.strategy_name) {
        updates.strategy = sharedState.strategy_name;
      }
      if (sharedState.timeframe && currentForm.timeframe !== sharedState.timeframe) {
        updates.timeframe = sharedState.timeframe;
      }
      if (sharedState.dry_run_wallet != null && currentForm.dry_run_wallet !== sharedState.dry_run_wallet) {
        updates.dry_run_wallet = sharedState.dry_run_wallet;
      }
      if (sharedState.max_open_trades != null && currentForm.max_open_trades !== sharedState.max_open_trades) {
        updates.max_open_trades = sharedState.max_open_trades;
      }
      if (Object.keys(updates).length) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    }
    // Only sync pairs from sharedState if not recently user-initiated (debounce 1 second)
    const now = Date.now();
    if (sharedState.pairs?.length && now - lastUserPairChangeTime.current > 1000) {
      const currentPairs = typeof currentForm.pair_universe === 'string'
        ? currentForm.pair_universe.split(',').map(p => p.trim()).filter(Boolean)
        : [];
      const sharedPairs = sharedState.pairs;
      const equal = pairsEqualUnordered(currentPairs, sharedPairs);
      if (!equal) {
        setForm((prev) => ({ ...prev, pair_universe: sharedPairs.join(', ') }));
      }
    }
  }, [sharedState, sharedLoading]);

  // Sync to sharedState
  useEffect(() => {
    if (!syncSharedState || !hydrated.current) return;
    const pairs = typeof form.pair_universe === 'string' 
      ? form.pair_universe.split(',').map(p => p.trim()).filter(p => p)
      : [];
    const payload = {};
    if (form.strategy) payload.strategy_name = form.strategy;
    if (form.timeframe) payload.timeframe = form.timeframe;
    if (pairs.length) payload.pairs = pairs;
    if (form.dry_run_wallet != null) payload.dry_run_wallet = form.dry_run_wallet;
    if (form.max_open_trades != null) payload.max_open_trades = form.max_open_trades;
    if (Object.keys(payload).length) syncSharedState(payload);
  }, [form.strategy, form.timeframe, form.pair_universe, form.dry_run_wallet, form.max_open_trades, syncSharedState]);

  // Save options on form change with debouncing
  useEffect(() => {
    if (!optionsLoaded) return undefined;
    const timeoutId = setTimeout(async () => {
      try {
        await saveAutoQuantOptions(form);
      } catch (err) {
        console.error("Failed to save options:", err);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [form, optionsLoaded]);

  const applyTimeframeThresholds = useCallback(async (tf) => {
    try {
      const data = await loadTimeframeThresholds(tf);
      setTimeframeProfile(data);
      setForm((prev) => ({
        ...prev,
        min_oos_profit: data.min_oos_profit,
        max_drawdown_threshold: data.max_drawdown_threshold,
        min_win_rate: data.min_win_rate,
        min_profit_factor: data.min_profit_factor,
        min_sharpe: data.min_sharpe,
      }));
    } catch (err) {
      console.debug("Failed to apply timeframe thresholds:", err);
    }
  }, []);

  useEffect(() => {
    const apply = async () => {
      await applyTimeframeThresholds(form.timeframe);
    };
    apply();
  }, [form.timeframe, applyTimeframeThresholds]);

  const updateField = useCallback((field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))
  , []);

  const markUserInitiatedPairChange = useCallback(() => {
    lastUserPairChangeTime.current = Date.now();
  }, []);

  const toggleSpace = useCallback((space) => {
    setForm((prev) => ({
      ...prev,
      hyperopt_spaces: prev.hyperopt_spaces.includes(space)
        ? prev.hyperopt_spaces.filter((s) => s !== space)
        : [...prev.hyperopt_spaces, space]
    }));
  }, []);

  return {
    form,
    setForm,
    updateField,
    toggleSpace,
    timeframeProfile,
    showAdvanced,
    setShowAdvanced,
    optionsLoaded,
    markUserInitiatedPairChange,
  };
}
