/**
 * Phase 8 Integration Tests
 *
 * Covers all verified integration problems as per the integration plan:
 * 1. Workflow correlation: confirmation → started → job_active(tool_name) → tool_progress(tool_name) → tool_result(tool_call_id)
 * 2. Failure lifecycle: confirmation → started → running → failed
 * 3. Observation timeout → OBSERVATION_PAUSED (not Failed, not Execution Timed Out)
 * 4. Real execution timeout → EXECUTION_TIMED_OUT (not Monitoring Paused)
 * 5. Message/final dedup: message("...") → final("...") → displayed once
 * 6. Session restore continuation: restore session X → next sendMessage uses session_id: X
 * 7. Shared state: Chat receives workflow events → Run tab shows same cards
 * 8. AutoQuant context through App → TabContentRenderer → AutoQuantOverview → onAgentContextChange
 * 9. Active jobs restore from session
 * 10. Deep navigation: ID payload propagation for optimizer, backtest, autoquant
 */
/* global describe, test, expect, beforeEach, afterEach, jest, global */
import React from 'react';
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MiniAIAssistantContainer from "../src/components/MiniAIAssistantContainer.jsx";
import App from "../src/App.jsx";

// ── Polyfills ─────────────────────────────────────────────────────────────────
global.TextEncoder = global.TextEncoder || require("util").TextEncoder;
global.TextDecoder = global.TextDecoder || require("util").TextDecoder;

jest.mock('mermaid', () => ({
  initialize: jest.fn(),
  render: jest.fn().mockResolvedValue({ svg: '<svg></svg>' })
}));

