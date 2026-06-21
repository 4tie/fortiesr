#!/usr/bin/env python3
"""
Data-Aware Profitable Strategy Discovery Workflow

This script tests existing strategies via backtesting using available historical data
to find profitable ones with at least 1 trade per day. It adapts to available data ranges.

Success Criteria:
- Positive total profit (profit_total > 0)
- At least 1 trade per day on average
- Profit factor >= 1.0
- Maximum drawdown within acceptable limits
"""

import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


class DataAwareStrategyDiscovery:
    """Rapid strategy discovery using available historical data."""
    
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
        
        # Timeframes to test
        self.timeframes = ["5m", "15m", "1h", "4h"]
        
        # Pairs to test (using pairs that have data)
        self.pairs = self.get_pairs_with_data()
        
        # Date ranges based on available data
        self.timeranges = self.get_available_timeranges()
    
    def get_available_strategies(self) -> List[str]:
        """Get list of available strategy files."""
        if not self.strategies_dir.exists():
            return []
        
        strategies = []
        for file in self.strategies_dir.glob("*.py"):
            # Skip backup files and test files
            if "baseline_backup" not in file.name and "backup" not in file.name and "test" not in file.name:
                strategies.append(file.stem)
        
        return sorted(strategies)
    
    def get_pairs_with_data(self) -> List[str]:
        """Get pairs that have available data."""
        data_dir = self.user_data_dir / "data" / "binance"
        pairs = set()
        
        if data_dir.exists():
            for file in data_dir.glob("*-5m.feather"):  # Use 5m as baseline
                # Extract pair name from filename (e.g., "LTC_USDT-5m.feather" -> "LTC/USDT")
                pair_name = file.stem.replace("-5m", "").replace("_", "/")
                pairs.add(pair_name)
        
        # Prioritize the pairs from config
        config_pairs = ["LTC/USDT", "XRP/USDT", "BNB/USDT", "LINK/USDT"]
        available_config_pairs = [p for p in config_pairs if p in pairs]
        
        if available_config_pairs:
            return available_config_pairs
        
        return sorted(list(pairs))[:10]  # Limit to 10 pairs
    
    def get_available_timeranges(self) -> List[str]:
        """Get available timeranges based on data."""
        data_dir = self.user_data_dir / "data" / "binance"
        
        # Check a sample file to determine date range
        sample_files = [
            data_dir / "LTC_USDT-5m.feather",
            data_dir / "XRP_USDT-5m.feather",
            data_dir / "LINK_USDT-5m.feather",
        ]
        
        for sample_file in sample_files:
            if sample_file.exists():
                try:
                    df = pd.read_feather(sample_file)
                    start_date = df["date"].min()
                    end_date = df["date"].max()
                    
                    # Create multiple timeranges from available data
                    start_str = start_date.strftime("%Y%m%d")
                    end_str = end_date.strftime("%Y%m%d")
                    
                    # Split into smaller ranges for faster testing
                    mid_date = start_date + (end_date - start_date) / 2
                    mid_str = mid_date.strftime("%Y%m%d")
                    
                    return [
                        f"{start_str}-{mid_str}",  # First half
                        f"{mid_str}-{end_str}",    # Second half
                        f"{start_str}-{end_str}",  # Full range
                    ]
                except Exception:
                    continue
        
        # Fallback to recent dates
        return ["20240101-20240601", "20240601-20241201"]
    
    def calculate_trades_per_day(
        self, 
        total_trades: int, 
        timerange: str
    ) -> float:
        """Calculate average trades per day from timerange."""
        try:
            # Parse timerange format: YYYYMMDD-YYYYMMDD
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
        # Create temporary output file
        output_dir = self.user_data_dir / "backtest_results" / f"test_{strategy}_{timeframe}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        result_file = output_dir / "result.json"
        
        # Build freqtrade backtest command
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
            # Run backtest
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=str(Path.cwd())
            )
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "error": result.stderr[:500],  # Truncate error message
                    "returncode": result.returncode,
                }
            
            # Try to parse results from the backtest output
            output = result.stdout
            
            # Extract key metrics from output
            metrics = self.parse_backtest_output(output)
            
            # Also try to read the result file if it exists
            json_file = result_file.with_suffix(".json")
            if json_file.exists():
                try:
                    with open(json_file, 'r') as f:
                        json_data = json.load(f)
                        # Merge with parsed metrics
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
            # Look for key metrics in the output
            if "TOTAL PROFIT" in line or "Total profit" in line:
                try:
                    # Extract profit value (usually in USDT)
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
        
        # Calculate trades per day
        trades_per_day = self.calculate_trades_per_day(total_trades, timerange)
        
        # Convert profit to percentage (assuming 100 USDT starting capital)
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
        
        # Check criteria
        is_profitable = (
            profit_pct >= self.min_profit_pct and
            trades_per_day >= self.min_trades_per_day and
            profit_factor >= self.min_profit_factor and
            drawdown_pct <= self.max_drawdown_pct
        )
        
        return is_profitable, result_metrics
    
    def generate_test_config(self, iteration: int) -> Dict[str, Any]:
        """Generate test configuration for iteration."""
        # Cycle through strategies
        strategy = self.available_strategies[iteration % len(self.available_strategies)]
        
        # Cycle through timeframes
        timeframe = self.timeframes[iteration % len(self.timeframes)]
        
        # Cycle through timeranges
        timerange = self.timeranges[iteration % len(self.timeranges)]
        
        return {
            "strategy": strategy,
            "timeframe": timeframe,
            "timerange": timerange,
            "pairs": self.pairs,
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
        
        # Run backtest
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
        
        # Check profitability
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
        print(f"Starting Data-Aware Profitable Strategy Discovery")
        print(f"Available strategies: {len(self.available_strategies)}")
        print(f"Available pairs: {len(self.pairs)}")
        print(f"Available timeranges: {self.timeranges}")
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
        
        if not self.pairs:
            print("ERROR: No pairs with available data")
            return {
                "success": False,
                "error": "No data available",
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
    discovery = DataAwareStrategyDiscovery(
        max_iterations=20,
        min_profit_pct=0.5,
        min_trades_per_day=1.0,
        max_drawdown_pct=30.0,
        min_profit_factor=1.0,
    )
    
    result = discovery.run_discovery_loop()
    
    # Save results to file
    output_file = Path("data_aware_strategy_discovery_results.json")
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
