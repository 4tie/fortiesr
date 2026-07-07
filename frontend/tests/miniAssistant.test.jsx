/**
 * Phase 8 Mini AI Assistant Tests
 *
 * Covers:
 * 1. Normal chat streaming (token → final message, no duplicates)
 * 2. Workflow card lifecycle (confirmation → started → running → completed)
 * 3. Failed workflow (running → failed)
 * 4. Observation timeout (not a failure, not completed)
 * 5. Execution timeout (terminal execution error)
 * 6. Guarded workflow action (card → user click → confirm → SSE → result)
 * 7. Run tab (no-run empty state, optimizer with context, backtest with context)
 * 8. History (renders tool_runs, navigates, handles empty/error)
 * 9. Session restore (messages rebuilt, cards rebuilt, no duplicates)
 */
/* global describe, test, expect, beforeEach, afterEach, jest, global */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { parseSseEvent } from "../src/hooks/useAssistantChat.js";
import { CARD_STATUS, cardKeyFromEvent } from "../src/hooks/useAssistantWorkflow.js";
import WorkflowCard from "../src/components/WorkflowCard.jsx";
import AssistantRunSummary from "../src/components/AssistantRunSummary.jsx";
import AssistantRunHistory from "../src/components/AssistantRunHistory.jsx";
import MiniAIAssistantContainer from "../src/components/MiniAIAssistantContainer.jsx";

// ── Polyfills ─────────────────────────────────────────────────────────────────
global.TextEncoder = global.TextEncoder || require("util").TextEncoder;
global.TextDecoder = global.TextDecoder || require("util").TextDecoder;

// ── Stream helpers ────────────────────────────────────────────────────────────

function encodeSSE(events) {
  return events
    .map(({ type, data }) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

/**
 * Build a fake ReadableStream from SSE event objects.
 * Delivers data in small chunks to exercise the buffer-splitting logic.
 */
function makeStream(events) {
  const text = encodeSSE(events);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let pos = 0;
  const CHUNK = 64;
  return {
    ok: true,
    headers: { get: (h) => (h === "content-type" ? "text/event-stream" : null) },
    body: {
      getReader: () => ({
        read: async () => {
          if (pos >= bytes.length) return { done: true, value: null };
          const chunk = bytes.slice(pos, Math.min(pos + CHUNK, bytes.length));
          pos += CHUNK;
          return { done: false, value: chunk };
        },
        cancel: () => {},
      }),
    },
  };
}

function makeJsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => data,
  };
}

// ── parseSseEvent unit tests ──────────────────────────────────────────────────

describe("parseSseEvent", () => {
  test("parses a token event", () => {
    const chunk = 'event: token\ndata: {"content":"hello"}';
    const result = parseSseEvent(chunk);
    expect(result.type).toBe("token");
    expect(result.data.content).toBe("hello");
  });

  test("parses a done event with session_id", () => {
    const chunk = 'event: done\ndata: {"session_id":"abc","message":{"content":"final"}}';
    const result = parseSseEvent(chunk);
    expect(result.type).toBe("done");
    expect(result.data.session_id).toBe("abc");
  });

  test("parses a workflow event", () => {
    const chunk =
      'event: tool_confirmation_required\ndata: {"tool_name":"run_optimizer","action_id":"a1"}';
    const result = parseSseEvent(chunk);
    expect(result.type).toBe("tool_confirmation_required");
    expect(result.data.action_id).toBe("a1");
  });

  test("returns null for empty data", () => {
    expect(parseSseEvent("event: token\n")).toBeNull();
  });

  test("handles non-JSON data as content string", () => {
    const result = parseSseEvent("event: token\ndata: hello world");
    expect(result.data.content).toBe("hello world");
  });
});

// ── cardKeyFromEvent unit tests ───────────────────────────────────────────────

describe("cardKeyFromEvent", () => {
  test("prefers action_id over tool_call_id and tool_name", () => {
    expect(
      cardKeyFromEvent({ action_id: "a1", tool_call_id: "tc1", tool_name: "foo" })
    ).toBe("action:a1");
  });

  test("falls back to tool_call_id when no action_id", () => {
    expect(cardKeyFromEvent({ tool_call_id: "tc1", tool_name: "foo" })).toBe("call:tc1");
  });

  test("falls back to tool_name when no ids", () => {
    expect(cardKeyFromEvent({ tool_name: "run_optimizer" })).toBe("tool:run_optimizer");
  });

  test("returns null when no identifier is present", () => {
    expect(cardKeyFromEvent({})).toBeNull();
  });
});

