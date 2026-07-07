import { CARD_STATUS, INITIAL_WORKFLOW_STATE, workflowReducer } from "./useAssistantWorkflow.js";

function reduce(events) {
  return events.reduce((state, event) => workflowReducer(state, { event }), INITIAL_WORKFLOW_STATE);
}

describe("workflowReducer backend event correlation", () => {
  test("correlates confirmation, started, progress, and terminal result into one card", () => {
    const state = reduce([
      {
        type: "tool_confirmation_required",
        action_id: "action-1",
        tool_name: "run_backtest",
        arguments: { strategy_name: "Demo" },
      },
      { type: "tool_started", action_id: "action-1", tool_name: "run_backtest" },
      {
        type: "job_active",
        tool_name: "run_backtest",
        status: "running",
        api_session_id: "api-1",
        progress: { status: "running" },
      },
      {
        type: "tool_progress",
        tool_name: "run_backtest",
        status: "running",
        progress: { status: "running", phase: "Executing" },
      },
      {
        type: "tool_result",
        tool_call_id: "call-1",
        tool_name: "run_backtest",
        result: { run_id: "bt-1" },
      },
    ]);

    const cards = Object.values(state.cards);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      status: CARD_STATUS.COMPLETED,
      actionId: "action-1",
      apiSessionId: "api-1",
      toolCallId: "call-1",
    });
  });

  test("correlates failed lifecycle into one failed card", () => {
    const state = reduce([
      { type: "tool_confirmation_required", action_id: "action-1", tool_name: "run_optimizer" },
      { type: "tool_started", action_id: "action-1", tool_name: "run_optimizer" },
      { type: "job_active", tool_name: "run_optimizer", status: "running", optimizer_session_id: "opt-1" },
      { type: "tool_failed", tool_name: "run_optimizer", optimizer_session_id: "opt-1", error: "boom" },
    ]);

    const cards = Object.values(state.cards);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      status: CARD_STATUS.FAILED,
      optimizerSessionId: "opt-1",
      error: "boom",
    });
  });

  test("keeps observation timeout distinct from execution timeout", () => {
    const observed = reduce([
      { type: "tool_started", tool_call_id: "call-1", tool_name: "run_backtest" },
      { type: "job_active", tool_name: "run_backtest", status: "running", api_session_id: "api-1" },
      { type: "observation_timeout", tool_name: "run_backtest", api_session_id: "api-1" },
    ]);
    expect(Object.values(observed.cards)[0].status).toBe(CARD_STATUS.OBSERVATION_PAUSED);

    const executed = reduce([
      { type: "tool_started", tool_call_id: "call-2", tool_name: "run_backtest" },
      { type: "job_active", tool_name: "run_backtest", status: "running", api_session_id: "api-2" },
      { type: "tool_timed_out", tool_name: "run_backtest", api_session_id: "api-2" },
    ]);
    expect(Object.values(executed.cards)[0].status).toBe(CARD_STATUS.EXECUTION_TIMED_OUT);
  });
});
