"""Tests for candidate evaluation orchestrator."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.models.strategy_spec import StrategySpec
from backend.services.candidate.models import CandidateConfig, CandidateVerdict
from backend.services.execution.backtest_gate import BacktestGateResult
from backend.services.candidate.orchestrator import evaluate_candidate
from backend.services.candidate.run_manager import CandidateRunManager
from backend.services.strategy.strategy_code_writer import SaveResult


def _save_result(errors=None, path=None):
    return SaveResult(
        errors=errors or [],
        path=Path(path) if path else None,
        warnings=[],
    )


@pytest.mark.asyncio
async def test_happy_path_all_gates_pass():
    """Happy path: render -> save -> data quality -> backtest gate all pass."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(
        path="/tmp/ud/strategies/rendered/test_strat/test_strat.py",
    ))
    mock_quality = MagicMock(return_value={
        "passed": True,
        "errors": [],
        "warnings": [],
        "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_123",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))

    spec = StrategySpec(
        name="test_strat",
        trading_style="trend_following",
        timeframe="1h",
    )
    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="1h",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/user_data",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "individual_pair_sweep"
    assert len(verdict.gate_results) == 5

    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["render_strategy"].passed is True
    assert gates["save_working_copy"].passed is True
    assert gates["data_quality"].passed is True
    assert gates["backtest_gate"].passed is True
    assert gates["individual_pair_sweep"].passed is False

    mock_render.assert_called_once_with(spec)
    mock_save.assert_called_once()
    mock_quality.assert_called_once()
    mock_backtest.assert_called_once()


@pytest.mark.asyncio
async def test_progress_sink_updates_gate_snapshots():
    """Progress sink updates Candidate run gates without real backtests."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True,
        "errors": [],
        "warnings": [],
        "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_123",
        metrics={"total_trades": 20, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))

    spec = StrategySpec(
        name="progress_strat",
        trading_style="trend_following",
        timeframe="1h",
    )
    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="1h",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/user_data",
    )
    manager = CandidateRunManager()
    run = manager.create_run(spec, config)
    manager.mark_running(run.run_id)

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    }, progress_sink=lambda update: manager.update_gate(run.run_id, update))
    manager.mark_completed(run.run_id, verdict)

    snapshot = manager.get_run(run.run_id)
    assert snapshot is not None
    assert snapshot.status == "completed"
    gates = {gate.gate_name: gate for gate in snapshot.gates}
    assert gates["render_strategy"].status == "passed"
    assert gates["save_working_copy"].status == "passed"
    assert gates["data_quality"].status == "passed"
    assert gates["backtest_gate"].status == "passed"
    assert gates["backtest_gate"].metrics["profit_factor"] == 1.2
    assert gates["individual_pair_sweep"].status == "failed"
    assert gates["portfolio_backtest"].status == "skipped"


@pytest.mark.asyncio
async def test_render_failure_early_exit():
    """Render failure returns early with render_strategy gate failed."""
    mock_render = MagicMock(return_value={
        "source": None,
        "errors": ["Invalid trading_style: unknown"],
        "warnings": [],
        "template": None,
    })

    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="1h",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(
        name="test",
        trading_style="trend_following",
        timeframe="1h",
    )

    verdict = await evaluate_candidate(
        spec, config,
        deps={"render_strategy": mock_render},
    )

    assert verdict.passed is False
    assert verdict.failure_reason == "render_strategy"
    assert len(verdict.gate_results) == 1
    assert verdict.gate_results[0].gate_name == "render_strategy"
    assert verdict.gate_results[0].passed is False
    mock_render.assert_called_once_with(spec)


@pytest.mark.asyncio
async def test_save_failure_early_exit():
    """Save failure returns early with save_working_copy gate failed."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(errors=["Write failed"]))

    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="1h",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(
        name="test",
        trading_style="trend_following",
        timeframe="1h",
    )

    verdict = await evaluate_candidate(
        spec, config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
        },
    )

    assert verdict.passed is False
    assert verdict.failure_reason == "save_working_copy"
    assert len(verdict.gate_results) == 2
    assert verdict.gate_results[0].gate_name == "render_strategy"
    assert verdict.gate_results[0].passed is True
    assert verdict.gate_results[1].gate_name == "save_working_copy"
    assert verdict.gate_results[1].passed is False
    mock_render.assert_called_once_with(spec)
    mock_save.assert_called_once()


