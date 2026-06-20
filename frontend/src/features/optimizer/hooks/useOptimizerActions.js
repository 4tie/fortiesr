import { useCallback, useState } from "react";
import {
  applyOptimizerTrial,
  exportOptimizerTrials,
  getTrialApplicationPreview,
  getTrialParams,
  promoteOptimizerTrial,
} from "../api";

export function useOptimizerActions({ strategyName, optSessionId, trials, checkedTrials, setCheckedTrials, addToast }) {
  const [promotingCandidate, setPromotingCandidate] = useState(false);
  const [candidateResult, setCandidateResult] = useState(null);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [paramsModalData, setParamsModalData] = useState(null);
  const [paramsModalTitle, setParamsModalTitle] = useState("Best Trial Parameters");
  const [paramsLoading, setParamsLoading] = useState(false);
  const [applyConfirmTrial, setApplyConfirmTrial] = useState(null);
  const [applyConfirmText, setApplyConfirmText] = useState("");
  const [applyPreview, setApplyPreview] = useState(null);
  const [applyPreviewLoading, setApplyPreviewLoading] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const resetActionState = useCallback(() => {
    setCandidateResult(null);
    setParamsModalOpen(false);
    setParamsModalData(null);
    setApplyConfirmTrial(null);
    setApplyConfirmText("");
    setApplyPreview(null);
    setDangerOpen(false);
  }, []);

  const applyTrial = useCallback(async (trial) => {
    if (!trial?.parameters) return;
    try {
      await applyOptimizerTrial({ strategyName, parameters: trial.parameters });
      addToast(`Trial #${trial.trial_number} parameters overwritten on accepted version.`, "success");
    } catch (err) {
      addToast(err.message || "Failed to apply parameters.", "error");
    }
  }, [addToast, strategyName]);

  const openApplyConfirm = useCallback(async (trial) => {
    if (!trial) return;
    setApplyConfirmTrial(trial);
    setApplyConfirmText("");
    setApplyPreview(null);
    setApplyPreviewLoading(true);
    try {
      const data = await getTrialApplicationPreview({ optimizerSessionId: optSessionId, trialNumber: trial.trial_number });
      setApplyPreview(data);
    } catch (err) {
      setApplyPreview({ error: err.message || "Preview unavailable due to a network error." });
    } finally {
      setApplyPreviewLoading(false);
    }
  }, [optSessionId]);

  const viewParams = useCallback(async (trialNumber = null) => {
    if (!optSessionId) return;
    setParamsLoading(true);
    setParamsModalOpen(true);
    setParamsModalData(null);
    setParamsModalTitle(trialNumber == null ? "Best Trial Parameters" : `Trial #${trialNumber} Parameters`);
    try {
      const data = await getTrialParams({ optimizerSessionId: optSessionId, trialNumber });
      setParamsModalData(data);
    } catch (err) {
      setParamsModalData({ error: err.message || "Network error loading params." });
    } finally {
      setParamsLoading(false);
    }
  }, [optSessionId]);

  const promoteCandidate = useCallback(async (trial = null) => {
    if (!optSessionId) return;
    setPromotingCandidate(true);
    setCandidateResult(null);
    try {
      const data = await promoteOptimizerTrial({ optimizerSessionId: optSessionId, trial });
      setCandidateResult({ ok: true, ...data });
      addToast(`Candidate version created: ${data.candidate_version_id}`, "success");
    } catch (err) {
      setCandidateResult({ ok: false, error: err.message || "Promotion failed." });
      addToast(err.message || "Failed to promote candidate.", "error");
    } finally {
      setPromotingCandidate(false);
    }
  }, [addToast, optSessionId]);

  const exportSelected = useCallback(async (specificTrial = null) => {
    const toExport = specificTrial ? [specificTrial] : trials.filter((t) => checkedTrials.has(t.trial_number));
    if (!toExport.length) return;
    const payloadTrials = toExport.map((t) => ({
      strategy_name: strategyName,
      trial_number: t.trial_number,
      score: t.metrics?.score ?? null,
      parameters: t.parameters || {},
      metrics: {
        net_profit_pct: t.metrics?.net_profit_pct ?? null,
        net_profit_abs: t.metrics?.net_profit_abs ?? null,
        max_drawdown_pct: t.metrics?.max_drawdown_pct ?? null,
        max_drawdown_abs: t.metrics?.max_drawdown_abs ?? null,
        total_trades: t.metrics?.total_trades ?? null,
        win_rate_pct: t.metrics?.win_rate_pct ?? null,
        profit_factor: t.metrics?.profit_factor ?? null,
        sharpe_ratio: t.metrics?.sharpe_ratio ?? null,
      },
    }));
    try {
      await exportOptimizerTrials(payloadTrials);
      addToast(`${toExport.length} configuration${toExport.length > 1 ? "s" : ""} exported to Stress Test Lab.`, "success");
      if (!specificTrial) setCheckedTrials(new Set());
    } catch (err) {
      addToast(err.message || "Export failed.", "error");
    }
  }, [addToast, checkedTrials, setCheckedTrials, strategyName, trials]);

  return {
    promotingCandidate,
    candidateResult,
    setCandidateResult,
    paramsModalOpen,
    setParamsModalOpen,
    paramsModalData,
    paramsModalTitle,
    paramsLoading,
    applyConfirmTrial,
    setApplyConfirmTrial,
    applyConfirmText,
    setApplyConfirmText,
    applyPreview,
    applyPreviewLoading,
    dangerOpen,
    setDangerOpen,
    resetActionState,
    applyTrial,
    openApplyConfirm,
    viewParams,
    promoteCandidate,
    exportSelected,
  };
}