// ── WorkflowCard rendering tests ──────────────────────────────────────────────

describe("WorkflowCard", () => {
  test("renders awaiting_confirmation status badge and confirm button", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.AWAITING_CONFIRMATION,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: { strategy_name: "TestStrat", timerange: "20230101-20240101" },
      actionId: "a1",
      confirming: false,
    };
    const onConfirm = jest.fn();
    render(<WorkflowCard card={card} onConfirm={onConfirm} />);

    expect(screen.getByText("Awaiting Confirmation")).toBeInTheDocument();
    expect(screen.getByText("TestStrat")).toBeInTheDocument();
    // Confirm button is the <button> labelled "Run Optimizer"
    const btn = screen.getByRole("button", { name: /Run Optimizer/i });
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith("action:a1", card);
  });

  test("renders running state with pulse indicator and progress lines", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.RUNNING,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
      progress: { completed_trials: 12, total_trials: 50, phase: "freqtrade" },
    };
    render(<WorkflowCard card={card} />);

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("12 / 50 trials")).toBeInTheDocument();
    expect(screen.getByText("Phase: freqtrade")).toBeInTheDocument();
    // No confirm button when running
    expect(screen.queryByRole("button", { name: /Run Optimizer/i })).toBeNull();
  });

  test("renders completed state with navigation button", () => {
    const card = {
      key: "call:tc1",
      status: CARD_STATUS.COMPLETED,
      toolName: "run_backtest",
      title: "Run Backtest",
      arguments: {},
      result: { status: "completed" },
    };
    render(<WorkflowCard card={card} onNavigate={jest.fn()} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Backtest/i })).toBeInTheDocument();
  });

  test("renders failed state with error message", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.FAILED,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
      error: "Model timeout",
    };
    render(<WorkflowCard card={card} />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Model timeout")).toBeInTheDocument();
  });

  test("observation_paused shows Monitoring Paused — not Failed", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.OBSERVATION_PAUSED,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
    };
    render(<WorkflowCard card={card} onNavigate={jest.fn()} />);

    expect(screen.getByText("Monitoring Paused")).toBeInTheDocument();
    expect(screen.getByText(/stopped monitoring/i)).toBeInTheDocument();
    expect(screen.queryByText("Failed")).toBeNull();
  });

  test("execution_timed_out is distinct from observation_paused", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.EXECUTION_TIMED_OUT,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
      error: "Job exceeded 300s limit",
    };
    render(<WorkflowCard card={card} />);

    expect(screen.getByText("Execution Timed Out")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring Paused")).toBeNull();
  });

  test("confirm button is disabled when confirming=true (no double-submit)", () => {
    const card = {
      key: "action:a1",
      status: CARD_STATUS.AWAITING_CONFIRMATION,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
      actionId: "a1",
      confirming: true,
    };
    render(<WorkflowCard card={card} onConfirm={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Run Optimizer/i })).toBeDisabled();
  });

  test("Open button calls onNavigate with correct tab", () => {
    const onNavigate = jest.fn();
    const card = {
      key: "call:tc1",
      status: CARD_STATUS.COMPLETED,
      toolName: "run_optimizer",
      title: "Run Optimizer",
      arguments: {},
      result: {},
    };
    render(<WorkflowCard card={card} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Open Optimizer/i }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ tab: "optimizer" }));
  });
});

// ── AssistantRunSummary ───────────────────────────────────────────────────────