@pytest.mark.asyncio
async def test_data_quality_failure_early_exit():
    """Data quality failure returns early with data_quality gate failed."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(
        path="/tmp/some/path.py",
    ))
    mock_quality = MagicMock(return_value={
        "passed": False,
        "errors": ["MISSING_DATA_FILE: BTC/USDT"],
        "warnings": [],
        "details": {
            "BTC/USDT": {
                "exists": False,
                "data_file": "/tmp/ud/data/binance/BTC_USDT-1h.feather",
            },
        },
    })
    mock_backtest = MagicMock()

    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="1h",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(
        name="test",
        trading_style="trend_following",
        timeframe="1h",
    )

    verdict = await evaluate_candidate(
        spec, config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
            "check_data_quality": mock_quality,
            "run_backtest_gate": mock_backtest,
        },
    )

    assert verdict.passed is False
    assert verdict.failure_reason == "data_quality"
    assert len(verdict.gate_results) == 3
    assert verdict.gate_results[0].gate_name == "render_strategy"
    assert verdict.gate_results[0].passed is True
    assert verdict.gate_results[1].gate_name == "save_working_copy"
    assert verdict.gate_results[1].passed is True
    assert verdict.gate_results[2].gate_name == "data_quality"
    assert verdict.gate_results[2].passed is False
    assert verdict.gate_results[2].details["missing_pairs"] == ["BTC/USDT"]
    assert verdict.gate_results[2].details["timeframe"] == "1h"
    assert "freqtrade download-data" in verdict.gate_results[2].details["download_command_hint"]
    mock_render.assert_called_once_with(spec)
    mock_save.assert_called_once()
    mock_quality.assert_called_once()
    mock_backtest.assert_not_called()


@pytest.mark.asyncio
async def test_data_quality_insufficient_history_downloads_and_retries_before_backtest():
    """Insufficient data triggers one download, retries data quality, then backtests."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/some/path.py"))
    initial_quality_failure = {
        "passed": False,
        "errors": ["INSUFFICIENT_HISTORY: BTC/USDT - data ends at 20240331, required 20240401"],
        "warnings": [],
        "details": {
            "BTC/USDT": {
                "exists": True,
                "covers_timerange": False,
                "start_date": "20240101",
                "end_date": "20240331",
                "data_file": "/tmp/ud/data/binance/BTC_USDT-5m.feather",
            },
        },
    }
    passing_quality = {
        "passed": True,
        "errors": [],
        "warnings": [],
        "details": {
            "BTC/USDT": {
                "exists": True,
                "covers_timerange": True,
                "start_date": "20240101",
                "end_date": "20240401",
            },
        },
    }
    mock_quality = MagicMock(side_effect=[initial_quality_failure, passing_quality])
    mock_download = MagicMock(return_value="download_123")
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_123",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[],
        errors=[],
        warnings=[],
    ))

    config = CandidateConfig(
        timerange="20240101-20240401",
        timeframe="5m",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(name="test", trading_style="trend_following", timeframe="5m")

    verdict = await evaluate_candidate(
        spec,
        config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
            "check_data_quality": mock_quality,
            "run_data_download": mock_download,
            "run_backtest_gate": mock_backtest,
        },
    )

    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["data_download"].passed is True
    assert gates["data_download"].details["download_id"] == "download_123"
    assert gates["data_download"].details["prepend"] is False
    assert gates["data_quality"].passed is True
    assert gates["backtest_gate"].passed is True
    assert verdict.failure_reason == "individual_pair_sweep"
    assert mock_quality.call_count == 2
    mock_download.assert_called_once()
    download_request = mock_download.call_args.args[0]
    assert download_request.config_file == "config.json"
    assert download_request.timerange == "20240101-20240401"
    assert download_request.timeframes == ["5m"]
    assert download_request.pairs == ["BTC/USDT"]
    assert download_request.prepend is False
    mock_backtest.assert_called_once()


