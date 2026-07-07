const ANALYSIS_REQUIREMENTS = [
  "why the result performed well or poorly",
  "weak pairs or pair concentration risk",
  "drawdown depth, duration, and recovery risk",
  "exit reasons and whether exits look healthy",
  "overfitting or curve-fit warning signs",
  "what validation to run next",
];

const ACCURACY_REQUIREMENTS = `
**Accuracy Requirements**

1. Use only backend context. Never invent profit, drawdown, profit factor, Sharpe, trade count, confidence, OOS, or WFO values.
2. If a metric is missing, say it is missing and explain what cannot be concluded.
3. Separate facts from interpretation. Use "The context shows" for facts and "This may indicate" for hypotheses.
4. Be specific to the selected run or trial. Avoid generic trading advice.
5. Never promise profit or imply a strategy is safe to trade live.
`;

const FORMATTING_INSTRUCTIONS = `
**Response Format**

1. Start with a clear markdown title identifying the selected run or optimizer trial.
2. Use these sections in order: Executive Summary, Performance Drivers, Pair and Concentration Risk, Drawdown Risk, Exit Reasons, Overfitting Warnings, Draft Next Actions.
3. Put backend-provided numbers in compact tables when available. Do not create tables for missing data.
4. Keep draft actions short and specific. For each action include purpose, risk level, and what result would pass or fail validation.
5. Do not include charts, Mermaid diagrams, or generated chart JSON unless the user explicitly asks for visuals.
6. Never end mid-section or mid-table.
`;

function requirementsText() {
  return ANALYSIS_REQUIREMENTS.map((item) => `- ${item}`).join("\n");
}

export function buildBacktestAnalysisPrompt({ runId }) {
  return [
    "Analyze the selected backtest result using only the attached backend context.",
    "",
    `Backtest run id: ${runId || "selected run"}`,
    "",
    ACCURACY_REQUIREMENTS,
    "",
    FORMATTING_INSTRUCTIONS,
    "",
    "Explain:",
    requirementsText(),
    "",
    "Finish with draft-only next actions for OOS validation, walk-forward validation, and useful stress testing.",
    "Do not suggest direct overwrite, strategy file edits, live deployment, or dry-run deployment.",
  ].join("\n");
}

export function buildOptimizerTrialAnalysisPrompt({
  optimizerSessionId,
  trialNumber,
  strategyName,
}) {
  return [
    "Analyze the selected optimizer trial using only the attached backend context.",
    "",
    `Strategy: ${strategyName || "selected strategy"}`,
    `Optimizer session id: ${optimizerSessionId || "selected session"}`,
    `Trial number: ${trialNumber ?? "selected trial"}`,
    "",
    ACCURACY_REQUIREMENTS,
    "",
    FORMATTING_INSTRUCTIONS,
    "",
    "Explain:",
    requirementsText(),
    "",
    "Compare the selected trial against the session and best-trial context if available.",
    "Finish with draft-only next actions for OOS validation, walk-forward validation, Stress Lab export, and candidate promotion.",
    "Keep export and promotion confirmation-gated. Do not recommend direct overwrite, file edit, or deployment.",
  ].join("\n");
}

export function buildReadinessAnalysisPrompt({ readiness }) {
  const inputs = readiness?.inputs || {};
  return [
    "Analyze the attached CandidateReadiness report using only backend-provided readiness context.",
    "",
    `Strategy: ${inputs.strategy_name || "selected strategy"}`,
    `Backtest run id: ${inputs.backtest_run_id || "not attached"}`,
    `Optimizer session id: ${inputs.optimizer_session_id || "not attached"}`,
    `Trial number: ${inputs.trial_number ?? "not attached"}`,
    `Candidate run id: ${inputs.candidate_run_id || "not attached"}`,
    `Stress session id: ${inputs.stress_session_id || "not attached"}`,
    `Temporal stress session id: ${inputs.temporal_stress_session_id || "not attached"}`,
    "",
    ACCURACY_REQUIREMENTS,
    "",
    "**Readiness Rules**",
    "",
    "1. Treat readiness.status, overall_score, gates, blocking_failures, warnings, and missing_sources as the authority.",
    "2. Explain why the backend marked it Ready, Watch, Not Ready, or Insufficient Data.",
    "3. Do not independently decide profitability or override the backend label.",
    "4. Explain weak gates, missing evidence, pair concentration, drawdown, exit health, and overfitting risk.",
    "5. Propose actions only as drafts: OOS, walk-forward, stress-lab payload, or promotion review.",
    "6. Do not suggest direct overwrite, strategy file edits, live deployment, or dry-run deployment.",
    "",
    "**Response Format**",
    "",
    "1. Start with Readiness Summary.",
    "2. Then cover Blocking Failures, Warnings, Missing Evidence, Gate Breakdown, Risk Interpretation, and Draft Next Actions.",
    "3. Use exact backend numbers when present. Say missing when missing.",
  ].join("\n");
}