describe("AssistantRunSummary", () => {
  test("shows empty state when no context", () => {
    render(<AssistantRunSummary contextOverrides={{}} cards={{}} />);
    expect(screen.getByText(/No active run/i)).toBeInTheDocument();
  });

  test("shows Optimizer label and strategy when optimizer_session_id present", () => {
    const ctx = { optimizer_session_id: "opt-123", strategy_name: "TestStrat" };
    render(<AssistantRunSummary contextOverrides={ctx} cards={{}} onNavigate={jest.fn()} />);

    expect(screen.getByText("Optimizer")).toBeInTheDocument();
    expect(screen.getByText("TestStrat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Optimizer/i })).toBeInTheDocument();
  });

  test("shows live optimizer progress from workflow card", () => {
    const ctx = { optimizer_session_id: "opt-123", strategy_name: "TestStrat" };
    const cards = {
      "action:a1": {
        toolName: "run_optimizer",
        status: CARD_STATUS.RUNNING,
        progress: { completed_trials: 24, total_trials: 50, best_trial_number: 17 },
      },
    };
    render(<AssistantRunSummary contextOverrides={ctx} cards={cards} onNavigate={jest.fn()} />);

    expect(screen.getByText("24 / 50 trials")).toBeInTheDocument();
    // best_trial_number is split across elements; check each part
    expect(screen.getByText("#17")).toBeInTheDocument();
  });

  test("shows Backtest label when backtest_run_id in context", () => {
    const ctx = { backtest_run_id: "bt-abc", strategy_name: "AnotherStrat" };
    render(<AssistantRunSummary contextOverrides={ctx} cards={{}} onNavigate={jest.fn()} />);

    expect(screen.getByText("Backtest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Results/i })).toBeInTheDocument();
  });

  test("navigator is called with correct tab id", () => {
    const onNavigate = jest.fn();
    const ctx = { optimizer_session_id: "opt-123" };
    render(<AssistantRunSummary contextOverrides={ctx} cards={{}} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: /Open Optimizer/i }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ tab: "optimizer", optimizer_session_id: "opt-123" }));
  });
});

// ── AssistantRunHistory ───────────────────────────────────────────────────────

describe("AssistantRunHistory", () => {
  afterEach(() => jest.restoreAllMocks());

  test("shows placeholder when sessionId is null", () => {
    render(<AssistantRunHistory sessionId={null} />);
    expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
  });

  test("loads and renders tool_runs (most recent first)", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      makeJsonResponse({
        session_id: "sess-1",
        messages: [],
        tool_runs: [
          {
            tool_run_id: "tr-1",
            tool_name: "run_optimizer",
            status: "completed",
            started_at: new Date(Date.now() - 60000).toISOString(),
            arguments: { strategy_name: "Alpha" },
          },
          {
            tool_run_id: "tr-2",
            tool_name: "run_backtest",
            status: "failed",
            error: "Freqtrade error",
            started_at: new Date(Date.now() - 120000).toISOString(),
            arguments: {},
          },
        ],
      })
    );

    render(<AssistantRunHistory sessionId="sess-1" onNavigate={jest.fn()} />);
    expect(screen.getByText(/Loading history/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Optimizer")).toBeInTheDocument();
    });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Backtest")).toBeInTheDocument();
  });

  test("shows empty state when tool_runs array is empty", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      makeJsonResponse({ session_id: "sess-1", messages: [], tool_runs: [] })
    );
    render(<AssistantRunHistory sessionId="sess-1" />);
    await waitFor(() => {
      expect(screen.getByText(/No workflow runs/i)).toBeInTheDocument();
    });
  });

  test("shows error state on HTTP failure", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(makeJsonResponse({}, 404));
    render(<AssistantRunHistory sessionId="sess-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Error loading history/i)).toBeInTheDocument();
    });
  });

  test("Open button calls onNavigate with correct destination", async () => {
    const onNavigate = jest.fn();
    global.fetch = jest.fn().mockResolvedValueOnce(
      makeJsonResponse({
        session_id: "sess-1",
        messages: [],
        tool_runs: [
          {
            tool_run_id: "tr-1",
            tool_name: "run_optimizer",
            status: "completed",
            started_at: new Date().toISOString(),
            arguments: {},
          },
        ],
      })
    );
    render(<AssistantRunHistory sessionId="sess-1" onNavigate={onNavigate} />);
    await waitFor(() => screen.getByRole("button", { name: /Open/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open/i }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ tab: "optimizer" }));
  });
});

// ── MiniAIAssistantContainer integration ─────────────────────────────────────