@pytest.mark.asyncio
async def test_data_quality_start_gap_download_uses_prepend():
    """When data starts after the requested start, auto-download uses prepend."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/some/path.py"))
    mock_quality = MagicMock(side_effect=[
        {
            "passed": False,
            "errors": [
                "INSUFFICIENT_HISTORY: BTC/USDT - data starts at 20240103, required 20240101",
            ],
            "warnings": [],
            "details": {
                "BTC/USDT": {
                    "exists": True,
                    "covers_timerange": False,
                    "start_date": "20240103",
                    "end_date": "20240401",
                },
            },
        },
        {
            "passed": True,
            "errors": [],
            "warnings": [],
            "details": {},
        },
    ])
    mock_download = MagicMock(return_value="download_123")
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_123",
        metrics={"total_trades": 20, "profit_factor": 1.2},
        failures=[],
        errors=[],
        warnings=[],
    ))

    config = CandidateConfig(
        timerange="20240101-20240401",
        timeframe="5m",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(name="test", trading_style="trend_following", timeframe="5m")

    await evaluate_candidate(
        spec,
        config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
            "check_data_quality": mock_quality,
            "run_data_download": mock_download,
            "run_backtest_gate": mock_backtest,
        },
    )

    download_request = mock_download.call_args.args[0]
    assert download_request.prepend is True


@pytest.mark.asyncio
async def test_data_download_failure_stops_before_backtest():
    """A failed auto-download marks data_download failed and does not backtest."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/some/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": False,
        "errors": ["MISSING_DATA_FILE: BTC/USDT - file does not exist"],
        "warnings": [],
        "details": {
            "BTC/USDT": {
                "exists": False,
                "data_file": "/tmp/ud/data/binance/BTC_USDT-5m.feather",
            },
        },
    })
    mock_download = MagicMock(side_effect=RuntimeError("download failed"))
    mock_backtest = MagicMock()

    config = CandidateConfig(
        timerange="20240101-20240401",
        timeframe="5m",
        pairs=["BTC/USDT"],
        user_data_dir="/tmp/ud",
    )
    spec = StrategySpec(name="test", trading_style="trend_following", timeframe="5m")

    verdict = await evaluate_candidate(
        spec,
        config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
            "check_data_quality": mock_quality,
            "run_data_download": mock_download,
            "run_backtest_gate": mock_backtest,
        },
    )

    gates = {g.gate_name: g for g in verdict.gate_results}
    assert verdict.passed is False
    assert verdict.failure_reason == "data_download"
    assert gates["data_download"].passed is False
    assert gates["data_download"].details["error"] == "download failed"
    assert "freqtrade download-data" in gates["data_download"].details["download_command_hint"]
    mock_download.assert_called_once()
    mock_backtest.assert_not_called()


@pytest.mark.asyncio
async def test_injected_deps_prevent_real_calls():
    """When deps are injected, mocks are called instead of real helpers — full pipeline."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [],
        "warnings": [],
        "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(
        path="/tmp/path.py",
    ))
    mock_quality = MagicMock(return_value={
        "passed": True,
        "errors": [],
        "warnings": [],
        "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_123",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "ETH/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "passed",
        "failure_reasons": [],
        "run_id": "portfolio_001",
        "portfolio_summary": {
            "total_trades": 10, "profit_factor": 1.2, "win_rate_pct": 60.0,
            "max_drawdown_pct": 10.0, "sharpe_ratio": 1.0, "expectancy": 0.1,
            "profit_total_pct": 5.0, "profit_total_abs": 50.0,
        },
        "per_pair_metrics": [
            {"pair": "ETH/USDT", "trades": 10, "profit_factor": 2.0, "win_rate_pct": 60.0},
        ],
        "config_used": {"pairs_count": 1, "max_open_trades": 5},
    })
    mock_decision = MagicMock(return_value={
        "verdict": "approved",
        "approved_pairs": ["ETH/USDT"],
        "approved_count": 1,
        "rejection_reason": None,
        "combined_scores": [],
    })

    config = CandidateConfig(
        timerange="20230101-20231231",
        timeframe="5m",
        pairs=["ETH/USDT"],
        user_data_dir="/tmp/user_data",
        exchange="coinbase",
        max_repair_iterations=5,
        risk_profile="low",
    )
    spec = StrategySpec(
        name="mocktest",
        trading_style="momentum",
        timeframe="5m",
        max_open_trades=7,
    )

    verdict = await evaluate_candidate(
        spec, config,
        deps={
            "render_strategy": mock_render,
            "save_rendered_strategy": mock_save,
            "check_data_quality": mock_quality,
            "run_backtest_gate": mock_backtest,
            "run_individual_pair_sweep": mock_pair_sweep,
            "run_portfolio_backtest": mock_portfolio,
            "decide_final_pair_set": mock_decision,
        },
    )

    mock_render.assert_called_once_with(spec)
    mock_save.assert_called_once()
    mock_quality.assert_called_once()
    mock_backtest.assert_called_once()
    mock_pair_sweep.assert_awaited_once()
    mock_portfolio.assert_called_once()
    mock_decision.assert_called_once()
    assert mock_backtest.call_args.kwargs["max_open_trades"] == 7
    assert mock_portfolio.call_args.kwargs["max_open_trades"] == 7
    assert mock_decision.call_args.kwargs["risk_profile"] == "low"
    assert verdict.passed is True
    assert verdict.failure_reason is None
    assert verdict.final_pair_set == ["ETH/USDT"]
    assert verdict.portfolio_metrics["profit_factor"] == 1.2


@pytest.mark.asyncio
async def test_portfolio_backtest_failed_fails():
    """Portfolio backtest failure returns failed verdict with portfolio metrics."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed",
        run_id="gate_001",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "BTC/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "failed",
        "failure_reasons": ["MIN_PROFIT_FACTOR"],
        "portfolio_summary": {
            "total_trades": 5, "profit_factor": 0.8, "win_rate_pct": 30.0,
            "max_drawdown_pct": 25.0,
        },
        "per_pair_metrics": [],
        "config_used": {"pairs_count": 1, "max_open_trades": 5},
    })

    spec = StrategySpec(name="strat_a", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "run_individual_pair_sweep": mock_pair_sweep,
        "run_portfolio_backtest": mock_portfolio,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "portfolio_backtest"
    assert len(verdict.gate_results) == 6
    assert verdict.portfolio_metrics["profit_factor"] == 0.8
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["portfolio_backtest"].passed is False
    mock_pair_sweep.assert_awaited_once()
    mock_portfolio.assert_called_once()


@pytest.mark.asyncio
async def test_backtest_fail_triggers_failure_analyzer():
    """Backtest fail adds failure_analyzer and repair_plan gates."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed",
        run_id="gate_002",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8,
                 "max_drawdown_pct": 35.0, "expectancy": -0.2, "sharpe_ratio": 0.2},
        failures=["MIN_TRADES", "MIN_WIN_RATE"],
        errors=[], warnings=[],
    ))

    spec = StrategySpec(name="strat_b", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    })

    assert verdict.passed is False
    assert len(verdict.gate_results) == 6
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["backtest_gate"].passed is False
    assert gates["failure_analyzer"].passed is False
    assert gates["failure_analyzer"].details["primary_class"] is not None
    assert "repair_plan" in gates
    mock_backtest.assert_called_once()


@pytest.mark.asyncio
async def test_repair_plan_can_repair_true_recorded_not_executed():
    """can_repair=True is recorded in repair_plan gate but repair is not executed."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed",
        run_id="gate_003",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8,
                 "max_drawdown_pct": 35.0, "expectancy": -0.2, "sharpe_ratio": 0.2},
        failures=["MIN_TRADES"],
        errors=[], warnings=[],
    ))

    spec = StrategySpec(name="strat_c", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    })

    gates = {g.gate_name: g for g in verdict.gate_results}
    rp = gates["repair_plan"]
    assert rp.passed is True
    assert rp.details["can_repair"] is True
    assert verdict.passed is False


