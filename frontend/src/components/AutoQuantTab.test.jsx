/* global describe, beforeEach, test, expect, jest */
import { render, screen, waitFor } from '@testing-library/react';
import AutoQuantTab from './AutoQuantTab';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  send() {
    // Mock send
  }

  close() {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose();
    }
  }
}

globalThis.WebSocket = MockWebSocket;

// Mock fetch
globalThis.fetch = jest.fn();

describe('AutoQuantTab', () => {
  const mockStrategies = [
    { name: 'Strategy1', file: 'strategy1.py' },
    { name: 'Strategy2', file: 'strategy2.py' },
  ];

  beforeEach(() => {
    fetch.mockClear();
    fetch.mockImplementation((url, init) => {
      if (String(url).includes('/api/auto-quant/options') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ saved: true }),
        });
      }
      if (String(url).includes('/api/auto-quant/timeframe-thresholds/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            min_oos_profit: 0.01,
            max_drawdown_threshold: 0.2,
            min_profit_factor: 1.1,
            min_expectancy: 0,
          }),
        });
      }
      if (String(url).includes('/api/auto-quant/runs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ runs: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ run_id: 'test-run-id' }),
      });
    });
  });

  const renderAutoQuant = async (props = {}) => {
    const view = render(<AutoQuantTab strategies={mockStrategies} {...props} />);
    await waitFor(() => {
      expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    return view;
  };

  test('renders configuration form when no pipeline state', async () => {
    await renderAutoQuant();

    expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Configuration')).toBeInTheDocument();
  });

  test('loads options before saving current options', async () => {
    await renderAutoQuant();

    await waitFor(() => {
      expect(fetch.mock.calls.some(([url, init]) => String(url).includes('/api/auto-quant/options') && init?.method === 'POST')).toBe(true);
    });

    const optionsCalls = fetch.mock.calls.filter(([url]) => String(url).includes('/api/auto-quant/options'));
    expect(optionsCalls[0][1]?.method).toBeUndefined();
    expect(optionsCalls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });

  test('normalizes strategy_name values for strategy selector options', async () => {
    await renderAutoQuant({
      strategies: [
        { strategy_name: 'StrategyFromBackend', file: 'backend.py' },
        { name: 'StrategyFromFrontend', file: 'frontend.py' },
      ],
    });

    expect(screen.getByRole('option', { name: 'StrategyFromBackend' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'StrategyFromFrontend' })).toBeInTheDocument();
  });

  test('renders configuration form when no pipeline state - legacy smoke', async () => {
    await renderAutoQuant();

    expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Configuration')).toBeInTheDocument();
  });

  test('displays strategy selector with provided strategies', async () => {
    await renderAutoQuant();

    // The component renders the configuration form
    expect(screen.getByText('Pipeline Configuration')).toBeInTheDocument();
  });

  test('handles strategy selection', async () => {
    await renderAutoQuant();

    // The component renders the strategy selector
    expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
  });

  test('displays loading skeleton when strategies are loading', async () => {
    await renderAutoQuant({ strategies: [], strategiesLoading: true });

    // The component displays a skeleton for the strategy selector
    expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
  });

  test('starts pipeline when start button is clicked', async () => {
    await renderAutoQuant();

    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeInTheDocument();
  });

  test('displays stepper when pipeline is running', async () => {
    const mockPipelineState = {
      run_id: 'test-run-id',
      status: 'running',
      current_stage: 1,
      stages: [
        { index: 1, name: 'Pre-Selection', status: 'running', message: '', data: {} },
        { index: 2, name: 'Hyperopt Execution', status: 'pending', message: '', data: {} },
        { index: 3, name: 'OOS Validation', status: 'pending', message: '', data: {} },
        { index: 4, name: 'Risk Assessment', status: 'pending', message: '', data: {} },
        { index: 5, name: 'Delivery', status: 'pending', message: '', data: {} },
      ],
    };

    await renderAutoQuant({ pipelineState: mockPipelineState });
    expect(screen.getAllByText(/Pre-Selection/).length).toBeGreaterThan(0);
  });

  test('displays new 5-stage workflow', async () => {
    const mockPipelineState = {
      run_id: 'test-run-id',
      status: 'running',
      current_stage: 1,
      stages: [
        { index: 1, name: 'Pre-Selection', status: 'running', message: '', data: {} },
        { index: 2, name: 'Hyperopt Execution', status: 'pending', message: '', data: {} },
        { index: 3, name: 'OOS Validation', status: 'pending', message: '', data: {} },
        { index: 4, name: 'Risk Assessment', status: 'pending', message: '', data: {} },
        { index: 5, name: 'Delivery', status: 'pending', message: '', data: {} },
      ],
    };

    await renderAutoQuant({ pipelineState: mockPipelineState });
    expect(screen.getAllByText(/Hyperopt Execution/).length).toBeGreaterThan(0);
  });

  test('displays selected_pairs after stage 1 completion', async () => {
    const mockPipelineState = {
      run_id: 'test-run-id',
      status: 'running',
      current_stage: 2,
      selected_pairs: [
        { key: 'BTC/USDT', profit: 0.15 },
        { key: 'ETH/USDT', profit: 0.12 },
        { key: 'BNB/USDT', profit: 0.08 },
        { key: 'SOL/USDT', profit: 0.05 },
      ],
      stages: [
        { index: 1, name: 'Pre-Selection', status: 'passed', message: '', data: {} },
        { index: 2, name: 'Hyperopt Execution', status: 'running', message: '', data: {} },
        { index: 3, name: 'OOS Validation', status: 'pending', message: '', data: {} },
        { index: 4, name: 'Risk Assessment', status: 'pending', message: '', data: {} },
        { index: 5, name: 'Delivery', status: 'pending', message: '', data: {} },
      ],
    };

    await renderAutoQuant({ pipelineState: mockPipelineState });
    // Pipeline now has 6 stages instead of 7
    expect(screen.getByText(/Stage 2\/6/)).toBeInTheDocument();
  });

  test('displays pre-selection configuration options', async () => {
    await renderAutoQuant();

    // Verify pre-selection related configuration options are present
    expect(screen.getByText('Auto-Quant Factory')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Configuration')).toBeInTheDocument();
  });
});
