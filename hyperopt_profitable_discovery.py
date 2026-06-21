#!/usr/bin/env python3
"""
Hyperopt-Based Profitable Strategy Discovery

This script uses hyperparameter optimization to find profitable strategies.
It starts with strategies that can generate trades and optimizes their parameters
to achieve profitability with at least 1 trade per day.
"""

import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


class HyperoptProfitableDiscovery:
    """Strategy discovery using hyperparameter optimization."""
    
    def __init__(
        self,
        max_iterations: int = 15,
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
        
        # Strategies to test (prioritize ones that generated trades in previous tests)
        self.priority_strategies = ["AIStrategy", "EnsembleFactory", "MomentumRobust"]
        
        # Available strategies
        self.strategies_dir = self.user_data_dir / "strategies"
        self.available_strategies = self.get_available_strategies()
        
        # Working configuration
        self.working_timerange = "20251222-20260620"
        self.working_timeframes = ["5m", "15m", "1h"]
        self.working_pairs = ["AXS/USDT", "FIL/USDT", "WIF/USDT"]
        
        # Hyperopt configurations
        self.hyperopt_epochs = 100
        self.hyperopt_spaces = ["buy", "sell", "stoploss", "roi"]
        self.hyperopt_loss_functions = [
            "ProfitLockinHyperOptLoss",
            "OnlyProfitHyperOptLoss",
            "SharpeHyperOptLoss",
            "CalmarHyperOptLoss",
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
    
    def run_hyperopt(
        self,
        strategy: str,
        timeframe: str,
        timerange: str,
        pairs: List[str],
        hyperopt_loss: str,
        epochs: int,
    ) -> Dict[str, Any]:
        """Run hyperopt optimization for a strategy."""
        output_dir = self.user_data_dir / "backtest_results" / f"hyperopt_{strategy}_{timeframe}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            "freqtrade", "hyperopt",
            "--config", self.config_file,
            "--strategy", strategy,
            "--timeframe", timeframe,
            "--timerange", timerange,
            "--pairs"] + pairs + [
            "--user-data-dir", str(self.user_data_dir),
            "--hyperopt-loss", hyperopt_loss,
            "--spaces"] + self.hyperopt_spaces + [
            "--epochs", str(epochs),
            "--no-color",
            "--cache", "none",
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,  # 10 minute timeout for hyperopt
                cwd=str(Path.cwd())
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": result.stderr[:500],
                    "returncode": result.returncode,
                }
            
            # Parse hyperopt results
            metrics = self.parse_hyperopt_output(result.stdout)
            
            metrics["success"] = True
            return metrics
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Hyperopt timed out after 10 minutes",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
    
    def parse_hyperopt_output(self, output: str) -> Dict[str, Any]:
        """Parse key metrics from freqtrade hyperopt output."""
        metrics = {
            "profit_total": 0.0,
            "total_trades": 0,
            "profit_factor": 0.0,
            "max_drawdown_account": 0.0,
            "best_epoch": 0,
        }
        
        lines = output.split('\n')
        for line in lines:
            if "Best result" in line or "Best epoch" in line:
                try:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part.replace('.', '').replace('-', '').isdigit():
                            try:
                                val = float(part)
                                if i > 0 and "profit" in parts[i-1].lower():
                                    metrics["profit_total"] = val
                                elif i > 0 and "trades" in parts[i-1].lower():
                                    metrics["total_trades"] = int(val)
                                break
                            except ValueError:
                                continue
                except Exception:
                    pass
            
            elif "Total profit" in line.lower():
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
        # Prioritize strategies that showed promise
        if iteration < len(self.priority_strategies):
            strategy = self.priority_strategies[iteration]
        else:
            strategy = self.available_strategies[iteration % len(self.available_strategies)]
        
        timeframe = self.working_timeframes[iteration % len(self.working_timeframes)]
        timerange = self.working_timerange
        pairs = self.working_pairs
        hyperopt_loss = self.hyperopt_loss_functions[iteration % len(self.hyperopt_loss_functions)]
        epochs = self.hyperopt_epochs + (iteration * 25)  # Increase epochs with iterations
        
        return {
            "strategy": strategy,
            "timeframe": timeframe,
            "timerange": timerange,
            "pairs": pairs,
            "hyperopt_loss": hyperopt_loss,
            "epochs": epochs,
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
        print(f"  Hyperopt loss: {config['hyperopt_loss']}")
        print(f"  Epochs: {config['epochs']}")
        print()
        
        print("Running hyperopt optimization...")
        metrics = self.run_hyperopt(
            config["strategy"],
            config["timeframe"],
            config["timerange"],
            config["pairs"],
            config["hyperopt_loss"],
            config["epochs"],
        )
        
        if not metrics.get("success"):
            print(f"Hyperopt failed: {metrics.get('error', 'Unknown error')}")
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
        print(f"Starting Hyperopt-Based Profitable Strategy Discovery")
        print(f"Available strategies: {len(self.available_strategies)}")
        print(f"Priority strategies: {self.priority_strategies}")
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
    discovery = HyperoptProfitableDiscovery(
        max_iterations=15,
        min_profit_pct=0.5,
        min_trades_per_day=1.0,
        max_drawdown_pct=30.0,
        min_profit_factor=1.0,
    )
    
    result = discovery.run_discovery_loop()
    
    output_file = Path("hyperopt_profitable_discovery_results.json")
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