@pytest.mark.asyncio
async def test_repair_plan_can_repair_false_final_failure():
    """can_repair=False returns final failure with repair_plan gate passed=False."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="backtest_failed",
        run_id="gate_004",
        metrics={},
        failures=[], errors=["Freqtrade exited with code 1"], warnings=[],
    ))

    spec = StrategySpec(name="strat_d", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    })

    assert verdict.passed is False
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["repair_plan"].passed is False
    assert gates["repair_plan"].details["can_repair"] is False
    assert verdict.failure_reason is not None


@pytest.mark.asyncio
async def test_backtest_injected_deps_used():
    """All 6 injected deps override real helpers — no real backtest runs."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed",
        run_id="gate_005",
        metrics={"total_trades": 2},
        failures=["MIN_TRADES"],
        errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))

    spec = StrategySpec(name="strat_e", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair,
    })

    mock_backtest.assert_called_once()
    mock_analyzer.assert_called_once()
    mock_repair.assert_called_once()
    assert verdict.passed is False
    assert verdict.failure_reason == "repair_ai_unavailable"
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["repair_plan"].passed is True
    assert gates["repair_plan"].details["can_repair"] is True


@pytest.mark.asyncio
async def test_repair_loop_success_proceeds_to_pair_workflow():
    """Backtest fails -> repair succeeds -> rerun backtest passes -> pair workflow."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(side_effect=[
        BacktestGateResult(
            gate_status="failed", run_id="gate_001",
            metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8,
                     "max_drawdown_pct": 35.0, "expectancy": -0.2, "sharpe_ratio": 0.2},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
        BacktestGateResult(
            gate_status="passed", run_id="gate_002",
            metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
            failures=[], errors=[], warnings=[],
        ),
    ])
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period to generate more signals",
    })
    new_spec = StrategySpec(
        name="repaired_strat", trading_style="trend_following",
        timeframe="1h", iteration_count=1, max_open_trades=4,
    )
    mock_apply = MagicMock(return_value=(new_spec, []))
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "ETH/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "passed", "failure_reasons": [], "run_id": "portfolio_001",
        "portfolio_summary": {
            "total_trades": 10, "profit_factor": 1.2, "win_rate_pct": 60.0,
            "max_drawdown_pct": 10.0, "sharpe_ratio": 1.0, "expectancy": 0.1,
            "profit_total_pct": 5.0, "profit_total_abs": 50.0,
        },
        "per_pair_metrics": [
            {"pair": "ETH/USDT", "trades": 10, "profit_factor": 2.0, "win_rate_pct": 60.0},
        ],
        "config_used": {"pairs_count": 1, "max_open_trades": 5},
    })
    mock_decision = MagicMock(return_value={
        "verdict": "approved", "approved_pairs": ["ETH/USDT"],
        "approved_count": 1, "rejection_reason": None, "combined_scores": [],
    })

    spec = StrategySpec(name="rep_test", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["ETH/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
        "run_individual_pair_sweep": mock_pair_sweep,
        "run_portfolio_backtest": mock_portfolio,
        "decide_final_pair_set": mock_decision,
    })

    assert verdict.passed is True
    assert verdict.failure_reason is None
    assert len(verdict.repair_attempts) == 1
    assert verdict.repair_attempts[0].outcome == "applied_and_retested"
    assert verdict.repair_attempts[0].scope == "entry_parameter"
    assert verdict.final_pair_set == ["ETH/USDT"]
    assert verdict.portfolio_metrics["profit_factor"] == 1.2

    # Gate dedup: backtest_gate appears only once (the latest passed=True)
    assert len(verdict.gate_results) == 9
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["backtest_gate"].passed is True

    assert mock_render.call_count == 2
    mock_render.assert_any_call(spec)
    mock_render.assert_any_call(new_spec)
    assert mock_save.call_count == 2
    assert mock_quality.call_count == 2
    assert mock_backtest.call_count == 2
    assert mock_backtest.call_args_list[0].kwargs["max_open_trades"] == spec.max_open_trades
    assert mock_backtest.call_args_list[1].kwargs["max_open_trades"] == new_spec.max_open_trades
    mock_ask_ai.assert_awaited_once()
    mock_apply.assert_called_once()
    mock_pair_sweep.assert_awaited_once()
    mock_portfolio.assert_called_once()
    mock_decision.assert_called_once()


@pytest.mark.asyncio
async def test_repair_loop_missing_ollama_client():
    """No ollama_client in deps -> stops with repair_ai_unavailable."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_001",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))

    spec = StrategySpec(name="strat_a", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "repair_ai_unavailable"
    assert len(verdict.repair_attempts) == 0


@pytest.mark.asyncio
async def test_repair_loop_ai_returns_none():
    """AI returns None -> stops with ai_returned_none attempt."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_001",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value=None)

    spec = StrategySpec(name="strat_b", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
    })

    assert verdict.passed is False
    assert len(verdict.repair_attempts) == 1
    assert verdict.repair_attempts[0].outcome == "ai_returned_none"
    assert verdict.repair_attempts[0].scope == "entry_parameter"
    mock_ask_ai.assert_awaited_once()
    mock_render.assert_called_once()  # repair render never called


@pytest.mark.asyncio
async def test_repair_loop_apply_fails():
    """apply_repair_proposal returns errors -> stops with apply_failed attempt."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_001",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period to generate more signals",
    })
    mock_apply = MagicMock(return_value=(None, ["Invalid indicator"]))

    spec = StrategySpec(name="strat_c", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
    })

    assert verdict.passed is False
    assert len(verdict.repair_attempts) == 1
    assert verdict.repair_attempts[0].outcome == "apply_failed"
    assert verdict.repair_attempts[0].change_applied is not None
    mock_ask_ai.assert_awaited_once()
    mock_apply.assert_called_once()
    mock_render.assert_called_once()  # repair render never called