describe("MiniAIAssistantContainer - Chat tab basics", () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse({}));
  });
  afterEach(() => jest.restoreAllMocks());

  test("renders chat tab by default with composer", () => {
    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    expect(screen.getByPlaceholderText(/Type a message/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send/i })).toBeInTheDocument();
  });

  test("Send button is disabled when input is empty", () => {
    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    expect(screen.getByRole("button", { name: /Send/i })).toBeDisabled();
  });

  test("tab navigation renders Chat, Run, and History tabs", () => {
    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  test("switching to Run tab shows empty state when no context", () => {
    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByText(/No active run/i)).toBeInTheDocument();
  });

  test("switching to History tab shows placeholder when no session stored", () => {
    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
  });

  test("Run tab shows optimizer context when contextOverrides has optimizer_session_id", () => {
    render(
      <MiniAIAssistantContainer
        contextOverrides={{ optimizer_session_id: "opt-xyz", strategy_name: "Beta" }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByText("Optimizer")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});

describe("MiniAIAssistantContainer - streaming", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  test("normal chat streaming: token events produce a single final assistant message", async () => {
    const streamEvents = [
      { type: "meta",  data: { session_id: "sess-abc" } },
      { type: "token", data: { content: "Hello " } },
      { type: "token", data: { content: "world" } },
      { type: "done",  data: { session_id: "sess-abc", message: { content: "Hello world" }, available_actions: [] } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("hi")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Hello world")).toBeInTheDocument());

    // Single assistant message — not duplicated
    expect(screen.queryAllByText("Hello world").length).toBe(1);
  });

  test("workflow card appears on tool_confirmation_required event", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-abc" } },
      { type: "token", data: { content: "I'll run the optimizer." } },
      {
        type: "tool_confirmation_required",
        data: {
          tool_name: "run_optimizer",
          action_id: "action-x",
          arguments: { strategy_name: "TestStrat" },
          confirmation_endpoint: "/api/ai/actions/confirm",
          confirmation_action_type: "confirm_tool_action",
          confirmation_payload: { action_id: "action-x" },
        },
      },
      { type: "done", data: { session_id: "sess-abc", message: { content: "I'll run the optimizer." }, available_actions: [] } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "run optimizer" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => {
      expect(screen.getByText("Awaiting Confirmation")).toBeInTheDocument();
    });
    // Card confirm button visible
    expect(screen.getAllByRole("button", { name: /Run Optimizer/i }).length).toBeGreaterThan(0);
  });

  test("clicking confirm button sends confirmation request — one click only, no dialog", async () => {
    const firstFetch = makeStream([
      { type: "meta", data: { session_id: "sess-abc" } },
      {
        type: "tool_confirmation_required",
        data: {
          tool_name: "run_optimizer",
          action_id: "action-x",
          arguments: {},
          confirmation_endpoint: "/api/ai/actions/confirm",
          confirmation_action_type: "confirm_tool_action",
          confirmation_payload: { action_id: "action-x" },
        },
      },
      { type: "done", data: { session_id: "sess-abc", message: { content: "" }, available_actions: [] } },
    ]);
    const confirmFetch = makeStream([
      { type: "tool_started", data: { tool_name: "run_optimizer", action_id: "action-x" } },
      { type: "tool_result",  data: { tool_name: "run_optimizer", action_id: "action-x", result: { status: "completed" } } },
      { type: "done", data: { session_id: "sess-abc", message: { content: "Optimizer done!" }, available_actions: [] } },
    ]);

    global.fetch = jest.fn()
      .mockResolvedValueOnce(firstFetch)    // chat/stream
      .mockResolvedValueOnce(makeJsonResponse({ session_id: "sess-abc", messages: [], tool_runs: [], pending_actions: [] })) // session restore (triggered by meta)
      .mockResolvedValueOnce(confirmFetch); // actions/confirm

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => screen.getByText("Awaiting Confirmation"));

    const confirmBtn = screen.getAllByRole("button", { name: /Run Optimizer/i })[0];
    fireEvent.click(confirmBtn);

    // Verify confirmation POST was sent
    await waitFor(() => {
      const calls = global.fetch.mock.calls;
      const confirmCall = calls.find(([url]) => String(url).includes("/api/ai/actions/confirm"));
      expect(confirmCall).toBeTruthy();
      const body = JSON.parse(confirmCall[1].body);
      expect(body.action_type).toBe("confirm_tool_action");
      expect(body.payload.action_id).toBe("action-x");
    });

    await waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());
    expect(screen.queryByText("Failed")).toBeNull();
  });

  test("failed workflow shows Failed, not Completed", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-abc" } },
      {
        type: "tool_confirmation_required",
        data: {
          tool_name: "run_optimizer",
          action_id: "action-x",
          arguments: {},
          confirmation_endpoint: "/api/ai/actions/confirm",
          confirmation_action_type: "confirm_tool_action",
          confirmation_payload: { action_id: "action-x" },
        },
      },
      { type: "done", data: { session_id: "sess-abc", message: { content: "" }, available_actions: [] } },
    ];
    const confirmStream = makeStream([
      { type: "tool_started", data: { tool_name: "run_optimizer", action_id: "action-x" } },
      { type: "tool_failed", data: { tool_name: "run_optimizer", action_id: "action-x", error: "Freqtrade crashed" } },
    ]);
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream(streamEvents))
      .mockResolvedValueOnce(makeJsonResponse({ session_id: "sess-abc", messages: [], tool_runs: [], pending_actions: [] }))
      .mockResolvedValueOnce(confirmStream);

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => screen.getByText("Awaiting Confirmation"));
    fireEvent.click(screen.getAllByRole("button", { name: /Run Optimizer/i })[0]);

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
    expect(screen.getByText("Freqtrade crashed")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  test("observation_timeout → Monitoring Paused (not Failed, not Completed)", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-abc" } },
      { type: "tool_started",       data: { tool_name: "run_optimizer", tool_call_id: "tc1" } },
      { type: "job_active",         data: { tool_name: "run_optimizer", tool_call_id: "tc1", status: "running" } },
      { type: "observation_timeout", data: { tool_name: "run_optimizer", api_session_id: "tc1" } },
      { type: "done", data: { session_id: "sess-abc", message: { content: "Monitoring stopped." }, available_actions: [] } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Monitoring Paused")).toBeInTheDocument());
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.queryByText("Failed")).toBeNull();
  });

  test("execution_timed_out is distinct from observation_paused", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-abc" } },
      { type: "tool_started",   data: { tool_name: "run_optimizer", tool_call_id: "tc1" } },
      { type: "tool_timed_out", data: { tool_name: "run_optimizer", tool_call_id: "tc1", error: "Job exceeded 300s" } },
      { type: "done", data: { session_id: "sess-abc", message: { content: "Timed out." }, available_actions: [] } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Execution Timed Out")).toBeInTheDocument());
    expect(screen.queryByText("Monitoring Paused")).toBeNull();
  });
});

