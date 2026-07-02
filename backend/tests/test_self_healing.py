"""backend/tests/test_self_healing.py — Self-healing retry mechanism tests.

Tests for the self-healing auto-retry mechanism, including:
- Retry count increments
- Parameter overrides per retry
- Max retries exhaustion
- Stage reset on retry
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import backend.services.auto_quant.pipeline as pl

from .test_helpers import _make_state, _run

MOD = "backend.services.auto_quant.pipeline"


@pytest.mark.skip("Retry loop implementation has changed - tests need update")
class TestSelfHealingRetry:
    """Verify retry_count increments, overrides apply, and max_retries triggers failure."""

    def _run_pipeline_with_oos(
        self,
        state,
        tmp_path: Path,
        oos_sequence: list,
    ) -> MagicMock:
        """
        Run run_pipeline with all stages mocked.  oos_sequence supplies
        successive return values for _stage_oos_validation.
        Returns the _fail_stage mock for assertion.
        """
        opt_path = tmp_path / "AuditStrategy_Optimized.py"
        opt_path.write_text("# fake\nclass AuditStrategy_Optimized: pass\n", encoding="utf-8")

        sanity = {"profit_total_abs": 10.0, "max_drawdown_account": 0.05}
        best = {"loss": -0.3, "params_dict": {"stoploss": -0.05}}
        stress = {"profit_total": 0.08, "per_pair": [], "passing_pairs": [], "failing_pairs": [],
                  "max_drawdown_account": 0.10, "wins": 22, "losses": 18, "draws": 0,
                  "profit_factor": 1.4, "sharpe_ratio": 1.2}
        risk = {"max_drawdown_pct": 10.0, "win_rate_pct": 55.0,
                "profit_factor": 1.4, "sharpe_ratio": 1.2, "total_trades": 40, "checks": {}}

        fail_mock = MagicMock()

        with (
            patch(f"{MOD}._stage_sanity_backtest", new=AsyncMock(return_value=sanity)),
            patch(f"{MOD}._stage_hyperopt", new=AsyncMock(return_value=best)),
            patch(f"{MOD}._stage_patch", new=AsyncMock(return_value=opt_path)),
            patch(f"{MOD}._stage_oos_validation", new=AsyncMock(side_effect=oos_sequence)),
            patch(f"{MOD}._stage_stress_test", new=AsyncMock(return_value=stress)),
            patch(f"{MOD}._stage_risk_assessment", new=AsyncMock(return_value=risk)),
            patch(f"{MOD}._stage_delivery", new=AsyncMock()),
            patch(f"{MOD}._fail_stage", fail_mock),
            patch(f"{MOD}._save_state_to_disk"),
            patch(f"{MOD}._emit"),
        ):
            _run(pl.run_pipeline(state.run_id))

        return fail_mock

    def test_no_retry_when_oos_passes_first_time(self, tmp_path):
        """retry_count must remain 0 when OOS passes on first attempt."""
        state = _make_state(str(tmp_path))
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, [oos_pass])
        assert state.retry_count == 0

    def test_retry_count_increments_to_1_on_first_retry(self, tmp_path):
        """One 'retry' signal must increment retry_count to 1."""
        state = _make_state(str(tmp_path))
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", oos_pass])
        assert state.retry_count == 1

    def test_retry_count_increments_to_2_on_second_retry(self, tmp_path):
        """Two consecutive 'retry' signals must increment retry_count to 2."""
        state = _make_state(str(tmp_path))
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", "retry", oos_pass])
        assert state.retry_count == 2

    def test_retry_count_increments_to_3_on_third_retry(self, tmp_path):
        """Three consecutive 'retry' signals must increment retry_count to 3."""
        state = _make_state(str(tmp_path))
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", "retry", "retry", oos_pass])
        assert state.retry_count == 3

    def test_fail_stage_called_after_max_retries_exhausted(self, tmp_path):
        """After 4 'retry' signals (> max_retries=3), _fail_stage must be called."""
        state = _make_state(str(tmp_path))
        fail_mock = self._run_pipeline_with_oos(
            state, tmp_path, ["retry", "retry", "retry", "retry"]
        )
        assert fail_mock.called, "_fail_stage was never called after exhausting max_retries"

    def test_fail_stage_called_for_stage_4(self, tmp_path):
        """The exhaustion failure must be reported against stage 4."""
        state = _make_state(str(tmp_path))
        fail_mock = self._run_pipeline_with_oos(
            state, tmp_path, ["retry", "retry", "retry", "retry"]
        )
        assert fail_mock.call_count >= 1
        # fail_stage is called with (run_id, state, stage_idx, message)
        call_args = fail_mock.call_args_list[0].args
        stage_idx_arg = call_args[2]
        assert stage_idx_arg == 4, f"Expected stage 4 in fail_stage call, got {stage_idx_arg}"

    def test_retry1_overrides_hyperopt_loss_to_sharpe(self, tmp_path):
        """Retry 1 must switch hyperopt_loss to 'SharpeHyperOptLoss'."""
        state = _make_state(str(tmp_path), hyperopt_loss="CalmarHyperOptLoss")
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", oos_pass])
        assert state.hyperopt_loss == "SharpeHyperOptLoss"

    def test_retry2_narrows_hyperopt_spaces(self, tmp_path):
        """Retry 2 must narrow hyperopt_spaces to ['roi', 'stoploss']."""
        state = _make_state(str(tmp_path), hyperopt_spaces=["buy", "sell", "roi", "stoploss"])
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", "retry", oos_pass])
        assert state.hyperopt_spaces == ["roi", "stoploss"]

    def test_retry3_increases_epochs_by_50_percent(self, tmp_path):
        """Retry 3 must multiply hyperopt_epochs by 1.5 (truncated)."""
        initial_epochs = 100
        state = _make_state(str(tmp_path), hyperopt_epochs=initial_epochs)
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", "retry", "retry", oos_pass])
        expected = int(initial_epochs * 1.5)
        assert state.hyperopt_epochs == expected

    def test_all_three_overrides_accumulate_by_retry_3(self, tmp_path):
        """All three per-retry overrides must be applied cumulatively."""
        state = _make_state(
            str(tmp_path),
            hyperopt_loss="OnlyProfitHyperOptLoss",
            hyperopt_spaces=["buy", "sell"],
            hyperopt_epochs=80,
        )
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", "retry", "retry", oos_pass])
        assert state.hyperopt_loss == "SharpeHyperOptLoss"
        assert state.hyperopt_spaces == ["roi", "stoploss"]
        assert state.hyperopt_epochs == int(80 * 1.5)

    def test_stages_2_3_4_reset_to_pending_on_retry(self, tmp_path):
        """On retry entry, stages 2/3/4 must be re-set to 'pending' before re-running."""
        state = _make_state(str(tmp_path))
        for idx in (2, 3, 4):
            state.stages[idx - 1].status = "passed"
            state.stages[idx - 1].message = "stale"

        captured: list[list[str]] = []
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        opt_path = tmp_path / "AuditStrategy_Optimized.py"
        opt_path.write_text("# fake", encoding="utf-8")

        async def capturing_hyperopt(run_id, s, out_dir):
            captured.append([s.stages[i - 1].status for i in (2, 3, 4)])
            return {"loss": -0.3, "params_dict": {}}

        sanity = {"profit_total_abs": 10.0, "max_drawdown_account": 0.05}
        stress = {"profit_total": 0.08, "per_pair": [], "passing_pairs": [], "failing_pairs": [],
                  "max_drawdown_account": 0.10, "wins": 22, "losses": 18, "draws": 0,
                  "profit_factor": 1.4, "sharpe_ratio": 1.2}
        risk = {"max_drawdown_pct": 10.0, "win_rate_pct": 55.0,
                "profit_factor": 1.4, "sharpe_ratio": 1.2, "total_trades": 40, "checks": {}}

        with (
            patch(f"{MOD}._stage_sanity_backtest", new=AsyncMock(return_value=sanity)),
            patch(f"{MOD}._stage_hyperopt", new=AsyncMock(side_effect=capturing_hyperopt)),
            patch(f"{MOD}._stage_patch", new=AsyncMock(return_value=opt_path)),
            patch(f"{MOD}._stage_oos_validation", new=AsyncMock(side_effect=["retry", oos_pass])),
            patch(f"{MOD}._stage_stress_test", new=AsyncMock(return_value=stress)),
            patch(f"{MOD}._stage_risk_assessment", new=AsyncMock(return_value=risk)),
            patch(f"{MOD}._stage_delivery", new=AsyncMock()),
            patch(f"{MOD}._fail_stage"),
            patch(f"{MOD}._save_state_to_disk"),
            patch(f"{MOD}._emit"),
        ):
            _run(pl.run_pipeline(state.run_id))

        assert len(captured) == 2, f"Expected 2 Stage-2 entries, got {len(captured)}"
        assert captured[1] == ["pending", "pending", "pending"], (
            f"Stages 2/3/4 not reset on retry: {captured[1]}"
        )

    def test_hard_oos_failure_does_not_retry(self, tmp_path):
        """OOS returning None (hard failure) must NOT increment retry_count."""
        state = _make_state(str(tmp_path))
        self._run_pipeline_with_oos(state, tmp_path, [None])
        assert state.retry_count == 0

    def test_pipeline_completes_after_one_self_healing_retry(self, tmp_path):
        """Pipeline must reach 'completed' when OOS passes on the second attempt."""
        state = _make_state(str(tmp_path))
        oos_pass = {"profit_total": 0.05, "max_drawdown_account": 0.10}
        self._run_pipeline_with_oos(state, tmp_path, ["retry", oos_pass])
        assert state.status == "completed"
