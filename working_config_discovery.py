#!/usr/bin/env python3
"""
Working Configuration Strategy Discovery

This script uses the known working configuration from existing backtests
to test multiple strategies and find profitable ones with at least 1 trade per day.

Based on successful AIStrategy backtest configuration that generated 551 trades.
"""

import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


class WorkingConfigDiscovery:
    """Strategy discovery using known working configuration."""
    
    def __init__(
        self,
        max_iterations: int = 20,
        min_profit_pct: float = 0.5,
        min_trades_per_day: float = 1.0,
        max_drawdown_pct: float = 30.0,
        min_profit_factor: float = 1.0,
        user_data_dir: str = "user_data",
        config_file: str = "user_data/config.json",
    ):
        self.max_iterations = max_iterations
        self.min_profit_pct = min_profit_pct
        self.min_trades_per_day = min_trades_per_day
        self.max_drawdown_pct = max_drawdown_pct
        self.min_profit_factor = min_profit_factor
        self.user_data_dir = Path(user_data_dir)
        self.config_file = config_file
        self.results_history = []
        
        # Available strategies to test
        self.strategies_dir = self.user_data_dir / "strategies"
        self.available_strategies = self.get_available_strategies()
        
        # Working configuration from successful AIStrategy backtest
        self.working_timerange = "20251222-20260620"
        self.working_timeframe = "5m"
        self.working_pairs = ["AXS/USDT", "FIL/USDT", "WIF/USDT"]
        
        # Alternative pairs to try if needed
        self.alternative_pairs = [
            ["LTC/USDT", "XRP/USDT", "BNB/USDT"],
            ["SOL/USDT", "AVAX/USDT", "LINK/USDT"],
            ["ADA/USDT", "DOGE/USDT", "MATIC/USDT"],
        ]
    
    def get_available_strategies(self) -> List[str]:
        """Get list of available strategy files."""
        if not self.strategies_dir.exists():
            return []
        
        strategies = []
        for file in self.strategies_dir.glob("*.py"):
            if "baseline_backup" not in file.name and "backup" not in file.name and "test" not in file.name:
                strategies.append(file.stem)
        
        return sorted(strategies)
    
    def calculate_trades_per_day(
        self, 
        total_trades: int, 
        timerange: str
    ) -> float:
        """Calculate average trades per day from timerange."""
        try:
            start_str, end_str = timerange.split("-")
            start_date = datetime.strptime(start_str, "%Y%m%d")
            end_date = datetime.strptime(end_str, "%Y%m%d")
            days = (end_date - start_date).days
            if days > 0:
                return total_trades / days
        except Exception:
            pass
        return 0.0
    
    def run_backtest(
        self,
        strategy: str,
        timeframe: str,
        timerange: str,
        pairs: List[str],
    ) -> Dict[str, Any]:
        """Run a single backtest and return results."""
        output_dir = self.user_data_dir / "backtest_results" / f"test_{strategy}_{timeframe}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        result_file = output_dir / "result.json"
        
        cmd = [
            "freqtrade", "backtesting",
            "--config", self.config_file,
            "--strategy", strategy,
            "--timeframe", timeframe,
            "--timerange", timerange,
            "--pairs"] + pairs + [
            "--user-data-dir", str(self.user_data_dir),
            "--export", "trades",
            "--export-filename", str(result_file.with_suffix("")),
            "--no-color",
            "--cache", "none",
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
                cwd=str(Path.cwd())
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": result.stderr[:500],
                    "returncode": result.returncode,
                }
            
            output = result.stdout
            metrics = self.parse_backtest_output(output)
            
            json_file = result_file.with_suffix(".json")
            if json_file.exists():
                try:
                    with open(json_file, 'r') as f:
                        json_data = json.load(f)
                        if "strategy" in json_data:
                            metrics.update(json_data["strategy"])
                except Exception:
                    pass
            
            metrics["success"] = True
            return metrics
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Backtest timed out after 5 minutes",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
    
    def parse_backtest_output(self, output: str) -> Dict[str, Any]:
        """Parse key metrics from freqtrade backtest output."""
        metrics = {
            "profit_total": 0.0,
            "total_trades": 0,
            "profit_factor": 0.0,
            "max_drawdown_account": 0.0,
            "wins": 0,
            "losses": 0,
        }
        
        lines = output.split('\n')
        for line in lines:
            if "TOTAL PROFIT" in line or "Total profit" in line:
                try:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if "USDT" in part or part.replace('.', '').replace('-', '').isdigit():
                            try:
                                metrics["profit_total"] = float(part.replace("USDT", "").replace("$", ""))
                                break
                            except ValueError:
                                continue
                except Exception:
                    pass
            
            elif "Total trades" in line.lower():
                try:
                    parts = line.split()
                    for part in parts:
                        if part.isdigit():
                            metrics["total_trades"] = int(part)
                            break
                except Exception:
                    pass
            
            elif "Profit factor" in line.lower():
                try:
                    parts = line.split()
                    for part in parts:
                        try:
                            val = float(part)
                            if val > 0:
                                metrics["profit_factor"] = val
                                break
                        except ValueError:
                            continue
                except Exception:
                    pass
            
            elif "Max drawdown" in line.lower() or "Drawdown" in line:
                try:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if "%" in part:
                            try:
                                metrics["max_drawdown_account"] = float(part.replace("%", "")) / 100
                                break
                            except ValueError:
                                continue
                except Exception:
                    pass
        
        return metrics
    
    def check_profitability(
        self, 
        metrics: Dict[str, Any],
        timerange: str
    ) -> tuple[bool, Dict[str, Any]]:
        """Check if strategy meets profitability criteria."""
        profit_total = metrics.get("profit_total", 0.0)
        total_trades = metrics.get("total_trades", 0)
        profit_factor = metrics.get("profit_factor", 0.0)
        max_drawdown = metrics.get("max_drawdown_account", 1.0)
        
        trades_per_day = self.calculate_trades_per_day(total_trades, timerange)
        profit_pct = (profit_total / 100.0) * 100 if profit_total != 0 else 0.0
        drawdown_pct = max_drawdown * 100
        
        result_metrics = {
            "profit_pct": profit_pct,
            "total_trades": total_trades,
            "trades_per_day": trades_per_day,
            "profit_factor": profit_factor,
            "drawdown_pct": drawdown_pct,
            "profit_total": profit_total,
        }
        
        is_profitable = (
            profit_pct >= self.min_profit_pct and
            trades_per_day >= self.min_trades_per_day and
            profit_factor >= self.min_profit_factor and
            drawdown_pct <= self.max_drawdown_pct
        )
        
        return is_profitable, result_metrics
    
    def generate_test_config(self, iteration: int) -> Dict[str, Any]:
        """Generate test configuration for iteration."""
        strategy = self.available_strategies[iteration % len(self.available_strategies)]
        
        # Use working configuration
        timeframe = self.working_timeframe
        timerange = self.working_timerange
        
        # Try different pair combinations
        pair_set_index = (iteration // len(self.available_strategies)) % len(self.alternative_pairs)
        pairs = self.alternative_pairs[pair_set_index] if iteration >= len(self.available_strategies) else self.working_pairs
        
        return {
            "strategy": strategy,
            "timeframe": timeframe,
            "timerange": timerange,
            "pairs": pairs,
        }
    
    def run_single_iteration(self, iteration: int) -> Dict[str, Any]:
        """Run a single discovery iteration."""
        print(f"=== Iteration {iteration + 1}/{self.max_iterations} ===")
        
        config = self.generate_test_config(iteration)
        print(f"Testing:")
        print(f"  Strategy: {config['strategy']}")
        print(f"  Timeframe: {config['timeframe']}")
        print(f"  Timerange: {config['timerange']}")
        print(f"  Pairs: {config['pairs']}")
        print()
        
        print("Running backtest...")
        metrics = self.run_backtest(
            config["strategy"],
            config["timeframe"],
            config["timerange"],
            config["pairs"],
        )
        
        if not metrics.get("success"):
            print(f"Backtest failed: {metrics.get('error', 'Unknown error')}")
            return {
                "iteration": iteration + 1,
                "status": "failed",
                "config": config,
                "error": metrics.get("error"),
            }
        
        is_profitable, result_metrics = self.check_profitability(
            metrics,
            config["timerange"]
        )
        
        print(f"Results:")
        print(f"  Profit: {result_metrics['profit_pct']:.2f}%")
        print(f"  Total trades: {result_metrics['total_trades']}")
        print(f"  Trades per day: {result_metrics['trades_per_day']:.2f}")
        print(f"  Profit factor: {result_metrics['profit_factor']:.2f}")
        print(f"  Max drawdown: {result_metrics['drawdown_pct']:.2f}%")
        print(f"  Profitable: {is_profitable}")
        print()
        
        result = {
            "iteration": iteration + 1,
            "status": "completed",
            "config": config,
            "metrics": result_metrics,
            "is_profitable": is_profitable,
            "raw_metrics": metrics,
        }
        
        if is_profitable:
            print(f"✓ SUCCESS: Found profitable strategy in iteration {iteration + 1}")
        
        return result
    
    def run_discovery_loop(self) -> Dict[str, Any]:
        """Run main discovery loop."""
        print(f"Starting Working Configuration Strategy Discovery")
        print(f"Available strategies: {len(self.available_strategies)}")
        print(f"Using working configuration from successful AIStrategy backtest")
        print(f"Success criteria:")
        print(f"  - Profit >= {self.min_profit_pct}%")
        print(f"  - Trades per day >= {self.min_trades_per_day}")
        print(f"  - Profit factor >= {self.min_profit_factor}")
        print(f"  - Max drawdown <= {self.max_drawdown_pct}%")
        print(f"Max iterations: {self.max_iterations}")
        print()
        
        if not self.available_strategies:
            print("ERROR: No strategies found in user_data/strategies/")
            return {
                "success": False,
                "error": "No strategies available",
            }
        
        for iteration in range(self.max_iterations):
            result = self.run_single_iteration(iteration)
            self.results_history.append(result)
            
            if result.get("is_profitable"):
                return {
                    "success": True,
                    "iteration": iteration + 1,
                    "config": result["config"],
                    "metrics": result["metrics"],
                    "raw_metrics": result.get("raw_metrics", {}),
                    "history": self.results_history,
                }
            
            print(f"Strategy did not meet criteria. Continuing to next iteration...")
            print()
        
        print(f"Exceeded max iterations ({self.max_iterations}) without finding profitable strategy")
        return {
            "success": False,
            "max_iterations_reached": True,
            "history": self.results_history,
        }


def main():
    """Main entry point."""
    discovery = WorkingConfigDiscovery(
        max_iterations=30,
        min_profit_pct=0.5,
        min_trades_per_day=1.0,
        max_drawdown_pct=30.0,
        min_profit_factor=1.0,
    )
    
    result = discovery.run_discovery_loop()
    
    output_file = Path("working_config_discovery_results.json")
    output_file.write_text(json.dumps(result, indent=2, default=str))
    print(f"\nResults saved to: {output_file}")
    
    if result.get("success"):
        print("\n=== PROFITABLE STRATEGY FOUND ===")
        print(f"Iteration: {result['iteration']}")
        print(f"Configuration: {json.dumps(result['config'], indent=2)}")
        print(f"Metrics: {json.dumps(result['metrics'], indent=2)}")
        sys.exit(0)
    else:
        print("\n=== NO PROFITABLE STRATEGY FOUND ===")
        print("Review the results file for details on all attempts.")
        sys.exit(1)


if __name__ == "__main__":
    main()
