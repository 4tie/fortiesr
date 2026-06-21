#!/usr/bin/env python3
"""
Profitable Strategy Discovery Workflow

This script runs the AutoQuant pipeline in a loop to discover profitable strategies
with at least 1 trade per day. It systematically tests different configurations
until the success criteria are met.

Success Criteria:
- Positive total profit (profit_total > 0)
- At least 1 trade per day on average
- Profit factor >= 1.0
- Maximum drawdown within acceptable limits
"""

import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import httpx


class ProfitableStrategyDiscovery:
    """Automated strategy discovery workflow."""
    
    def __init__(
        self,
        api_base_url: str = "http://localhost:8000",
        max_iterations: int = 10,
        min_profit_pct: float = 0.5,
        min_trades_per_day: float = 1.0,
        max_drawdown_pct: float = 30.0,
        min_profit_factor: float = 1.0,
    ):
        self.api_base_url = api_base_url
        self.max_iterations = max_iterations
        self.min_profit_pct = min_profit_pct
        self.min_trades_per_day = min_trades_per_day
        self.max_drawdown_pct = max_drawdown_pct
        self.min_profit_factor = min_profit_factor
        self.results_history = []
        
    async def start_pipeline(self, config: Dict[str, Any]) -> str:
        """Start AutoQuant pipeline with given configuration."""
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.api_base_url}/api/auto-quant/start",
                json=config,
            )
            response.raise_for_status()
            data = response.json()
            return data["run_id"]
    
    async def get_pipeline_status(self, run_id: str) -> Dict[str, Any]:
        """Get current pipeline status."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base_url}/api/auto-quant/status/{run_id}",
            )
            response.raise_for_status()
            return response.json()
    
    async def get_pipeline_report(self, run_id: str) -> Dict[str, Any]:
        """Get final pipeline report."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base_url}/api/auto-quant/report/{run_id}",
            )
            response.raise_for_status()
            return response.json()
    
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
    
    def check_profitability(
        self, 
        report: Dict[str, Any],
        timerange: str
    ) -> tuple[bool, Dict[str, Any]]:
        """Check if strategy meets profitability criteria."""
        metrics = {}
        
        # Extract key metrics from report
        delivery = report.get("delivery", {})
        oos_validation = report.get("oos_validation", {})
        sanity = report.get("sanity_backtest", {})
        
        # Use OOS validation results if available, otherwise use sanity backtest
        test_results = oos_validation if oos_validation else sanity
        
        profit_total = test_results.get("profit_total", 0.0)
        total_trades = test_results.get("total_trades", 0)
        profit_factor = test_results.get("profit_factor", 0.0)
        max_drawdown = test_results.get("max_drawdown_account", 1.0)
        
        # Calculate trades per day
        trades_per_day = self.calculate_trades_per_day(total_trades, timerange)
        
        # Convert to percentages
        profit_pct = profit_total * 100
        drawdown_pct = max_drawdown * 100
        
        metrics = {
            "profit_pct": profit_pct,
            "total_trades": total_trades,
            "trades_per_day": trades_per_day,
            "profit_factor": profit_factor,
            "drawdown_pct": drawdown_pct,
        }
        
        # Check criteria
        is_profitable = (
            profit_pct >= self.min_profit_pct and
            trades_per_day >= self.min_trades_per_day and
            profit_factor >= self.min_profit_factor and
            drawdown_pct <= self.max_drawdown_pct
        )
        
        return is_profitable, metrics
    
    async def wait_for_completion(
        self, 
        run_id: str, 
        timeout_seconds: int = 3600
    ) -> Dict[str, Any]:
        """Wait for pipeline completion with timeout."""
        start_time = time.time()
        
        while time.time() - start_time < timeout_seconds:
            status = await self.get_pipeline_status(run_id)
            
            if status["status"] in ["completed", "failed", "interrupted"]:
                return status
            
            print(f"  Pipeline status: {status['status']}, stage: {status.get('current_stage', 'N/A')}")
            await asyncio.sleep(30)
        
        raise TimeoutError(f"Pipeline {run_id} did not complete within {timeout_seconds} seconds")
    
    def generate_config(
        self, 
        iteration: int,
        strategy: str = "GAProfitableStrategy",
        timeframe: str = "1h",
    ) -> Dict[str, Any]:
        """Generate pipeline configuration for iteration."""
        # Rotate through different configurations
        timeframes = ["5m", "15m", "1h", "4h"]
        selected_timeframe = timeframes[iteration % len(timeframes)]
        
        # Adjust hyperopt epochs based on iteration
        epochs = 100 + (iteration * 25)
        
        # Rotate through different loss functions
        loss_functions = [
            "ProfitLockinHyperOptLoss",
            "OnlyProfitHyperOptLoss", 
            "SharpeHyperOptLoss",
            "CalmarHyperOptLoss",
        ]
        selected_loss = loss_functions[iteration % len(loss_functions)]
        
        return {
            "strategy": strategy,
            "timeframe": selected_timeframe,
            "in_sample_range": "20230101-20240101",
            "out_sample_range": "20240101-20241201",
            "exchange": "binance",
            "hyperopt_loss": selected_loss,
            "hyperopt_spaces": ["buy", "sell", "stoploss", "roi"],
            "hyperopt_epochs": epochs,
            "max_drawdown_threshold": self.max_drawdown_pct / 100,
            "min_win_rate": 0.40,
            "min_profit_factor": self.min_profit_factor,
            "min_sharpe": 0.5,
            "min_oos_profit": 0.0,
            "monte_carlo_threshold": 0.35,
            "wfo_enabled": iteration >= 3,  # Enable WFO after 3 iterations
            "wfo_is_months": 3,
            "wfo_oos_months": 1,
            "trading_style": "swing" if selected_timeframe in ["1h", "4h"] else "scalping",
            "risk_profile": "balanced",
            "analysis_depth": "standard" if iteration < 5 else "deep",
        }
    
    async def run_discovery_loop(self) -> Dict[str, Any]:
        """Run main discovery loop."""
        print(f"Starting Profitable Strategy Discovery")
        print(f"Success criteria:")
        print(f"  - Profit >= {self.min_profit_pct}%")
        print(f"  - Trades per day >= {self.min_trades_per_day}")
        print(f"  - Profit factor >= {self.min_profit_factor}")
        print(f"  - Max drawdown <= {self.max_drawdown_pct}%")
        print(f"Max iterations: {self.max_iterations}")
        print()
        
        for iteration in range(self.max_iterations):
            print(f"=== Iteration {iteration + 1}/{self.max_iterations} ===")
            
            config = self.generate_config(iteration)
            print(f"Configuration:")
            print(f"  Strategy: {config['strategy']}")
            print(f"  Timeframe: {config['timeframe']}")
            print(f"  Loss function: {config['hyperopt_loss']}")
            print(f"  Epochs: {config['hyperopt_epochs']}")
            print(f"  WFO enabled: {config['wfo_enabled']}")
            print()
            
            try:
                # Start pipeline
                run_id = await self.start_pipeline(config)
                print(f"Pipeline started: {run_id}")
                
                # Wait for completion
                print("Waiting for pipeline completion...")
                final_status = await self.wait_for_completion(run_id)
                print(f"Pipeline completed with status: {final_status['status']}")
                
                if final_status["status"] != "completed":
                    print(f"Pipeline failed or interrupted. Trying next iteration...")
                    self.results_history.append({
                        "iteration": iteration + 1,
                        "run_id": run_id,
                        "status": "failed",
                        "config": config,
                    })
                    continue
                
                # Get report and check profitability
                report = await self.get_pipeline_report(run_id)
                is_profitable, metrics = self.check_profitability(
                    report, 
                    config["out_sample_range"]
                )
                
                print(f"Results:")
                print(f"  Profit: {metrics['profit_pct']:.2f}%")
                print(f"  Total trades: {metrics['total_trades']}")
                print(f"  Trades per day: {metrics['trades_per_day']:.2f}")
                print(f"  Profit factor: {metrics['profit_factor']:.2f}")
                print(f"  Max drawdown: {metrics['drawdown_pct']:.2f}%")
                print(f"  Profitable: {is_profitable}")
                print()
                
                self.results_history.append({
                    "iteration": iteration + 1,
                    "run_id": run_id,
                    "status": "completed",
                    "config": config,
                    "metrics": metrics,
                    "is_profitable": is_profitable,
                    "report": report,
                })
                
                if is_profitable:
                    print(f"✓ SUCCESS: Found profitable strategy in iteration {iteration + 1}")
                    return {
                        "success": True,
                        "iteration": iteration + 1,
                        "run_id": run_id,
                        "config": config,
                        "metrics": metrics,
                        "report": report,
                        "history": self.results_history,
                    }
                
                print(f"Strategy did not meet criteria. Continuing to next iteration...")
                print()
                
            except Exception as e:
                print(f"Error in iteration {iteration + 1}: {e}")
                self.results_history.append({
                    "iteration": iteration + 1,
                    "status": "error",
                    "error": str(e),
                    "config": config,
                })
                print()
                continue
        
        print(f"Exceeded max iterations ({self.max_iterations}) without finding profitable strategy")
        return {
            "success": False,
            "max_iterations_reached": True,
            "history": self.results_history,
        }


async def main():
    """Main entry point."""
    discovery = ProfitableStrategyDiscovery(
        max_iterations=10,
        min_profit_pct=0.5,
        min_trades_per_day=1.0,
        max_drawdown_pct=30.0,
        min_profit_factor=1.0,
    )
    
    result = await discovery.run_discovery_loop()
    
    # Save results to file
    output_file = Path("profitable_strategy_discovery_results.json")
    output_file.write_text(json.dumps(result, indent=2, default=str))
    print(f"\nResults saved to: {output_file}")
    
    if result.get("success"):
        print("\n=== PROFITABLE STRATEGY FOUND ===")
        print(f"Iteration: {result['iteration']}")
        print(f"Run ID: {result['run_id']}")
        print(f"Configuration: {json.dumps(result['config'], indent=2)}")
        print(f"Metrics: {json.dumps(result['metrics'], indent=2)}")
        sys.exit(0)
    else:
        print("\n=== NO PROFITABLE STRATEGY FOUND ===")
        print("Review the results file for details on all attempts.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