@pytest.mark.asyncio
async def test_repair_loop_rerun_still_fails_loops():
    """Repaired backtest still fails -> re-enters loop -> second attempt succeeds."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(side_effect=[
        BacktestGateResult(
            gate_status="failed", run_id="gate_001",
            metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
        BacktestGateResult(
            gate_status="failed", run_id="gate_002",
            metrics={"total_trades": 8, "win_rate_pct": 35.0, "profit_factor": 0.9},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
        BacktestGateResult(
            gate_status="passed", run_id="gate_003",
            metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
            failures=[], errors=[], warnings=[],
        ),
    ])

    call_count = [0]
    def analyzer_side_effect(result):
        call_count[0] += 1
        cls = "too_few_trades" if call_count[0] <= 2 else "no_trades"
        return MagicMock(
            primary_class=cls,
            next_route="extend_timerange_or_discard",
            failed_metrics=["MIN_TRADES"],
        )
    mock_analyzer = MagicMock(side_effect=analyzer_side_effect)

    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period to generate more signals",
    })
    new_spec_1 = StrategySpec(
        name="rep_1", trading_style="trend_following",
        timeframe="1h", iteration_count=1,
    )
    new_spec_2 = StrategySpec(
        name="rep_2", trading_style="trend_following",
        timeframe="1h", iteration_count=2,
    )
    mock_apply = MagicMock(side_effect=[
        (new_spec_1, []),
        (new_spec_2, []),
    ])
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "ETH/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "passed", "failure_reasons": [], "run_id": "portfolio_001",
        "portfolio_summary": {
            "total_trades": 10, "profit_factor": 1.2, "win_rate_pct": 60.0,
            "max_drawdown_pct": 10.0, "sharpe_ratio": 1.0, "expectancy": 0.1,
            "profit_total_pct": 5.0, "profit_total_abs": 50.0,
        },
        "per_pair_metrics": [],
        "config_used": {"pairs_count": 1, "max_open_trades": 5},
    })
    mock_decision = MagicMock(return_value={
        "verdict": "approved", "approved_pairs": ["ETH/USDT"],
        "approved_count": 1, "rejection_reason": None, "combined_scores": [],
    })

    spec = StrategySpec(name="strat_d", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["ETH/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
        "run_individual_pair_sweep": mock_pair_sweep,
        "run_portfolio_backtest": mock_portfolio,
        "decide_final_pair_set": mock_decision,
    })

    assert verdict.passed is True
    assert len(verdict.repair_attempts) == 2
    assert verdict.repair_attempts[0].outcome == "applied_and_retested"
    assert verdict.repair_attempts[1].outcome == "applied_and_retested"
    assert mock_backtest.call_count == 3
    assert mock_ask_ai.call_count == 2
    assert mock_apply.call_count == 2


@pytest.mark.asyncio
async def test_repair_loop_max_iterations_exhausted():
    """Repair exhausted -> max iterations reached -> final failure."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_fail",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter",
        can_repair=True,
        reason="Mock repair reason",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period to generate more signals",
    })
    def make_spec():
        return StrategySpec(
            name="rep_iter", trading_style="trend_following",
            timeframe="1h", iteration_count=99,
        )
    mock_apply = MagicMock(return_value=(make_spec(), []))

    spec = StrategySpec(name="strat_e", trading_style="trend_following", timeframe="1h",
                        max_iterations=1)
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
        max_repair_iterations=1,
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
    })

    assert verdict.passed is False
    assert len(verdict.repair_attempts) == 1
    assert verdict.repair_attempts[0].outcome == "applied_and_retested"


