/* global describe, expect, test */
import { buildAgentContext } from "./agentContext.js";

describe("buildAgentContext", () => {
  test("returns neutral context for tabs without scoped agent context", () => {
    expect(buildAgentContext({
      activeTab: "backtest", // Scoped
      activeResult: null,
      agentTabContext: {
        active_panel: "ignored",
        strategy_name: "IgnoredStrategy",
        auto_quant_run_id: "auto-1",
        optimizer_session_id: "optimizer-1",
        optimizer_trial_number: 4,
        backtest_run_id: "backtest-1",
        api_session_id: "api-1",
      },
    })).toEqual({
      active_tab: "backtest",
      active_panel: "ignored",
      strategy_name: "IgnoredStrategy",
      auto_quant_run_id: null,
      optimizer_session_id: null,
      optimizer_trial_number: null,
      backtest_run_id: "backtest-1",
      api_session_id: "api-1",
      candidate_run_id: null,
      stress_session_id: null,
      temporal_stress_session_id: null,
      readiness_profile: null,
      timeframe: null,
      timerange: null,
      start_date: null,
      end_date: null,
      pairs: [],
      dry_run_wallet: null,
      max_open_trades: null,
      backtest_status: null,
      current_stage: null,
      pipeline_status: null,
    });
  });

  test("keeps AutoQuant run context only on the AutoQuant tab", () => {
    expect(buildAgentContext({
      activeTab: "auto-quant",
      agentTabContext: {
        active_panel: "stage-2",
        strategy_name: "AutoQuantStrategy",
        auto_quant_run_id: "auto-run-1",
        optimizer_session_id: "optimizer-session-1",
      },
    })).toEqual({
      active_tab: "auto-quant",
      active_panel: "stage-2",
      strategy_name: "AutoQuantStrategy",
      auto_quant_run_id: "auto-run-1",
      optimizer_session_id: null,
      optimizer_trial_number: null,
      backtest_run_id: null,
      api_session_id: null,
      candidate_run_id: null,
      stress_session_id: null,
      temporal_stress_session_id: null,
      readiness_profile: null,
      timeframe: null,
      timerange: null,
      start_date: null,
      end_date: null,
      pairs: [],
      dry_run_wallet: null,
      max_open_trades: null,
      backtest_status: null,
      current_stage: null,
      pipeline_status: null,
    });
  });

  test("keeps optimizer session context only on the optimizer tab", () => {
    expect(buildAgentContext({
      activeTab: "optimizer",
      agentTabContext: {
        active_panel: "live",
        strategy_name: "OptimizerStrategy",
        auto_quant_run_id: "auto-run-1",
        optimizer_session_id: "optimizer-session-1",
        optimizer_trial_number: 7,
        api_session_id: "api-session-1",
      },
    })).toEqual({
      active_tab: "optimizer",
      active_panel: "live",
      strategy_name: "OptimizerStrategy",
      auto_quant_run_id: null,
      optimizer_session_id: "optimizer-session-1",
      optimizer_trial_number: 7,
      backtest_run_id: null,
      api_session_id: "api-session-1",
      candidate_run_id: null,
      stress_session_id: null,
      temporal_stress_session_id: null,
      readiness_profile: null,
      timeframe: null,
      timerange: null,
      start_date: null,
      end_date: null,
      pairs: [],
      dry_run_wallet: null,
      max_open_trades: null,
      backtest_status: null,
      current_stage: null,
      pipeline_status: null,
    });
  });

  test("uses active result as the results tab backtest run id", () => {
    expect(buildAgentContext({
      activeTab: "results",
      activeResult: { run_id: "result-run-1" },
      agentTabContext: {
        backtest_run_id: "stale-run",
        strategy_name: "IgnoredStrategy",
      },
    })).toEqual({
      active_tab: "results",
      active_panel: null,
      strategy_name: "IgnoredStrategy",
      auto_quant_run_id: null,
      optimizer_session_id: null,
      optimizer_trial_number: null,
      backtest_run_id: "result-run-1",
      api_session_id: null,
      candidate_run_id: null,
      stress_session_id: null,
      temporal_stress_session_id: null,
      readiness_profile: null,
      timeframe: null,
      timerange: null,
      start_date: null,
      end_date: null,
      pairs: [],
      dry_run_wallet: null,
      max_open_trades: null,
      backtest_status: null,
      current_stage: null,
      pipeline_status: null,
    });
  });

  test("keeps generic scoped context for strategy editor and performance tabs", () => {
    expect(buildAgentContext({
      activeTab: "performance",
      agentTabContext: {
        active_panel: "details",
        strategy_name: "PerformanceStrategy",
        backtest_run_id: "backtest-run-1",
        api_session_id: "api-session-1",
      },
    })).toEqual({
      active_tab: "performance",
      active_panel: "details",
      strategy_name: "PerformanceStrategy",
      auto_quant_run_id: null,
      optimizer_session_id: null,
      optimizer_trial_number: null,
      backtest_run_id: "backtest-run-1",
      api_session_id: "api-session-1",
      candidate_run_id: null,
      stress_session_id: null,
      temporal_stress_session_id: null,
      readiness_profile: null,
      timeframe: null,
      timerange: null,
      start_date: null,
      end_date: null,
      pairs: [],
      dry_run_wallet: null,
      max_open_trades: null,
      backtest_status: null,
      current_stage: null,
      pipeline_status: null,
    });
  });

  test("resets backtest fields when leaving the backtest tab", () => {
    const buildWith = (tab, ctx) => buildAgentContext({
      activeTab: tab,
      activeResult: null,
      agentTabContext: ctx,
    });

    const backtestCtx = {
      active_panel: "live",
      strategy_name: "MyStrategy",
      timeframe: "1h",
      timerange: "20240101-20241231",
      start_date: "2024-01-01",
      end_date: "2024-12-31",
      pairs: ["BTC/USDT"],
      dry_run_wallet: 1000,
      max_open_trades: 3,
      backtest_status: "running",
      backtest_run_id: "backtest-1",
    };

    expect(buildWith("backtest", backtestCtx)).toEqual(
      expect.objectContaining({
        active_tab: "backtest",
        timeframe: "1h",
        timerange: "20240101-20241231",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
        pairs: ["BTC/USDT"],
        dry_run_wallet: 1000,
        max_open_trades: 3,
        backtest_status: "running",
      }),
    );

    expect(buildWith("optimizer", backtestCtx)).toEqual(
      expect.objectContaining({
        active_tab: "optimizer",
        timeframe: null,
        timerange: null,
        start_date: null,
        end_date: null,
        pairs: [],
        dry_run_wallet: null,
        max_open_trades: null,
        backtest_status: null,
      }),
    );

    expect(buildWith("auto-quant", backtestCtx)).toEqual(
      expect.objectContaining({
        active_tab: "auto-quant",
        timeframe: null,
        timerange: null,
        start_date: null,
        end_date: null,
        pairs: [],
        dry_run_wallet: null,
        max_open_trades: null,
        backtest_status: null,
      }),
    );
  });

  test("does not invent default values when backtest fields are missing", () => {
    expect(buildAgentContext({
      activeTab: "backtest",
      activeResult: null,
      agentTabContext: {
        active_panel: "backtest_setup",
        strategy_name: "StrategyWithoutSetup",
        backtest_run_id: "backtest-1",
      },
    })).toEqual(
      expect.objectContaining({
        active_tab: "backtest",
        timeframe: null,
        timerange: null,
        pairs: [],
        dry_run_wallet: null,
        max_open_trades: null,
        backtest_status: null,
      }),
    );
  });
});
