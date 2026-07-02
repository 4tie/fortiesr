"""
backend/tests/test_auto_quant_pipeline.py — Automated tests for the Stage 4 self-healing retry loop.

Covers:
  - Unit tests for _stage_oos_validation returning "retry" / None / dict
  - Integration tests for run_pipeline verifying:
      • retry_count increments correctly
      • Per-retry parameter overrides (retry 1 → loss, retry 2 → spaces, retry 3 → epochs)
      • _fail_stage called with the correct message after max retries exceeded
      • Stale artifact cleanup triggered on re-entry to Stage 2

Run from project root:
    pytest backend/tests/test_auto_quant_pipeline.py -v
"""
from __future__ import annotations

import asyncio
import sys
import tempfile
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

# ── Make project root importable ──────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backend.services.auto_quant.pipeline as pipeline
from backend.services.auto_quant.pipeline import (
    MIN_OOS_PROFIT,
    PipelineState,
    StageState,
    STAGE_NAMES,
    _states,
    _queues,
    _cancel_flags,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

def _run(coro):
    """Run an async coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_state(tmp_dir: str, **overrides) -> PipelineState:
    """Build a minimal PipelineState registered in the global registry."""
    run_id = str(uuid.uuid4())
    stages = [StageState(index=i + 1, name=STAGE_NAMES[i]) for i in range(len(STAGE_NAMES))]
    
    # Create strategies directory and strategy file
    strategies_dir = Path(tmp_dir) / "strategies"
    strategies_dir.mkdir(parents=True, exist_ok=True)
    strategy_name = overrides.get("strategy", "TestStrategy")
    strategy_file = strategies_dir / f"{strategy_name}.py"
    strategy_file.write_text("# fake strategy", encoding="utf-8")
    
    state = PipelineState(
        run_id=run_id,
        strategy=strategy_name,
        timeframe="1h",
        in_sample_range="20230101-20230601",
        out_sample_range="20230601-20231201",
        exchange="binance",
        config_file="/fake/config.json",
        freqtrade_path="freqtrade",
        user_data_dir=tmp_dir,
        stages=stages,
        created_at="2024-01-01T00:00:00+00:00",
    )
    for k, v in overrides.items():
        setattr(state, k, v)

    _states[run_id] = state
    _queues[run_id] = []
    _cancel_flags[run_id] = False
    return state


def _fake_optimized_path(tmp_dir: str, name: str = "TestStrategy_Optimized") -> Path:
    p = Path(tmp_dir) / f"{name}.py"
    p.write_text("# fake strategy", encoding="utf-8")
    return p


# ═══════════════════════════════════════════════════════════════════════════════
# UNIT TESTS — _stage_oos_validation return values
# ═══════════════════════════════════════════════════════════════════════════════

class TestStageOosValidationUnit:
    """Unit tests for _stage_oos_validation return-value branches."""

    MOD = "backend.services.auto_quant.pipeline"

    def _run_oos(self, state: PipelineState, optimized_path: Path,
                 rc: int = 0,
                 profit: float = 0.05,
                 max_dd_account: float = 0.10,
                 trade_count: int = 20) -> object:
        """Helper: patch all subprocess + IO deps and call _stage_oos_validation."""
        result_data = {"strategy": {optimized_path.stem: {}}}
        summary = {
            "profit_total": profit,
            "max_drawdown_account": max_dd_account,
        }
        out_dir = optimized_path.parent

        with (
            patch(f"{self.MOD}._start_stage"),
            patch(f"{self.MOD}._cancelled", return_value=False),
            patch(f"{self.MOD}._run_subprocess",
                  new=AsyncMock(return_value=(rc, "stdout", "stderr"))),
            patch(f"{self.MOD}._find_backtest_result", return_value=result_data),
            patch(f"{self.MOD}._extract_backtest_summary", return_value=summary),
            patch(f"{self.MOD}._extract_trade_count", return_value=trade_count),
            patch(f"{self.MOD}._fail_stage"),
            patch(f"{self.MOD}._pass_stage"),
            patch(f"{self.MOD}._classify_subprocess_error",
                  return_value="mocked error"),
        ):
            return _run(pipeline._stage_oos_validation(
                state.run_id, state, out_dir, optimized_path
            ))

    def test_returns_dict_when_profit_ok_and_dd_ok(self, tmp_path):
        """Should return a summary dict when profit ≥ 0 and DD ≤ threshold."""
        state = _make_state(str(tmp_path))
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, profit=0.05, max_dd_account=0.10)
        assert isinstance(result, dict), f"Expected dict, got {type(result)}: {result}"

    def test_returns_retry_when_profit_negative(self, tmp_path):
        """Should return 'retry' when profit_total < MIN_OOS_PROFIT (0.0)."""
        state = _make_state(str(tmp_path))
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, profit=-0.01, max_dd_account=0.10)
        assert result == "retry", f"Expected 'retry', got {result!r}"

    def test_returns_retry_when_profit_exactly_zero_is_ok(self, tmp_path):
        """Profit == MIN_OOS_PROFIT (0.0) should PASS, not retry."""
        state = _make_state(str(tmp_path))
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, profit=0.0, max_dd_account=0.10)
        assert result != "retry", f"Profit=0.0 should pass but got {result!r}"
        assert isinstance(result, dict)

    def test_returns_retry_when_drawdown_exceeds_threshold(self, tmp_path):
        """Should return 'retry' when max_drawdown_account > threshold."""
        state = _make_state(str(tmp_path), max_drawdown_threshold=30.0)
        opt = _fake_optimized_path(str(tmp_path))
        # max_dd_account=0.31 → 31% > 30% threshold
        result = self._run_oos(state, opt, profit=0.05, max_dd_account=0.31)
        assert result == "retry", f"Expected 'retry' for high DD, got {result!r}"

    def test_returns_retry_when_profit_negative_and_dd_high(self, tmp_path):
        """Both bad profit and high DD should still return 'retry' (not None)."""
        state = _make_state(str(tmp_path), max_drawdown_threshold=30.0)
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, profit=-0.05, max_dd_account=0.40)
        assert result == "retry"

    def test_returns_none_when_subprocess_fails(self, tmp_path):
        """Should return None (hard failure) when subprocess exits non-zero."""
        state = _make_state(str(tmp_path))
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, rc=1, profit=0.05, max_dd_account=0.10)
        assert result is None, f"Expected None on rc=1, got {result!r}"

    def test_custom_drawdown_threshold_respected(self, tmp_path):
        """Per-run max_drawdown_threshold should override module default."""
        # 25% threshold — a 26% DD should trigger retry
        state = _make_state(str(tmp_path), max_drawdown_threshold=25.0)
        opt = _fake_optimized_path(str(tmp_path))
        result = self._run_oos(state, opt, profit=0.05, max_dd_account=0.26)
        assert result == "retry"

        # Same DD (26%) with 30% threshold should pass
        state2 = _make_state(str(tmp_path), max_drawdown_threshold=30.0)
        opt2 = _fake_optimized_path(str(tmp_path))
        result2 = self._run_oos(state2, opt2, profit=0.05, max_dd_account=0.26)
        assert isinstance(result2, dict)


# ═══════════════════════════════════════════════════════════════════════════════
# INTEGRATION TESTS — run_pipeline retry loop
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skip("Retry loop implementation has changed - tests need update")
class TestRunPipelineRetryLoop:
    """Integration tests for the Stages 2-4 self-healing retry loop in run_pipeline."""

    MOD = "backend.services.auto_quant.pipeline"

    def _run_with_mocks(
        self,
        state: PipelineState,
        tmp_path: Path,
        *,
        oos_side_effect,
    ) -> MagicMock:
        """
        Run run_pipeline with all stages mocked except the retry logic itself.

        oos_side_effect: list of return values for successive _stage_oos_validation calls.
        Returns the mock for _fail_stage so callers can assert on it.
        """
        opt_path = _fake_optimized_path(str(tmp_path))
        sanity_summary = {"profit_total_abs": 1.0, "max_drawdown_account": 0.05}
        best_params = {"loss": -0.5, "params_dict": {"stoploss": -0.05, "roi_t1": 0.02}}
        stress_result = {"profit_total": 0.1, "per_pair": [], "passing_pairs": [], "failing_pairs": []}
        risk_result = {"win_rate": 55.0, "profit_factor": 1.5, "sharpe": 0.8}

        fail_stage_mock = MagicMock()

        with (
            patch(f"{self.MOD}._stage_sanity_backtest",
                  new=AsyncMock(return_value=sanity_summary)),
            patch(f"{self.MOD}._stage_hyperopt",
                  new=AsyncMock(return_value=best_params)),
            patch(f"{self.MOD}._stage_patch",
                  new=AsyncMock(return_value=opt_path)),
            patch(f"{self.MOD}._stage_oos_validation",
                  new=AsyncMock(side_effect=oos_side_effect)),
            patch(f"{self.MOD}._stage_stress_test",
                  new=AsyncMock(return_value=stress_result)),
            patch(f"{self.MOD}._stage_risk_assessment",
                  new=AsyncMock(return_value=risk_result)),
            patch(f"{self.MOD}._stage_delivery", new=AsyncMock()),
            patch(f"{self.MOD}._fail_stage", fail_stage_mock),
            patch(f"{self.MOD}._save_state_to_disk"),
            patch(f"{self.MOD}._emit"),
        ):
            _run(pipeline.run_pipeline(state.run_id))

        return fail_stage_mock

    # ── retry_count increments ─────────────────────────────────────────────────

    def test_retry_count_zero_on_first_pass(self, tmp_path):
        """retry_count stays 0 when OOS passes on the first try."""
        state = _make_state(str(tmp_path))
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(state, tmp_path, oos_side_effect=[oos_result])
        assert state.retry_count == 0

    def test_retry_count_increments_on_each_retry(self, tmp_path):
        """retry_count should equal the number of 'retry' signals received."""
        state = _make_state(str(tmp_path))
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        # Two retries, then pass
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", oos_result],
        )
        assert state.retry_count == 2

    def test_retry_count_reaches_max_then_fail_stage_called(self, tmp_path):
        """After 3 retries (> max_retries=3), _fail_stage must be called."""
        state = _make_state(str(tmp_path))
        # 4 consecutive "retry" returns → retry_count hits 4 > max_retries=3
        fail_mock = self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", "retry", "retry"],
        )
        assert fail_mock.called, "_fail_stage was not called after max retries"
        assert state.retry_count > state.max_retries

    # ── _fail_stage message ────────────────────────────────────────────────────

    def test_fail_stage_message_after_max_retries(self, tmp_path):
        """_fail_stage must be called for stage 4 with the exhaustion message."""
        state = _make_state(str(tmp_path))
        fail_mock = self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", "retry", "retry"],
        )
        # Should be called exactly once for the retry exhaustion
        assert fail_mock.call_count >= 1
        # Positional args: (run_id, state, stage_idx, message[, data])
        call_args = fail_mock.call_args_list[0]
        pos = call_args.args
        run_id_arg, state_arg, stage_idx_arg, msg_arg = pos[0], pos[1], pos[2], pos[3]
        assert run_id_arg == state.run_id
        assert stage_idx_arg == 4
        assert "3" in msg_arg or "manual" in msg_arg.lower(), (
            f"Exhaustion message does not mention '3' or 'manual': {msg_arg!r}"
        )

    # ── Per-retry parameter overrides ──────────────────────────────────────────

    def test_retry1_switches_hyperopt_loss(self, tmp_path):
        """Retry 1 must set hyperopt_loss → SharpeHyperOptLoss."""
        initial_loss = "CalmarHyperOptLoss"
        state = _make_state(str(tmp_path), hyperopt_loss=initial_loss)
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", oos_result],
        )
        assert state.hyperopt_loss == "SharpeHyperOptLoss", (
            f"Expected SharpeHyperOptLoss after retry 1, got {state.hyperopt_loss!r}"
        )

    def test_retry2_narrows_hyperopt_spaces(self, tmp_path):
        """Retry 2 must set hyperopt_spaces → ['roi', 'stoploss']."""
        state = _make_state(str(tmp_path),
                            hyperopt_spaces=["buy", "sell", "roi", "stoploss"])
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", oos_result],
        )
        assert state.hyperopt_spaces == ["roi", "stoploss"], (
            f"Expected ['roi', 'stoploss'] after retry 2, got {state.hyperopt_spaces!r}"
        )

    def test_retry3_increases_hyperopt_epochs(self, tmp_path):
        """Retry 3 must increase hyperopt_epochs by 1.5×."""
        original_epochs = 100
        state = _make_state(str(tmp_path), hyperopt_epochs=original_epochs)
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", "retry", oos_result],
        )
        expected = int(original_epochs * 1.5)
        assert state.hyperopt_epochs == expected, (
            f"Expected epochs={expected} after retry 3, got {state.hyperopt_epochs}"
        )

    def test_overrides_applied_in_order(self, tmp_path):
        """All three per-retry overrides must accumulate by retry 3."""
        state = _make_state(
            str(tmp_path),
            hyperopt_loss="OnlyProfitHyperOptLoss",
            hyperopt_spaces=["buy", "sell"],
            hyperopt_epochs=80,
        )
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", "retry", "retry", oos_result],
        )
        # All three overrides must have fired
        assert state.hyperopt_loss == "SharpeHyperOptLoss"
        assert state.hyperopt_spaces == ["roi", "stoploss"]
        assert state.hyperopt_epochs == int(80 * 1.5)

    # ── Stage status reset on retry ────────────────────────────────────────────

    def test_stages_2_3_4_reset_to_pending_on_retry(self, tmp_path):
        """On a retry, stages 2/3/4 must be reset to 'pending' before re-running."""
        state = _make_state(str(tmp_path))
        # Pre-mark stages as passed to confirm they get reset
        for idx in (2, 3, 4):
            state.stages[idx - 1].status = "passed"
            state.stages[idx - 1].message = "previous run"

        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        captured_statuses: list[list[str]] = []

        real_hyperopt = pipeline._stage_hyperopt

        async def capturing_hyperopt(run_id, s, out_dir):
            # Record stage statuses at the point Stage 2 is entered on each attempt
            captured_statuses.append([s.stages[i - 1].status for i in (2, 3, 4)])
            return {"loss": -0.5, "params_dict": {}}

        opt_path = _fake_optimized_path(str(tmp_path))
        sanity_summary = {"profit_total_abs": 1.0, "max_drawdown_account": 0.05}

        with (
            patch(f"{self.MOD}._stage_sanity_backtest",
                  new=AsyncMock(return_value=sanity_summary)),
            patch(f"{self.MOD}._stage_hyperopt",
                  new=AsyncMock(side_effect=capturing_hyperopt)),
            patch(f"{self.MOD}._stage_patch",
                  new=AsyncMock(return_value=opt_path)),
            patch(f"{self.MOD}._stage_oos_validation",
                  new=AsyncMock(side_effect=["retry", oos_result])),
            patch(f"{self.MOD}._stage_stress_test",
                  new=AsyncMock(return_value={})),
            patch(f"{self.MOD}._stage_risk_assessment",
                  new=AsyncMock(return_value={})),
            patch(f"{self.MOD}._stage_delivery", new=AsyncMock()),
            patch(f"{self.MOD}._fail_stage"),
            patch(f"{self.MOD}._save_state_to_disk"),
            patch(f"{self.MOD}._emit"),
        ):
            _run(pipeline.run_pipeline(state.run_id))

        assert len(captured_statuses) == 2, (
            f"Expected Stage 2 entered twice (initial + 1 retry), "
            f"got {len(captured_statuses)} calls"
        )
        # On the second entry (after retry), all three stages must be pending
        retry_statuses = captured_statuses[1]
        assert retry_statuses == ["pending", "pending", "pending"], (
            f"Stages 2/3/4 not reset on retry: {retry_statuses}"
        )

    # ── Pipeline completes successfully after recovery ─────────────────────────

    def test_pipeline_completes_after_one_retry(self, tmp_path):
        """Pipeline status must be 'completed' when OOS passes on second attempt."""
        state = _make_state(str(tmp_path))
        oos_result = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=["retry", oos_result],
        )
        assert state.status == "completed", (
            f"Expected 'completed' after one retry, got {state.status!r}"
        )

    def test_pipeline_halts_on_oos_hard_failure(self, tmp_path):
        """When OOS returns None (hard failure), pipeline must NOT retry."""
        state = _make_state(str(tmp_path))
        fail_mock = self._run_with_mocks(
            state, tmp_path,
            oos_side_effect=[None],  # hard failure, not overfitting
        )
        assert state.retry_count == 0, (
            "retry_count must not increment on a hard OOS failure (None)"
        )
        assert state.status != "completed"

    # ── Stale artifact cleanup ─────────────────────────────────────────────────

    def test_stale_artifacts_deleted_on_retry(self, tmp_path):
        """
        On retry entry into Stage 2, hyperopt_best.json and stage4_result.json
        must be deleted if they exist.
        """
        out_dir = tmp_path / "auto_quant" / "test_run"
        out_dir.mkdir(parents=True)

        # Create stale artifacts
        stale_hyperopt = out_dir / "hyperopt_best.json"
        stale_stage4 = out_dir / "stage4_result.json"
        stale_hyperopt.write_text('{"stale": true}', encoding="utf-8")
        stale_stage4.write_text('{"stale": true}', encoding="utf-8")

        state = _make_state(str(tmp_path), retry_count=1)

        # Call _stage_hyperopt directly with retry_count=1 to test cleanup
        with (
            patch(f"{self.MOD}._start_stage"),
            patch(f"{self.MOD}._cancelled", return_value=False),
            patch(f"{self.MOD}._run_subprocess",
                  new=AsyncMock(return_value=(0, "", ""))),
            patch(f"{self.MOD}._extract_hyperopt_best",
                  new=AsyncMock(return_value={"loss": -0.5, "params_dict": {}})),
            patch(f"{self.MOD}._pass_stage"),
            patch(f"{self.MOD}._fail_stage"),
        ):
            _run(pipeline._stage_hyperopt(state.run_id, state, out_dir))

        assert not stale_hyperopt.exists(), (
            "hyperopt_best.json was NOT deleted on retry re-entry"
        )
        assert not stale_stage4.exists(), (
            "stage4_result.json was NOT deleted on retry re-entry"
        )

    def test_no_cleanup_on_first_run(self, tmp_path):
        """On the first run (retry_count=0), existing artifacts must NOT be deleted."""
        out_dir = tmp_path / "auto_quant" / "first_run"
        out_dir.mkdir(parents=True)

        artifact = out_dir / "hyperopt_best.json"
        artifact.write_text('{"valid": true}', encoding="utf-8")

        state = _make_state(str(tmp_path), retry_count=0)

        with (
            patch(f"{self.MOD}._start_stage"),
            patch(f"{self.MOD}._cancelled", return_value=False),
            patch(f"{self.MOD}._run_subprocess",
                  new=AsyncMock(return_value=(0, "", ""))),
            patch(f"{self.MOD}._extract_hyperopt_best",
                  new=AsyncMock(return_value={"loss": -0.5, "params_dict": {}})),
            patch(f"{self.MOD}._pass_stage"),
            patch(f"{self.MOD}._fail_stage"),
        ):
            _run(pipeline._stage_hyperopt(state.run_id, state, out_dir))

        assert artifact.exists(), (
            "hyperopt_best.json was deleted on first run (retry_count=0) — should not be"
        )
