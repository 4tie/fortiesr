#!/usr/bin/env python3
"""
Profitable Strategy Discovery Workflow (Direct Pipeline Access)

This script runs the AutoQuant pipeline directly without HTTP API,
systematically testing different configurations until a profitable strategy
with at least 1 trade per day is found.

Success Criteria:
- Positive total profit (profit_total > 0)
- At least 1 trade per day on average
- Profit factor >= 1.0
- Maximum drawdown within acceptable limits
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.services.auto_quant import pipeline as auto_quant_pipeline
from backend.services.auto_quant.policy import build_run_config, load_policy


class ProfitableStrategyDiscovery:
    """Automated strategy discovery workflow using direct pipeline access."""
    
    def __init__(
        self,
        max_iterations: int = 10,
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
    
    def generate_config(
        self, 
        iteration: int,
        strategy: str = "GAProfitableStrategy",
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
            "config_file": self.config_file,
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
    
    async def run_single_iteration(self, iteration: int) -> Dict[str, Any]:
        """Run a single pipeline iteration."""
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
            # Build run config using policy
            run_config = build_run_config(payload=config, settings=None)
            
            # Create pipeline run
            run_id = auto_quant_pipeline.create_run(
                strategy=run_config["strategy"],
                timeframe=run_config["timeframe"],
                in_sample_range=run_config["in_sample_range"],
                out_sample_range=run_config["out_sample_range"],
                exchange=run_config["exchange"],
                config_file=run_config["config_file"],
                freqtrade_path="freqtrade",
                user_data_dir=str(self.user_data_dir),
                max_drawdown_threshold=run_config["thresholds"]["max_drawdown"],
                min_win_rate=run_config["thresholds"]["min_win_rate"],
                min_profit_factor=run_config["thresholds"]["min_profit_factor"],
                min_sharpe=run_config["thresholds"]["min_sharpe"],
                min_oos_profit=run_config["thresholds"]["min_oos_profit"],
                monte_carlo_threshold=run_config["thresholds"]["monte_carlo_threshold"],
                hyperopt_loss=run_config["hyperopt_loss"],
                hyperopt_spaces=run_config["hyperopt_spaces"],
                hyperopt_epochs=run_config["hyperopt_epochs"],
                hyperopt_workers=1,
                wfo_enabled=run_config["wfo_enabled"],
                wfo_is_months=run_config["wfo_is_months"],
                wfo_oos_months=run_config["wfo_oos_months"],
                wfo_recency_weight=run_config.get("wfo_recency_weight", 1.0),
                ensemble_enabled=run_config.get("ensemble_enabled", False),
                pair=run_config.get("pair"),
                pair_universe=run_config.get("pair_universe"),
                strategy_source=run_config.get("strategy_source", "existing"),
                trading_style=run_config.get("trading_style"),
                risk_profile=run_config.get("risk_profile"),
                analysis_depth=run_config.get("analysis_depth"),
                uploaded_strategy_id=run_config.get("uploaded_strategy_id"),
                advanced_overrides=run_config.get("advanced_overrides", {}),
                auto_discovery_enabled=True,
                validation_notes=run_config.get("validation_notes", []),
                run_config_snapshot=run_config,
                policy_versions=run_config.get("policy_versions", {}),
                selected_timeframe=run_config.get("timeframe"),
                selected_pair_universe=run_config.get("pair_universe"),
            )
            
            print(f"Pipeline started: {run_id}")
            
            # Run pipeline
            await auto_quant_pipeline.run_pipeline(run_id)
            
            # Get final state
            state = auto_quant_pipeline.get_state(run_id)
            
            if state is None:
                raise Exception(f"Pipeline state not found for run_id: {run_id}")
            
            print(f"Pipeline completed with status: {state.status}")
            
            if state.status != "completed":
                print(f"Pipeline failed or interrupted. Trying next iteration...")
                return {
                    "iteration": iteration + 1,
                    "run_id": run_id,
                    "status": "failed",
                    "config": config,
                    "pipeline_status": state.status,
                }
            
            # Get report
            report = state.report if state.report else {}
            
            # Check profitability
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
            
            result = {
                "iteration": iteration + 1,
                "run_id": run_id,
                "status": "completed",
                "config": config,
                "metrics": metrics,
                "is_profitable": is_profitable,
                "report": report,
                "pipeline_status": state.status,
            }
            
            if is_profitable:
                print(f"✓ SUCCESS: Found profitable strategy in iteration {iteration + 1}")
            
            return result
            
        except Exception as e:
            print(f"Error in iteration {iteration + 1}: {e}")
            import traceback
            traceback.print_exc()
            return {
                "iteration": iteration + 1,
                "status": "error",
                "error": str(e),
                "config": config,
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
            result = await self.run_single_iteration(iteration)
            self.results_history.append(result)
            
            if result.get("is_profitable"):
                return {
                    "success": True,
                    "iteration": iteration + 1,
                    "run_id": result["run_id"],
                    "config": result["config"],
                    "metrics": result["metrics"],
                    "report": result.get("report", {}),
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