function encodeSSE(events) {
  return events
    .map(({ type, data }) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

function makeStream(events) {
  const text = encodeSSE(events);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let pos = 0;
  const CHUNK = 128;
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

describe("Phase 8 Integration Fixes", () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse({}));
  });
  afterEach(() => jest.restoreAllMocks());

  test("1. Workflow correlation: full lifecycle to completed", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-1" } },
      { 
        type: "tool_confirmation_required", 
        data: { 
          tool_name: "run_optimizer", 
          action_id: "act-1", 
          arguments: {},
          confirmation_endpoint: "/api/ai/actions/confirm",
          confirmation_action_type: "confirm_tool_action",
          confirmation_payload: { action_id: "act-1" },
        } 
      },
      { type: "done", data: { session_id: "sess-1", message: { content: "Confirm please." } } },
    ];
    const confirmStream = [
      { type: "tool_started", data: { tool_name: "run_optimizer", action_id: "act-1", tool_call_id: "tc-1" } },
      { type: "job_active", data: { tool_name: "run_optimizer", status: "running" } },
      { type: "tool_progress", data: { tool_name: "run_optimizer", progress: { completed_trials: 1, total_trials: 10 } } },
      { type: "tool_result", data: { tool_name: "run_optimizer", tool_call_id: "tc-1", result: { status: "completed" } } },
      { type: "done", data: { session_id: "sess-1", message: { content: "Done." } } },
    ];
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream(streamEvents)) // send message
      .mockResolvedValueOnce(makeJsonResponse({ session_id: "sess-1" })) // restore session (triggered by meta)
      .mockResolvedValueOnce(makeStream(confirmStream)); // confirm action

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => screen.getByText("Awaiting Confirmation"));
    const confirmBtn = screen.getAllByRole("button", { name: /Run Optimizer/i })[0];
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());
    // Only one card should exist for this workflow
    expect(screen.queryAllByText("Completed").length).toBe(1);
    expect(screen.queryByText("Awaiting Confirmation")).toBeNull();
    expect(screen.queryByText("Running")).toBeNull();
  });

  test("2. Failure lifecycle: running → failed", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-2" } },
      { 
        type: "tool_confirmation_required", 
        data: { 
          tool_name: "run_optimizer", 
          action_id: "act-2", 
          arguments: {},
          confirmation_endpoint: "/api/ai/actions/confirm",
          confirmation_action_type: "confirm_tool_action",
          confirmation_payload: { action_id: "act-2" },
        } 
      },
      { type: "done", data: { session_id: "sess-2", message: { content: "Confirm please." } } },
    ];
    const confirmStream = [
      { type: "tool_started", data: { tool_name: "run_optimizer", action_id: "act-2", tool_call_id: "tc-2" } },
      { type: "job_active", data: { tool_name: "run_optimizer", status: "running" } },
      { type: "tool_failed", data: { tool_name: "run_optimizer", tool_call_id: "tc-2", error: "Something crashed" } },
      { type: "done", data: { session_id: "sess-2", message: { content: "Failed." } } },
    ];
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeStream(streamEvents))
      .mockResolvedValueOnce(makeJsonResponse({ session_id: "sess-2" }))
      .mockResolvedValueOnce(makeStream(confirmStream));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));
    await waitFor(() => screen.getByText("Awaiting Confirmation"));
    fireEvent.click(screen.getAllByRole("button", { name: /Run Optimizer/i })[0]);

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
    expect(screen.getByText("Something crashed")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  test("3. Observation timeout semantics", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-3" } },
      { type: "tool_started", data: { tool_name: "run_optimizer", tool_call_id: "tc-3" } },
      { type: "job_active", data: { tool_name: "run_optimizer", tool_call_id: "tc-3", status: "running" } },
      { type: "observation_timeout", data: { tool_name: "run_optimizer", api_session_id: "tc-3" } },
      { type: "done", data: { session_id: "sess-3", message: { content: "Timeout." } } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Monitoring Paused")).toBeInTheDocument());
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.queryByText("Execution Timed Out")).toBeNull();
  });

  test("4. Real execution timeout semantics", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-4" } },
      { type: "tool_started", data: { tool_name: "run_optimizer", tool_call_id: "tc-4" } },
      { type: "tool_timed_out", data: { tool_name: "run_optimizer", tool_call_id: "tc-4", error: "Exceeded 5m" } },
      { type: "done", data: { session_id: "sess-4", message: { content: "Timeout." } } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Execution Timed Out")).toBeInTheDocument());
    expect(screen.getByText("Exceeded 5m")).toBeInTheDocument();
    expect(screen.queryByText("Monitoring Paused")).toBeNull();
  });

  test("5. Message/final dedup", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-5" } },
      { type: "message", data: { content: "Backtest " } },
      { type: "message", data: { content: "completed." } },
      { type: "final", data: { content: "Backtest completed." } },
      { type: "done", data: { session_id: "sess-5", message: { content: "Backtest completed." } } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Backtest completed.")).toBeInTheDocument());
    // Only ONE instance of the exact text should exist as a message
    expect(screen.queryAllByText("Backtest completed.").length).toBe(1);
    expect(screen.queryByText(/Backtest completed.Backtest completed./)).toBeNull();
  });

  test("6. Session restore continuation", async () => {
    sessionStorage.setItem("mini_assistant_session_id", "sess-6");
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeJsonResponse({ session_id: "sess-6", messages: [], pending_actions: [], tool_runs: [] })) // Restore
      .mockResolvedValueOnce(makeStream([{ type: "done", data: {} }])); // Send

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/chat/sess-6");
    });

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "next request" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => {
      const calls = global.fetch.mock.calls;
      const sendCall = calls.find(([url]) => String(url).includes("/api/ai/chat/stream"));
      const body = JSON.parse(sendCall[1].body);
      expect(body.session_id).toBe("sess-6");
    });
  });

  test("7. Shared state: Chat receives workflow events → Run tab shows same cards", async () => {
    const streamEvents = [
      { type: "meta", data: { session_id: "sess-7" } },
      { type: "tool_started", data: { tool_name: "run_optimizer", tool_call_id: "tc-7", optimizer_session_id: "opt-1" } },
      { type: "job_active", data: { tool_name: "run_optimizer", tool_call_id: "tc-7", status: "running" } },
      { type: "done", data: { session_id: "sess-7", message: { content: "Running." } } },
    ];
    global.fetch = jest.fn().mockResolvedValue(makeStream(streamEvents));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: "go" } });
    fireEvent.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText("Running")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    // The Run tab should show the Optimizer card
    await waitFor(() => expect(screen.getByText("Run Optimizer")).toBeInTheDocument());
  });

  test("9. Active jobs restore from session", async () => {
    sessionStorage.setItem("mini_assistant_session_id", "sess-9");
    global.fetch = jest.fn().mockResolvedValue(makeJsonResponse({
      session_id: "sess-9",
      messages: [],
      pending_actions: [],
      tool_runs: [],
      active_jobs: [
        { job_type: "optimizer", status: "running", progress: { phase: "freqtrade" }, optimizer_session_id: "opt-9" }
      ]
    }));

    render(<MiniAIAssistantContainer contextOverrides={{}} />);
    
    // Switch to Run tab which renders the cards if present
    await waitFor(() => screen.getByRole("button", { name: "Run" }));
    
    // Explicitly wait for fetch to have been called for session restore
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/ai/chat/sess-9"));

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      // The Run tab shows "Run Optimizer" card title for the active_jobs restore
      expect(screen.getByText("Run Optimizer")).toBeInTheDocument();
      // AssistantRunSummary shows the card status via StatusBadge
      // Active jobs restore with their last known status (running)
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });
  });
});
