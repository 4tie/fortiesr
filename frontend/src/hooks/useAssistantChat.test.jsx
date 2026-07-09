import { act, renderHook, waitFor } from "@testing-library/react";
import { useAssistantChat } from "./useAssistantChat.js";

function streamResponse(events) {
  const chunks = events.map(({ type, data }) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  return {
    ok: true,
    body: {
      getReader() {
        let index = 0;
        return {
          read: jest.fn(() => Promise.resolve(
            index < chunks.length
              ? { value: new TextEncoder().encode(chunks[index++]), done: false }
              : { value: undefined, done: true }
          )),
        };
      },
    },
  };
}

describe("useAssistantChat shared stream behavior", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("does not duplicate message followed by identical final content", async () => {
    global.fetch.mockResolvedValueOnce(streamResponse([
      { type: "message", data: { content: "Backtest completed." } },
      { type: "final", data: { content: "Backtest completed." } },
    ]));

    const { result } = renderHook(() => useAssistantChat());
    await act(async () => {
      await result.current.sendMessage("run it");
    });

    const assistant = result.current.messages.find((message) => message.role === "assistant");
    expect(assistant.content).toBe("Backtest completed.");
  });

  test("restored session id is used by the next message", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          messages: [{ id: "m1", role: "assistant", content: "Old answer" }],
          pending_actions: [],
          tool_runs: [],
          active_jobs: [],
        }),
      })
      .mockResolvedValueOnce(streamResponse([{ type: "done", data: { content: "Next answer" } }]));

    const { result } = renderHook(() => useAssistantChat());
    await act(async () => {
      await result.current.restoreSession("session-x");
    });
    await waitFor(() => expect(result.current.sessionId).toBe("session-x"));

    await act(async () => {
      await result.current.sendMessage("continue");
    });

    const [, options] = global.fetch.mock.calls.find(([url]) => url === "/api/ai/chat/stream");
    expect(JSON.parse(options.body).session_id).toBe("session-x");
  });

  test("restores active_jobs as active workflow cards", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        messages: [],
        pending_actions: [],
        tool_runs: [],
        active_jobs: [{
          job_type: "optimizer",
          api_session_id: "api-1",
          optimizer_session_id: "opt-1",
          status: "running",
          progress: { completed_trials: 2, total_trials: 10 },
        }],
      }),
    });

    const { result } = renderHook(() => useAssistantChat());
    await act(async () => {
      await result.current.restoreSession("session-x");
    });

    await waitFor(() => expect(result.current.cardList).toHaveLength(1));
    expect(result.current.cardList[0]).toMatchObject({
      status: "running",
      apiSessionId: "api-1",
      optimizerSessionId: "opt-1",
    });
  });

  test("shared state: Chat receives progress → Run tab immediately shows same progress", async () => {
    global.fetch.mockResolvedValueOnce(streamResponse([
      { type: "meta", data: { session_id: "session-x" } },
      { type: "tool_confirmation_required", data: { action_id: "action-1", tool_name: "run_optimizer", arguments: {} } },
      { type: "tool_started", data: { action_id: "action-1", tool_name: "run_optimizer" } },
      { type: "job_active", data: { tool_name: "run_optimizer", progress: { completed_trials: 5, total_trials: 10 } } },
    ]));

    const { result } = renderHook(() => useAssistantChat());
    await act(async () => {
      await result.current.sendMessage("run optimizer");
    });

    await waitFor(() => expect(result.current.cardList).toHaveLength(1));
    expect(result.current.cardList[0].progress).toMatchObject({
      completed_trials: 5,
      total_trials: 10,
    });
  });

  test("deep navigation: workflow card carries real IDs for Optimizer, Backtest, AutoQuant", async () => {
    global.fetch.mockResolvedValueOnce(streamResponse([
      { type: "meta", data: { session_id: "session-x" } },
      { type: "tool_confirmation_required", data: { 
        action_id: "action-1", 
        tool_name: "run_optimizer", 
        arguments: {},
        optimizer_session_id: "opt-123",
        api_session_id: "api-456",
      } },
      { type: "tool_result", data: { 
        tool_name: "run_optimizer",
        tool_call_id: "call-1",
        result: { run_id: "run-789" },
      } },
    ]));

    const { result } = renderHook(() => useAssistantChat());
    await act(async () => {
      await result.current.sendMessage("run optimizer");
    });

    await waitFor(() => expect(result.current.cardList).toHaveLength(1));
    const card = result.current.cardList[0];
    expect(card.optimizerSessionId).toBe("opt-123");
    expect(card.apiSessionId).toBe("api-456");
    expect(card.runId).toBe("run-789");
  });
});
