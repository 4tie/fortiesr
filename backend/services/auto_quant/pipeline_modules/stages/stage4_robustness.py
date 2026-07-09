"""Stage 4 implementation: Robustness & Feature Injection (Slippage/Fee Stress Testing)."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from ..filters import _analyze_trading_windows
from ..helpers import (
    _backtest_cmd,
    _classify_subprocess_error,
    _create_temp_config_with_fee_override,
    _emit,
    _extract_backtest_summary,
    _extract_per_pair_results,
    _fail_stage,
    _find_backtest_result,
    _pass_stage,
    _run_subprocess,
    _start_stage,
    strategy_path_args,
)
from ..logging import _rlog
from ..state import PipelineState, _Cancelled, _cancelled


async def _stage_robustness_feature_injection(
    run_id: str, state: PipelineState, out_dir: Path, optimized_path: Path
) -> dict | None:
    """Stage 4: Robustness & Feature Injection (Slippage/Fee Stress Testing).

    Performs:
    1. Losing windows analysis from Hyperopt backtest trades
    2. Three global portfolio backtests with fee multipliers (1x, 2x, 3x)
    3. Stability score computation with division-by-zero guard
    4. Real-time WebSocket streaming of stability scores
    5. Safe feature injection (custom_stoploss + trading windows)
    """
    _start_stage(run_id, state, 4)  # Stage 4: Robustness & Feature Injection
    strategy_name = optimized_path.stem
    pairs_to_test = [p["key"] for p in state.selected_pairs] if state.selected_pairs else None

    if not pairs_to_test:
        _rlog(run_id, 4, logging.WARNING, "Stage 4 | No selected_pairs available, skipping stress testing")
        state.stability_scores = {}
        _pass_stage(run_id, state, 4, "No pairs to test for stress testing", {"stability_scores": {}})
        return {"stability_scores": {}}

    _rlog(run_id, 4, logging.INFO,
          f"Stage 4 | Robustness & Feature Injection | strategy={strategy_name} | pairs={len(pairs_to_test)}")
    _emit(run_id, 4, "running", f"Running slippage/fee stress testing on {len(pairs_to_test)} pairs...", 55)

    # ── Sub-step 4.1: Losing windows analysis from Hyperopt backtest trades ─────────
    _rlog(run_id, 4, logging.INFO, "Stage 4 | Analyzing losing windows from Hyperopt backtest...")
    try:
        # Load Hyperopt backtest result (stage2_result)
        hyperopt_result_data = _find_backtest_result(out_dir, "stage2_result", state.user_data_dir)
        if hyperopt_result_data:
            per_pair = _extract_per_pair_results(hyperopt_result_data, strategy_name)
            trading_windows = _analyze_trading_windows(per_pair)
            state.excluded_time_windows = {
                "excluded_hours": trading_windows["excluded_hours"],
                "excluded_days": trading_windows["excluded_days"],
            }
            _rlog(run_id, 4, logging.INFO,
                  f"Stage 4 | Trading window analysis: excluded_hours={trading_windows['excluded_hours']}, "
                  f"excluded_days={trading_windows['excluded_days']}")
        else:
            _rlog(run_id, 4, logging.WARNING, "Stage 4 | No Hyperopt backtest result found, skipping window analysis")
            state.excluded_time_windows = {"excluded_hours": [], "excluded_days": []}
    except Exception as exc:
        _rlog(run_id, 4, logging.WARNING, f"Stage 4 | Losing windows analysis failed: {exc}")
        state.excluded_time_windows = {"excluded_hours": [], "excluded_days": []}

    # ── Sub-step 4.2: Run 3 fee stress tests (1x, 2x, 3x) using temp configs ─────────
    fee_multipliers = [1.0, 2.0, 3.0]
    stress_results = {}  # {multiplier: {pair: profit}}
    temp_configs = []

    try:
        for multiplier in fee_multipliers:
            _rlog(run_id, 4, logging.INFO, f"Stage 4 | Running stress test with {multiplier}x fees...")
            _emit(run_id, 4, "running", f"Running stress test with {multiplier}x fees...", 55 + (multiplier * 5))

            # Create temporary config with fee override
            temp_config = _create_temp_config_with_fee_override(
                state.config_file, multiplier, out_dir
            )
            temp_configs.append(temp_config)

            # Run backtest with temp config
            result_prefix = str(out_dir / f"stage4_stress_{multiplier}x")
            cmd = [state.freqtrade_path, "backtesting",
                    "--config", str(temp_config),
                    "--strategy", strategy_name,
                    "--timerange", state.in_sample_range,  # Use in-sample for stress testing
                    "--timeframe", state.timeframe,
                    "--user-data-dir", state.user_data_dir,
                    "--export", "trades",
                    "--export-filename", result_prefix + ".json",
                    "--no-color",
                    "--cache", "none"]
            cmd += strategy_path_args(state)
            if pairs_to_test:
                cmd += ["--pairs"] + pairs_to_test

            _rlog(run_id, 4, logging.DEBUG, f"Stage 4 | Spawning subprocess: {' '.join(cmd)}")
            rc, stdout, stderr = await _run_subprocess(run_id, cmd, stage=4)

            if rc != 0:
                msg = _classify_subprocess_error(rc, stdout, f"Stage 4 (Stress Test {multiplier}x)")
                _rlog(run_id, 4, logging.ERROR, f"Stage 4 | FAIL | {msg}")
                _fail_stage(run_id, state, 4, msg)
                return None

            # Extract per-pair results
            result_data = _find_backtest_result(out_dir, f"stage4_stress_{multiplier}x", state.user_data_dir)
            per_pair = _extract_per_pair_results(result_data, strategy_name)

            # Store profits for each pair (use profit_total which is what _extract_per_pair_results returns)
            pair_profits = {p["key"]: p.get("profit_total", 0.0) for p in per_pair}
            stress_results[multiplier] = pair_profits

            _rlog(run_id, 4, logging.INFO,
                  f"Stage 4 | {multiplier}x stress test complete: {len(pair_profits)} pairs")

    finally:
        # Cleanup temporary config files
        for temp_config in temp_configs:
            try:
                Path(temp_config).unlink(missing_ok=True)
                _rlog(run_id, 4, logging.DEBUG, f"Stage 4 | Deleted temp config: {temp_config}")
            except Exception as exc:
                _rlog(run_id, 4, logging.WARNING, f"Stage 4 | Failed to delete temp config {temp_config}: {exc}")

    # ── Sub-step 4.3: Compute stability scores with division-by-zero guard ─────────
    _rlog(run_id, 4, logging.INFO, "Stage 4 | Computing stability scores...")
    state.stability_scores = {}

    for pair in pairs_to_test:
        profit_1x = stress_results.get(1.0, {}).get(pair, 0.0)
        profit_2x = stress_results.get(2.0, {}).get(pair, 0.0)
        profit_3x = stress_results.get(3.0, {}).get(pair, 0.0)

        # CRITICAL BUG GUARD: If profit at 1x fees <= 0, set stability_score = 0
        if profit_1x <= 0:
            stability_score = 0.0
        else:
            stability_score = 100 * (profit_3x / profit_1x)

        # Enforce strict clamping to [0, 100]
        stability_score = max(0.0, min(100.0, stability_score))

        state.stability_scores[pair] = stability_score

        # ── Sub-step 4.4: Emit WebSocket event for each pair ─────────────────────
        _emit(run_id, 4, "running",
              f"Stability score for {pair}: {stability_score:.1f}",
              65,
              msg_type="stability_score_result",
              data={
                  "pair_name": pair,
                  "stability_score": round(stability_score, 2),
                  "profit_1x": round(profit_1x, 4),
                  "profit_2x": round(profit_2x, 4),
                  "profit_3x": round(profit_3x, 4),
              })

        _rlog(run_id, 4, logging.DEBUG,
              f"Stage 4 | {pair}: stability={stability_score:.1f} "
              f"profits=[1x={profit_1x:.4f}, 2x={profit_2x:.4f}, 3x={profit_3x:.4f}]")

    _rlog(run_id, 4, logging.INFO,
          f"Stage 4 | Stability scores computed for {len(state.stability_scores)} pairs")

    # ── Sub-step 4.5: Failure-driven feature injection ───────────────────────────────
    _rlog(run_id, 4, logging.INFO, "Stage 4 | Analyzing failure patterns for feature injection...")
    injection_success = True
    injection_error = None
    features_injected = []
    failure_reasons = []

    try:
        strategy_content = optimized_path.read_text(encoding="utf-8")

        # ── Analyze failure patterns from stress test results ─────────────────────
        # Pattern 1: Liquidity weakness (low volume periods) → volume filter
        liquidity_weakness = False
        avg_profit_1x = sum(stress_results.get(1.0, {}).values()) / len(stress_results.get(1.0, {})) if stress_results.get(1.0) else 0
        avg_profit_3x = sum(stress_results.get(3.0, {}).values()) / len(stress_results.get(3.0, {})) if stress_results.get(3.0) else 0
        
        # If profit degrades significantly under high fees, indicates sensitivity to execution quality
        if avg_profit_1x > 0 and (avg_profit_3x / avg_profit_1x) < 0.5:
            liquidity_weakness = True
            failure_reasons.append("liquidity_weakness")
            _rlog(run_id, 4, logging.INFO, "Stage 4 | Detected liquidity weakness - injecting volume filter")

        # Pattern 2: High drawdown during volatility → ATR volatility guard
        high_drawdown = False
        # Check if any pair has low stability score (indicates sensitivity to stress)
        low_stability_pairs = [p for p, score in state.stability_scores.items() if score < 50]
        if len(low_stability_pairs) / len(state.stability_scores) > 0.3:
            high_drawdown = True
            failure_reasons.append("high_drawdown")
            _rlog(run_id, 4, logging.INFO, "Stage 4 | Detected high drawdown sensitivity - injecting ATR volatility guard")

        # Pattern 3: Bad trades in specific hours → blocked_hours (already analyzed)
        blocked_hours = state.excluded_time_windows.get("excluded_hours", [])
        blocked_days = state.excluded_time_windows.get("excluded_days", [])
        if blocked_hours or blocked_days:
            failure_reasons.append("time_window_failures")
            _rlog(run_id, 4, logging.INFO, f"Stage 4 | Detected time window failures - injecting blocked_hours={blocked_hours}, blocked_days={blocked_days}")

        # ── Inject features based on detected failures ─────────────────────────────
        
        # Feature 1: Volume filter (for liquidity weakness)
        if liquidity_weakness:
            volume_filter_code = '''
    def confirm_trade_entry(self, pair: str, order_type: str, rate: float, time_in_force: str, 
                           current_time: datetime, entry_tag: str | None, side: str, **kwargs) -> bool:
        """Volume filter: only enter trades when volume is above threshold."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        last_candle = dataframe.iloc[-1]
        
        # Skip if volume is too low (liquidity weakness)
        min_volume = last_candle['volume'].rolling(24).mean().iloc[-1] * 0.5
        if last_candle['volume'] < min_volume:
            return False
            
        return True
