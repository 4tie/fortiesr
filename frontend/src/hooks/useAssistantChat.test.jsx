import { act, renderHook, waitFor } from "@testing-library/react";
import { useAssistantChat } from "./useAssistantChat.js";

function streamResponse(events) {
  const encoder = new TextEncoder();
  const chunks = events.map(({ type, data }) => encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
  return {
    ok: true,
    body: {
      getReader() {
        let index = 0;
        return {
          read: jest.fn(() => Promise.resolve(
            index < chunks.length
              ? { value: chunks[index++], done: false }
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
});
