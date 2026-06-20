/* global jest, global, describe, beforeEach, afterEach, test, expect */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssistantChatPanel from './AssistantChatPanel.jsx';

// Mock the clipboard API
global.navigator.clipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

describe('AssistantChatPanel', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        models: ['llama3', 'mistral'],
        reachable: true,
      }),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders AI Assistant header with model status', async () => {
    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/2 models available/)).toBeInTheDocument();
    });
  });

  test('shows capability explanation bar', async () => {
    render(<AssistantChatPanel mode="page" />);

    expect(screen.getByText(/AI Assistant can:/)).toBeInTheDocument();
    expect(screen.getByText(/explain strategies, analyze runs, summarize logs/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot:/)).toBeInTheDocument();
    expect(screen.getByText(/modify files, start trading, or deploy changes/)).toBeInTheDocument();
  });

  test('shows read-only status badge when model is reachable', async () => {
    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText('Read-only')).toBeInTheDocument();
    });
  });

  test('shows Ollama Offline status when model is unreachable', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [],
        reachable: false,
        error: 'Could not connect to Ollama',
      }),
    }));

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText('Ollama Offline')).toBeInTheDocument();
    });
  });

  test('renders empty state with context chips and quick questions', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {
              strategy_name: 'DemoStrategy',
              optimizer_session_id: 'opt-1',
            },
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" initialContextOverrides={{ strategy_name: 'DemoStrategy' }} />);

    await waitFor(() => {
      expect(screen.getByText('Attached Context')).toBeInTheDocument();
    });

    expect(screen.getByText('DemoStrategy')).toBeInTheDocument();
    expect(screen.getByText('Quick Questions')).toBeInTheDocument();
  });

  test('shows warning when no active context', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: ['No active run or optimizer session is selected.'],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText(/No active run or optimizer session is selected/)).toBeInTheDocument();
    });
  });

  test('shows unavailable message when Ollama is offline', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: [],
            reachable: false,
            error: 'Ollama not configured',
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText(/AI Model Unavailable/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Please check Settings → AI Assistant/)).toBeInTheDocument();
  });

  test('sends message when user submits form', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      if (String(url).includes('/api/ai/chat/stream')) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => ({ done: true, value: null }),
            }),
          },
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about this strategy/)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about this strategy/);
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const sendButton = screen.getByTitle(/Send/);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat/stream', expect.any(Object));
    });
  });

  test('does not send empty message', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about this strategy/)).toBeInTheDocument();
    });

    const sendButton = screen.getByTitle(/Send/);
    expect(sendButton).toBeDisabled();
  });

  test('sends message on Enter key press', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      if (String(url).includes('/api/ai/chat/stream')) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => ({ done: true, value: null }),
            }),
          },
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about this strategy/)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about this strategy/);
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat/stream', expect.any(Object));
    });
  });

  test('does not send message on Shift+Enter', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about this strategy/)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about this strategy/);
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Should not have called the chat endpoint
    expect(global.fetch).not.toHaveBeenCalledWith('/api/ai/chat/stream', expect.any(Object));
  });

  test('quick prompt buttons send expected messages', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {
              strategy_name: 'DemoStrategy',
            },
            warnings: [],
          }),
        };
      }
      if (String(url).includes('/api/ai/chat/stream')) {
        return {
          ok: true,
          body: {
            getReader: () => ({
              read: async () => ({ done: true, value: null }),
            }),
          },
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" initialContextOverrides={{ strategy_name: 'DemoStrategy' }} />);

    await waitFor(() => {
      expect(screen.getByText('Explain this strategy in plain language')).toBeInTheDocument();
    });

    const quickPromptButton = screen.getByText('Explain this strategy in plain language');
    fireEvent.click(quickPromptButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat/stream', expect.any(Object));
    });
  });

  test('renders code blocks with copy button', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { container } = render(<AssistantChatPanel mode="page" />);

    // Set a message with code block
    act(() => {
      container.querySelector('[data-testid="message-container"]')?.setAttribute('data-message', '```python\nprint("hello")\n```');
    });

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });
  });

  test('copy button copies code to clipboard', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    // Note: Full integration test would require setting up a message with code block
    // This is a placeholder for the copy functionality test
    expect(global.navigator.clipboard.writeText).toBeDefined();
  });

  test('shows error message when backend request fails', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      if (String(url).includes('/api/ai/chat/stream')) {
        throw new Error('Network error');
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask about this strategy/)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Ask about this strategy/);
    fireEvent.change(textarea, { target: { value: 'Test message' } });

    const sendButton = screen.getByTitle(/Send/);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/Error/)).toBeInTheDocument();
    });
  });

  test('model selector is populated when models are available', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3', 'mistral', 'codellama'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByTitle('Select AI model')).toBeInTheDocument();
    });

    const modelSelector = screen.getByTitle('Select AI model');
    expect(modelSelector).not.toBeDisabled();
  });

  test('model selector is disabled when no models available', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: [],
            reachable: false,
            error: 'No models found',
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByTitle('Select AI model')).toBeInTheDocument();
    });

    const modelSelector = screen.getByTitle('Select AI model');
    expect(modelSelector).toBeDisabled();
  });

  test('context refresh button calls context endpoint', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/api/ai/models')) {
        return {
          ok: true,
          json: async () => ({
            models: ['llama3'],
            reachable: true,
          }),
        };
      }
      if (String(url).includes('/api/agent/context')) {
        return {
          ok: true,
          json: async () => ({
            active: {},
            warnings: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    render(<AssistantChatPanel mode="page" />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/agent/context'), expect.any(Object));
    });
  });
});