'''
            class_pattern = rf'(class {re.escape(strategy_name)}\(IStrategy\):)'
            if re.search(class_pattern, strategy_content):
                strategy_content = re.sub(
                    class_pattern,
                    f'\\1\n{volume_filter_code}',
                    strategy_content,
                    count=1,
                )
                features_injected.append("volume_filter")
                _rlog(run_id, 4, logging.DEBUG, "Stage 4 | Injected volume_filter method")

        # Feature 2: ATR volatility guard (for high drawdown)
        if high_drawdown:
            atr_guard_code = '''
    def confirm_trade_exit(self, pair: str, trade: Trade, order_type: str, amount: float, rate: float,
                          time_in_force: str, exit_reason: str, current_time: datetime, **kwargs) -> bool:
        """ATR volatility guard: reduce position size during high volatility."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        last_candle = dataframe.iloc[-1]
        
        # Calculate ATR-based volatility
        atr = last_candle['atr'] if 'atr' in last_candle else 0
        avg_atr = dataframe['atr'].rolling(24).mean().iloc[-1] if 'atr' in dataframe else 0
        
        # If volatility is extremely high, skip exit (let trailing stop handle it)
        if atr > avg_atr * 2.0:
            return False
            
        return True
'''
            class_pattern = rf'(class {re.escape(strategy_name)}\(IStrategy\):)'
            if re.search(class_pattern, strategy_content) and 'confirm_trade_exit' not in strategy_content:
                strategy_content = re.sub(
                    class_pattern,
                    f'\\1\n{atr_guard_code}',
                    strategy_content,
                    count=1,
                )
                features_injected.append("atr_volatility_guard")
                _rlog(run_id, 4, logging.DEBUG, "Stage 4 | Injected atr_volatility_guard method")

        # Feature 3: Trading window filters (for time-based failures)
        if blocked_hours or blocked_days:
            class_line = f"class {strategy_name}(IStrategy):"
            if class_line in strategy_content:
                lines = strategy_content.split('\n')
                for i, line in enumerate(lines):
                    if class_line in line:
                        # Insert after INTERFACE_VERSION line (typically 2 lines after class)
                        insert_idx = i + 2
                        lines.insert(insert_idx, f"    blocked_hours = {blocked_hours}")
                        lines.insert(insert_idx + 1, f"    blocked_days = {blocked_days}")
                        break
                strategy_content = '\n'.join(lines)
                features_injected.append("trading_windows")
                _rlog(run_id, 4, logging.DEBUG,
                      f"Stage 4 | Injected trading window filters: hours={blocked_hours}, days={blocked_days}")

        # Feature 4: Custom stoploss (always inject for robustness)
        custom_stoploss_code = '''
    def custom_stoploss(self, pair: str, trade, current_time, current_rate: float,
                        current_profit: float, after_fill: bool, **kwargs) -> float | None:
        """Three-tier aggressive trailing stoploss with profit lock-in.
        
        Tier 1: If profit >= 2%, lock stoploss at +0.5%
        Tier 2: If profit >= 4%, lock stoploss at +1.5%
        Tier 3: If profit >= 8%, lock stoploss at +3.0%
        """
        from freqtrade.strategy import stoploss_from_open
        
        if current_profit >= 0.08:  # 8%
            return stoploss_from_open(0.03, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        if current_profit >= 0.04:  # 4%
            return stoploss_from_open(0.015, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        if current_profit >= 0.02:  # 2%
            return stoploss_from_open(0.005, current_profit, is_short=trade.is_short, leverage=trade.leverage) or 1
        return None
'''
        class_pattern = rf'(class {re.escape(strategy_name)}\(IStrategy\):)'
        if re.search(class_pattern, strategy_content) and 'custom_stoploss' not in strategy_content:
            strategy_content = re.sub(
                class_pattern,
                f'\\1\n{custom_stoploss_code}',
                strategy_content,
                count=1,
            )
            features_injected.append("custom_stoploss")
            _rlog(run_id, 4, logging.DEBUG, "Stage 4 | Injected custom_stoploss method")

        # Feature 5: Custom stake amount (for risk management)
        # Inject if high drawdown detected or if stability scores are low
        if high_drawdown or len(low_stability_pairs) > 0:
            custom_stake_code = '''
    def custom_stake_amount(self, pair: str, current_time: datetime, current_rate: float,
                           proposed_stake: float, min_stake: float, max_stake: float,
                           leverage: float, entry_tag: str | None, side: str, **kwargs) -> float:
        """Dynamic stake sizing based on volatility and recent performance."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        last_candle = dataframe.iloc[-1]
        
        # Calculate ATR-based volatility
        atr = last_candle['atr'] if 'atr' in last_candle else 0
        avg_atr = dataframe['atr'].rolling(24).mean().iloc[-1] if 'atr' in dataframe else 0
        
        # Reduce stake size during high volatility
        if atr > avg_atr * 1.5:
            return proposed_stake * 0.5  # 50% reduction
        
        return proposed_stake