// ── Session restore ───────────────────────────────────────────────────────────

describe("Session restore", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  test("restores messages from persisted session without duplicating them", async () => {
    sessionStorage.setItem("mini_assistant_session_id", "sess-restore");

    const persistedSession = {
      session_id: "sess-restore",
      messages: [
        { id: "m1", role: "user",      content: "Hello from past" },
        { id: "m2", role: "assistant", content: "Past response"   },
      ],
      tool_runs: [],
      pending_actions: [],
    };
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse(persistedSession));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    await waitFor(() => expect(screen.getByText("Hello from past")).toBeInTheDocument());
    expect(screen.getByText("Past response")).toBeInTheDocument();

    // No duplicate messages
    expect(screen.queryAllByText("Hello from past").length).toBe(1);
    expect(screen.queryAllByText("Past response").length).toBe(1);
  });

  test("restores pending action card — does not auto-confirm it", async () => {
    sessionStorage.setItem("mini_assistant_session_id", "sess-restore");

    const persistedSession = {
      session_id: "sess-restore",
      messages: [],
      tool_runs: [],
      pending_actions: [
        {
          action_id: "pending-a1",
          tool_name: "run_optimizer",
          arguments: { strategy_name: "Alpha" },
          status: "awaiting_confirmation",
        },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse(persistedSession));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    await waitFor(() => expect(screen.getByText("Awaiting Confirmation")).toBeInTheDocument());

    // Must not have auto-confirmed
    const confirmCalls = global.fetch.mock.calls.filter(
      ([url]) => String(url).includes("/api/ai/actions/confirm")
    );
    expect(confirmCalls.length).toBe(0);
  });

  test("restores completed tool run card — does not replay it", async () => {
    sessionStorage.setItem("mini_assistant_session_id", "sess-restore");

    const persistedSession = {
      session_id: "sess-restore",
      messages: [],
      tool_runs: [
        {
          tool_run_id: "tr1",
          tool_call_id: "tc1",
          tool_name: "run_optimizer",
          status: "completed",
          result_summary: { status: "completed" },
        },
      ],
      pending_actions: [],
    };
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse(persistedSession));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);

    await waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());

    // Must not have sent confirm
    const confirmCalls = global.fetch.mock.calls.filter(
      ([url]) => String(url).includes("/api/ai/actions/confirm")
    );
    expect(confirmCalls.length).toBe(0);
  });
});
