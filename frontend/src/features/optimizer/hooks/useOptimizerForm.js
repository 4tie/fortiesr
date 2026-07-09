/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate, fromTimerangeDate, toTimerange } from "../formatters";
import { parsePairs } from "../utils";
import { pairsEqualUnordered } from "../../../utils/pairs.js";

function initialDateRange() {
  const end = fmtDate(new Date());
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  return { start: fmtDate(startDate), end };
}

export function useOptimizerForm({ sharedState, sharedLoading, syncSharedState }) {
  const initial = useMemo(() => initialDateRange(), []);
  const hydrated = useRef(false);
  const lastUserPairChangeTime = useRef(0);

  const [strategyName, setStrategyName] = useState("");
  const [timeframe, setTimeframe] = useState("1h");
  const [dateStart, setDateStart] = useState(initial.start);
  const [dateEnd, setDateEnd] = useState(initial.end);
  const [pairsText, setPairsText] = useState("");
  const [totalTrials, setTotalTrials] = useState(50);
  const [searchStrategy, setSearchStrategy] = useState("random");
  const [parameterMode, setParameterMode] = useState("auto_safe");
  const [scoreMetric, setScoreMetric] = useState("composite");
  const [maxOpenTrades, setMaxOpenTrades] = useState(3);
  const [wallet, setWallet] = useState(1000);
  const [enableVectorbtScreening, setEnableVectorbtScreening] = useState(true);
  const [vectorbtCandidateCount, setVectorbtCandidateCount] = useState(1000);
  const [vectorbtKeepRatio, setVectorbtKeepRatio] = useState(0.1);
  const [vectorbtTimeoutSeconds, setVectorbtTimeoutSeconds] = useState(120);

  useEffect(() => {
    if (sharedLoading || !sharedState) return;
    if (!hydrated.current) {
      hydrated.current = true;
      if (sharedState.strategy_name) setStrategyName(sharedState.strategy_name);
      if (sharedState.timeframe) setTimeframe(sharedState.timeframe);
      if (sharedState.max_open_trades != null) setMaxOpenTrades(sharedState.max_open_trades);
      if (sharedState.dry_run_wallet != null) setWallet(sharedState.dry_run_wallet);
      if (sharedState.optimizer_total_trials != null) setTotalTrials(sharedState.optimizer_total_trials);
      if (sharedState.optimizer_search_strategy) setSearchStrategy(sharedState.optimizer_search_strategy);
      if (sharedState.optimizer_parameter_mode) setParameterMode(sharedState.optimizer_parameter_mode);
      if (sharedState.optimizer_score_metric) setScoreMetric(sharedState.optimizer_score_metric);
      if (sharedState.enable_vectorbt_screening != null) setEnableVectorbtScreening(Boolean(sharedState.enable_vectorbt_screening));
      if (sharedState.vectorbt_candidate_count != null) setVectorbtCandidateCount(sharedState.vectorbt_candidate_count);
      if (sharedState.vectorbt_keep_ratio != null) setVectorbtKeepRatio(sharedState.vectorbt_keep_ratio);
      if (sharedState.vectorbt_timeout_seconds != null) setVectorbtTimeoutSeconds(sharedState.vectorbt_timeout_seconds);
      const start = sharedState.start_date || "";
      const end = sharedState.end_date || "";
      if (start && end) {
        setDateStart(start);
        setDateEnd(end);
      } else if (sharedState.timerange) {
        const [rawStart, rawEnd] = sharedState.timerange.split("-");
        const formattedStart = fromTimerangeDate(rawStart);
        const formattedEnd = fromTimerangeDate(rawEnd);
        if (formattedStart) setDateStart(formattedStart);
        if (formattedEnd) setDateEnd(formattedEnd);
      }
    }
    // Only sync pairs from sharedState if not recently user-initiated (debounce 1 second)
    const now = Date.now();
    if (sharedState.pairs?.length && now - lastUserPairChangeTime.current > 1000) {
      const currentPairs = parsePairs(pairsText);
      const sharedPairs = sharedState.pairs;
      if (!pairsEqualUnordered(currentPairs, sharedPairs)) {
        setPairsText(sharedPairs.join(", "));
      }
    }
  }, [sharedState, sharedLoading, pairsText]);

  useEffect(() => {
    if (!syncSharedState || !hydrated.current) return;
    const pairs = parsePairs(pairsText);
    const patch = {};
    if (strategyName) patch.strategy_name = strategyName;
    if (timeframe) patch.timeframe = timeframe;
    if (pairs.length) patch.pairs = pairs;
    if (dateStart) patch.start_date = dateStart;
    if (dateEnd) patch.end_date = dateEnd;
    if (dateStart && dateEnd) patch.timerange = toTimerange(dateStart, dateEnd);
    if (maxOpenTrades) patch.max_open_trades = maxOpenTrades;
    if (wallet) patch.dry_run_wallet = wallet;
    patch.optimizer_total_trials = totalTrials;
    patch.optimizer_search_strategy = searchStrategy;
    patch.optimizer_parameter_mode = parameterMode;
    patch.optimizer_score_metric = scoreMetric;
    patch.enable_vectorbt_screening = enableVectorbtScreening;
    patch.vectorbt_candidate_count = vectorbtCandidateCount;
    patch.vectorbt_keep_ratio = vectorbtKeepRatio;
    patch.vectorbt_timeout_seconds = vectorbtTimeoutSeconds;
    if (Object.keys(patch).length) syncSharedState(patch);
  }, [strategyName, timeframe, pairsText, dateStart, dateEnd, maxOpenTrades, wallet, totalTrials, searchStrategy, parameterMode, scoreMetric, enableVectorbtScreening, vectorbtCandidateCount, vectorbtKeepRatio, vectorbtTimeoutSeconds, syncSharedState]);

  const pairList = useMemo(() => parsePairs(pairsText), [pairsText]);
  const timerange = toTimerange(dateStart, dateEnd);
  const validDateRange = !dateStart || !dateEnd || dateStart <= dateEnd;

  const markUserInitiatedPairChange = useCallback(() => {
    lastUserPairChangeTime.current = Date.now();
  }, []);

  return {
    strategyName,
    setStrategyName,
    timeframe,
    setTimeframe,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    pairsText,
    setPairsText,
    totalTrials,
    setTotalTrials,
    searchStrategy,
    setSearchStrategy,
    parameterMode,
    setParameterMode,
    scoreMetric,
    setScoreMetric,
    maxOpenTrades,
    setMaxOpenTrades,
    wallet,
    setWallet,
    enableVectorbtScreening,
    setEnableVectorbtScreening,
    vectorbtCandidateCount,
    setVectorbtCandidateCount,
    vectorbtKeepRatio,
    setVectorbtKeepRatio,
    vectorbtTimeoutSeconds,
    setVectorbtTimeoutSeconds,
    pairList,
    timerange,
    validDateRange,
    markUserInitiatedPairChange,
  };
}