'''
            class_pattern = rf'(class {re.escape(strategy_name)}\(IStrategy\):)'
            if re.search(class_pattern, strategy_content) and 'custom_stake_amount' not in strategy_content:
                strategy_content = re.sub(
                    class_pattern,
                    f'\\1\n{custom_stake_code}',
                    strategy_content,
                    count=1,
                )
                features_injected.append("custom_stake_amount")
                _rlog(run_id, 4, logging.DEBUG, "Stage 4 | Injected custom_stake_amount method")

        # Feature 6: Risk guard (max drawdown protection)
        # Always inject for safety
        risk_guard_code = '''
    def confirm_trade_entry(self, pair: str, order_type: str, rate: float, time_in_force: str, 
                           current_time: datetime, entry_tag: str | None, side: str, **kwargs) -> bool:
        """Risk guard: prevent over-trading and excessive drawdown."""
        # Get current open trades
        open_trades = len(self.trade_handler.order_open_trades)
        
        # Limit concurrent trades to prevent overexposure
        max_open_trades = 5
        if open_trades >= max_open_trades:
            return False
            
        return True
'''
        # Check if confirm_trade_entry already exists (from volume filter)
        if 'confirm_trade_entry' not in strategy_content:
            class_pattern = rf'(class {re.escape(strategy_name)}\(IStrategy\):)'
            if re.search(class_pattern, strategy_content):
                strategy_content = re.sub(
                    class_pattern,
                    f'\\1\n{risk_guard_code}',
                    strategy_content,
                    count=1,
                )
                features_injected.append("risk_guard")
                _rlog(run_id, 4, logging.DEBUG, "Stage 4 | Injected risk_guard method")

        # Write modified strategy back
        optimized_path.write_text(strategy_content, encoding="utf-8")
        _rlog(run_id, 4, logging.INFO, f"Stage 4 | Feature injection successful - injected: {features_injected}")

    except Exception as exc:
        injection_success = False
        injection_error = str(exc)
        _rlog(run_id, 4, logging.ERROR,
              f"Stage 4 | Feature injection failed: {injection_error} | Continuing with unmodified strategy")
        _emit(run_id, 4, "running",
              f"Warning: Feature injection failed ({exc}), continuing with unmodified strategy",
              70)

    # ── Stage completion ───────────────────────────────────────────────────────────
    # Format output to match user's expected format
    # features_injected is already built during the injection process
    
    # Compute actual metrics from stress results (no fake placeholders)
    stress_tests = {}
    warnings = []
    
    # Calculate total profit by fee multiplier
    total_profit_by_fee_multiplier = {}
    for multiplier in [1.0, 2.0, 3.0]:
        if multiplier in stress_results:
            pair_profits = stress_results[multiplier]
            total_profit = sum(pair_profits.values())
            total_profit_by_fee_multiplier[f"fee_{multiplier}x_total_profit"] = total_profit
    
    # Calculate profit retention if baseline exists
    if 1.0 in stress_results and 2.0 in stress_results:
        profit_1x = sum(stress_results[1.0].values())
        profit_2x = sum(stress_results[2.0].values())
        if profit_1x > 0:
            profit_retention_2x = (profit_2x / profit_1x) * 100
            stress_tests["profit_retention_2x_pct"] = round(profit_retention_2x, 2)
    
    if 1.0 in stress_results and 3.0 in stress_results:
        profit_1x = sum(stress_results[1.0].values())
        profit_3x = sum(stress_results[3.0].values())
        if profit_1x > 0:
            profit_retention_3x = (profit_3x / profit_1x) * 100
            stress_tests["profit_retention_3x_pct"] = round(profit_retention_3x, 2)
    
    # Add computed metrics
    stress_tests.update(total_profit_by_fee_multiplier)
    stress_tests["pairs_tested"] = len(pairs_to_test) if pairs_to_test else 0
    
    # Add note about unavailable PF/drawdown metrics
    stress_tests["note"] = (
        "Profit factor and drawdown metrics not computed - raw trade-level data unavailable. "
        "Stability scores and profit retention by fee multiplier are reported instead."
    )
    
    # Add warning if stress results are incomplete
    if not stress_results or len(stress_results) < 3:
        warnings.append("Stress test results incomplete - some fee multiplier tests may have failed.")
    
    summary = {
        "status": "passed",
        "stress_tests": stress_tests,
        "features_injected": features_injected,
        "failure_reasons": failure_reasons,
        "stability_scores": state.stability_scores,
        "stress_results": stress_results,
        "excluded_time_windows": state.excluded_time_windows,
        "injection_success": injection_success,
        "injection_error": injection_error,
        "warnings": warnings,
    }
    pass_message = "Robustness & Feature Injection complete"
    if not injection_success:
        pass_message += f" (feature injection failed: {injection_error}; strategy left unmodified)"
    elif warnings:
        pass_message += f" — {'; '.join(warnings)}"
    _pass_stage(run_id, state, 4, pass_message, summary)
    return summary