@pytest.mark.asyncio
async def test_repair_loop_skipped_when_iteration_count_at_max():
    """Repair loop does not start when iteration_count >= max_iterations."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_001",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair = MagicMock(return_value=MagicMock(
        scope="entry_parameter", can_repair=True, reason="Mock",
    ))

    spec = StrategySpec(
        name="strat_exhausted", trading_style="trend_following",
        timeframe="1h", iteration_count=3, max_iterations=3,
    )
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair,
        "ollama_client": MagicMock(),
        "ask_ai_for_repair_proposal": AsyncMock(),
        "apply_repair_proposal": MagicMock(),
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "repair_max_iterations"
    assert len(verdict.repair_attempts) == 0
    # No AI call — loop never entered
    mock_analyzer.assert_called_once()
    mock_repair.assert_called_once()


@pytest.mark.asyncio
async def test_repair_loop_skipped_when_max_repair_iterations_zero():
    """Repair loop does not start when config.max_repair_iterations is 0."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="gate_001",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair = MagicMock(return_value=MagicMock(
        scope="entry_parameter", can_repair=True, reason="Mock",
    ))

    spec = StrategySpec(
        name="strat_zero_repair", trading_style="trend_following", timeframe="1h",
    )
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
        max_repair_iterations=0,
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair,
        "ollama_client": MagicMock(),
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "repair_max_iterations"
    assert len(verdict.repair_attempts) == 0
    mock_analyzer.assert_called_once()
    mock_repair.assert_called_once()


@pytest.mark.asyncio
async def test_repair_loop_can_repair_becomes_false():
    """New repair plan can_repair=False -> stops mid-loop."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(side_effect=[
        BacktestGateResult(
            gate_status="failed", run_id="gate_001",
            metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
        BacktestGateResult(
            gate_status="failed", run_id="gate_002",
            metrics={"total_trades": 3, "win_rate_pct": 25.0, "profit_factor": 0.5},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
    ])
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(side_effect=[
        MagicMock(scope="entry_parameter", can_repair=True, reason="repair"),
        MagicMock(scope="no_repair_possible", can_repair=False, reason="cannot repair"),
    ])
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period",
    })
    new_spec = StrategySpec(
        name="rep_spec", trading_style="trend_following",
        timeframe="1h", iteration_count=1,
    )
    mock_apply = MagicMock(return_value=(new_spec, []))

    spec = StrategySpec(name="strat_f", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
    })

    assert verdict.passed is False
    assert len(verdict.repair_attempts) == 1
    assert verdict.repair_attempts[0].outcome == "applied_and_retested"
    assert mock_repair_plan.call_count == 2
    assert mock_backtest.call_count == 2


@pytest.mark.asyncio
async def test_pair_sweep_no_passed_pairs_fails():
    """Individual pair sweep returns no passed pairs -> failed verdict."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed", run_id="gate_001",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "BTC/USDT", "status": "failed", "score": 0.0, "total_trades": 0,
         "profit_factor": 0.5, "rejection_reason": "Profit factor 0.50 below 1.0"},
    ])

    spec = StrategySpec(name="strat_f", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "run_individual_pair_sweep": mock_pair_sweep,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "individual_pair_sweep"
    assert len(verdict.gate_results) == 5
    assert verdict.gate_results[4].gate_name == "individual_pair_sweep"
    assert verdict.gate_results[4].passed is False
    assert verdict.portfolio_metrics == {}
    assert verdict.final_pair_set == []
    mock_pair_sweep.assert_awaited_once()


@pytest.mark.asyncio
async def test_final_pair_decision_rejected_fails():
    """Final pair decision rejects -> failed verdict with rejection reason."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/path.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="passed", run_id="gate_001",
        metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
        failures=[], errors=[], warnings=[],
    ))
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "BTC/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
        {"pair": "ETH/USDT", "status": "passed", "score": 0.3, "total_trades": 5,
         "profit_factor": 1.1, "win_rate": 55.0, "max_drawdown": 12.0, "expectancy": 0.05},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "passed",
        "failure_reasons": [],
        "run_id": "portfolio_001",
        "portfolio_summary": {
            "total_trades": 15, "profit_factor": 1.15, "win_rate_pct": 58.0,
            "max_drawdown_pct": 12.0, "sharpe_ratio": 0.8, "expectancy": 0.08,
            "profit_total_pct": 3.5, "profit_total_abs": 35.0,
        },
        "per_pair_metrics": [
            {"pair": "BTC/USDT", "trades": 10, "profit_factor": 2.0, "win_rate_pct": 60.0},
            {"pair": "ETH/USDT", "trades": 5, "profit_factor": 1.5, "win_rate_pct": 55.0},
        ],
        "config_used": {"pairs_count": 2, "max_open_trades": 5},
    })
    mock_decision = MagicMock(return_value={
        "verdict": "rejected",
        "approved_pairs": [],
        "approved_count": 0,
        "rejection_reason": "Only 1 pair(s) qualified (minimum 3)",
        "combined_scores": [],
    })

    spec = StrategySpec(name="strat_g", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT", "ETH/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "run_individual_pair_sweep": mock_pair_sweep,
        "run_portfolio_backtest": mock_portfolio,
        "decide_final_pair_set": mock_decision,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "Only 1 pair(s) qualified (minimum 3)"
    assert len(verdict.gate_results) == 7
    assert verdict.final_pair_set == []
    gates = {g.gate_name: g for g in verdict.gate_results}
    assert gates["final_pair_decision"].passed is False
    assert gates["final_pair_decision"].details["rejection_reason"] == "Only 1 pair(s) qualified (minimum 3)"
    assert verdict.portfolio_metrics["profit_factor"] == 1.15
    mock_decision.assert_called_once()


@pytest.mark.asyncio
async def test_repair_loop_cleans_previous_working_copy():
    """Previous working copy deleted before next repair save; final successful copy kept."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    save_results = [
        _save_result(path="/tmp/ud/strategies/rendered/strat_v0/strat.py"),
        _save_result(path="/tmp/ud/strategies/rendered/strat_v1/strat.py"),
    ]
    mock_save = MagicMock(side_effect=save_results)
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(side_effect=[
        BacktestGateResult(
            gate_status="failed", run_id="g1",
            metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
            failures=["MIN_TRADES"], errors=[], warnings=[],
        ),
        BacktestGateResult(
            gate_status="passed", run_id="g2",
            metrics={"total_trades": 20, "win_rate_pct": 55.0, "profit_factor": 1.2},
            failures=[], errors=[], warnings=[],
        ),
    ])
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class="too_few_trades",
        next_route="extend_timerange_or_discard",
        failed_metrics=["MIN_TRADES"],
    ))
    mock_repair_plan = MagicMock(return_value=MagicMock(
        scope="entry_parameter", can_repair=True, reason="Mock",
    ))
    mock_ollama = MagicMock()
    mock_ask_ai = AsyncMock(return_value={
        "repair_scope": "entry_parameter",
        "change": {"indicator": "rsi", "parameter": "period", "new_value": 10},
        "reasoning": "Increase RSI period",
    })
    new_spec = StrategySpec(
        name="repaired", trading_style="trend_following",
        timeframe="1h", iteration_count=1,
    )
    mock_apply = MagicMock(return_value=(new_spec, []))
    mock_del = MagicMock(return_value=_save_result())
    mock_pair_sweep = AsyncMock(return_value=[
        {"pair": "ETH/USDT", "status": "passed", "score": 0.5, "total_trades": 10,
         "profit_factor": 1.2, "win_rate": 60.0, "max_drawdown": 10.0, "expectancy": 0.1},
    ])
    mock_portfolio = MagicMock(return_value={
        "status": "passed", "failure_reasons": [], "run_id": "portfolio_001",
        "portfolio_summary": {
            "total_trades": 10, "profit_factor": 1.2, "win_rate_pct": 60.0,
            "max_drawdown_pct": 10.0, "sharpe_ratio": 1.0, "expectancy": 0.1,
            "profit_total_pct": 5.0, "profit_total_abs": 50.0,
        },
        "per_pair_metrics": [],
        "config_used": {"pairs_count": 1, "max_open_trades": 5},
    })
    mock_decision = MagicMock(return_value={
        "verdict": "approved", "approved_pairs": ["ETH/USDT"],
        "approved_count": 1, "rejection_reason": None, "combined_scores": [],
    })

    spec = StrategySpec(name="strat_clean", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["ETH/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair_plan,
        "ollama_client": mock_ollama,
        "ask_ai_for_repair_proposal": mock_ask_ai,
        "apply_repair_proposal": mock_apply,
        "delete_rendered_strategy": mock_del,
        "run_individual_pair_sweep": mock_pair_sweep,
        "run_portfolio_backtest": mock_portfolio,
        "decide_final_pair_set": mock_decision,
    })

    assert verdict.passed is True
    # Delete called once with the initial save path before the repair save
    mock_del.assert_called_once_with(
        "/tmp/ud/strategies/rendered/strat_v0/strat.py",
        "/tmp/ud/strategies/rendered",
    )
    # Verify repair save result path is NOT the one deleted
    assert mock_save.call_count == 2
    final_path = str(save_results[1].path)
    # mock_del was not called with the final path
    for call_args in mock_del.call_args_list:
        assert call_args[0][0] != final_path


@pytest.mark.asyncio
async def test_repair_not_allowed_fallback():
    """When can_repair=False and primary_class is None, failure_reason is repair_not_allowed."""
    mock_render = MagicMock(return_value={
        "source": "def test(): pass",
        "errors": [], "warnings": [], "template": "omni",
    })
    mock_save = MagicMock(return_value=_save_result(path="/tmp/ud/strategies/rendered/strat.py"))
    mock_quality = MagicMock(return_value={
        "passed": True, "errors": [], "warnings": [], "details": {},
    })
    mock_backtest = MagicMock(return_value=BacktestGateResult(
        gate_status="failed", run_id="g1",
        metrics={"total_trades": 5, "win_rate_pct": 30.0, "profit_factor": 0.8},
        failures=["MIN_TRADES"], errors=[], warnings=[],
    ))
    mock_analyzer = MagicMock(return_value=MagicMock(
        primary_class=None,
        next_route="unknown",
        failed_metrics=[],
    ))
    mock_repair = MagicMock(return_value=MagicMock(
        scope="unknown", can_repair=False, reason="Cannot repair",
    ))

    spec = StrategySpec(name="strat_x", trading_style="trend_following", timeframe="1h")
    config = CandidateConfig(
        timerange="20230101-20231231", timeframe="1h",
        pairs=["BTC/USDT"], user_data_dir="/tmp/ud",
    )

    verdict = await evaluate_candidate(spec, config, deps={
        "render_strategy": mock_render,
        "save_rendered_strategy": mock_save,
        "check_data_quality": mock_quality,
        "run_backtest_gate": mock_backtest,
        "analyze_gate_failure": mock_analyzer,
        "build_repair_plan": mock_repair,
    })

    assert verdict.passed is False
    assert verdict.failure_reason == "repair_not_allowed"
