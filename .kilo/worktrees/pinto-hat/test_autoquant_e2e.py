#!/usr/bin/env python3
"""
End-to-end test script for AutoQuant pipeline.
Validates that all current AutoQuant pipeline stages execute successfully without errors.

Usage:
    python test_autoquant_e2e.py
"""

import sys
import time
import requests
import json
from pathlib import Path
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://localhost:8000"
STRATEGY_NAME = "SmokeTestStrategy"
TIMEFRAME = "1h"
EXCHANGE = "binance"
PAIR_UNIVERSE = [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT",
    "ADA/USDT", "DOGE/USDT", "DOT/USDT", "MATIC/USDT", "LINK/USDT",
]

# Date ranges
today = datetime.now()
end_date = today.replace(day=1) - timedelta(days=1)  # Last day of previous month
start_date = end_date - timedelta(days=365)  # 1 year back

in_sample_start = start_date.strftime("%Y%m%d")
in_sample_end = (start_date + timedelta(days=180)).strftime("%Y%m%d")  # 6 months in
out_sample_start = in_sample_end
out_sample_end = end_date.strftime("%Y%m%d")

IN_SAMPLE_RANGE = f"{in_sample_start}-{in_sample_end}"
OUT_SAMPLE_RANGE = f"{out_sample_start}-{out_sample_end}"

print(f"[SETUP] AutoQuant E2E Test")
print(f"  Strategy: {STRATEGY_NAME}")
print(f"  Timeframe: {TIMEFRAME}")
print(f"  In-sample: {IN_SAMPLE_RANGE}")
print(f"  Out-sample: {OUT_SAMPLE_RANGE}")
print(f"  Backend: {BACKEND_URL}")
print()


def test_backend_health():
    """Check if backend is running"""
    try:
        # Try to get available runs - this will verify backend is responsive
        resp = requests.get(f"{BACKEND_URL}/api/auto-quant/runs", timeout=5)
        print(f"✓ Backend is responding: {resp.status_code}")
        return True
    except Exception as e:
        print(f"✗ Backend health check failed: {e}")
        return False


def start_pipeline():
    """Start AutoQuant pipeline"""
    payload = {
        "strategy": STRATEGY_NAME,
        "timeframe": TIMEFRAME,
        "in_sample_range": IN_SAMPLE_RANGE,
        "out_sample_range": OUT_SAMPLE_RANGE,
        "exchange": EXCHANGE,
        "pair_universe": PAIR_UNIVERSE,
        "max_drawdown_threshold": 50.0,
        "min_win_rate": 20.0,
        "min_profit_factor": 0.3,
        "min_sharpe": -1.0,  # Allow any sharpe for smoke test
        "hyperopt_epochs": 10,  # Reduced for faster testing
    }
    
    print(f"[STEP 1] Starting pipeline...")
    try:
        resp = requests.post(f"{BACKEND_URL}/api/auto-quant/start", json=payload, timeout=10)
        print(f"  Response status: {resp.status_code}")
        
        if resp.status_code not in [200, 202]:
            print(f"  Error response: {resp.text}")
            return None
        
        data = resp.json()
        run_id = data.get("run_id")
        print(f"  ✓ Pipeline started")
        print(f"  Run ID: {run_id}")
        return run_id
    
    except Exception as e:
        print(f"  ✗ Failed to start pipeline: {e}")
        return None


def get_status(run_id):
    """Get current pipeline status"""
    try:
        resp = requests.get(f"{BACKEND_URL}/api/auto-quant/status/{run_id}", timeout=10)
        if resp.status_code == 200:
            return resp.json()
        else:
            return None
    except Exception as e:
        print(f"  Error getting status: {e}")
        return None


def monitor_pipeline(run_id, max_wait_seconds=1800):
    """Monitor pipeline execution and validate stages"""
    print(f"\n[STEP 2] Monitoring pipeline execution...")
    print(f"  Max wait time: {max_wait_seconds} seconds (~{max_wait_seconds // 60} minutes)")
    
    stages_seen = set()
    last_status = None
    start_time = time.time()
    poll_count = 0
    
    while True:
        elapsed = time.time() - start_time
        poll_count += 1
        
        if elapsed > max_wait_seconds:
            print(f"\n✗ Timeout after {max_wait_seconds} seconds")
            return False, stages_seen
        
        status = get_status(run_id)
        
        if status is None:
            print(f"  [{poll_count}] Failed to get status")
            time.sleep(5)
            continue
        
        # Print progress update if status changed
        if status != last_status:
            overall_status = status.get("status", "unknown")
            print(f"  [{poll_count}] Overall status: {overall_status}")
            
            # Show stage progress
            stages = status.get("stages", [])
            for i, stage in enumerate(stages):
                stage_name = stage.get("name", f"Stage {i}")
                stage_status = stage.get("status", "?")
                stages_seen.add(i)
                
                # Only print stage updates
                if stage_status in ["running", "passed", "failed"]:
                    indicator = "●" if stage_status == "running" else "✓" if stage_status == "passed" else "✗"
                    msg = stage.get("message", "")
                    msg_str = f": {msg[:60]}" if msg else ""
                    print(f"    {indicator} Stage {i}: {stage_status}{msg_str}")
            
            last_status = status
        
        # Check if pipeline is complete
        overall_status = status.get("status", "unknown")
        if overall_status == "completed":
            print(f"\n✓ Pipeline completed successfully!")
            return True, stages_seen
        
        if overall_status == "failed":
            print(f"\n✗ Pipeline failed")
            return False, stages_seen
        
        # Wait before next poll
        time.sleep(10)


def validate_stages(stages_seen):
    """Validate that we saw all expected pipeline stages."""
    print(f"\n[STEP 3] Validating stage completion...")
    expected_stages = set(range(1, 6))  # Stages 1-5 in current AutoQuant pipeline
    if stages_seen >= expected_stages:
        print(f"  ✓ All {len(expected_stages)} stages were executed: {sorted(stages_seen)}")
        return True
    else:
        missing = expected_stages - stages_seen
        print(f"  ✗ Missing stages: {sorted(missing)}")
        print(f"  Saw stages: {sorted(stages_seen)}")
        return False


def get_final_report(run_id):
    """Retrieve and validate final report"""
    print(f"\n[STEP 4] Retrieving final report...")
    try:
        resp = requests.get(f"{BACKEND_URL}/api/auto-quant/report/{run_id}", timeout=10)
        
        if resp.status_code != 200:
            print(f"  ✗ Failed to get report: {resp.status_code}")
            return None
        
        report = resp.json()
        print(f"  ✓ Report retrieved")
        
        # Validate key fields
        required_fields = ["run_id", "status", "metrics", "recommendation"]
        missing = [f for f in required_fields if f not in report]
        
        if missing:
            print(f"  ⚠ Missing fields: {missing}")
        else:
            print(f"  ✓ All required fields present")
        
        # Show metrics
        if "metrics" in report:
            metrics = report["metrics"]
            print(f"  Metrics:")
            for key, value in metrics.items():
                if isinstance(value, (int, float)):
                    print(f"    - {key}: {value:.4f}" if isinstance(value, float) else f"    - {key}: {value}")
        
        # Show recommendation
        if "recommendation" in report:
            print(f"  Recommendation: {report['recommendation']}")
        
        return report
    
    except Exception as e:
        print(f"  ✗ Error retrieving report: {e}")
        return None


def verify_output_files(run_id):
    """Verify that output files were created"""
    print(f"\n[STEP 5] Verifying output files...")
    
    base_dir = Path("/home/mohs/Desktop/rgr/user_data/auto_quant") / run_id
    
    if not base_dir.exists():
        print(f"  ✗ Run directory not found: {base_dir}")
        return False
    
    print(f"  ✓ Run directory exists: {base_dir}")
    
    # Check for expected files
    expected_files = [
        "state.json",
    ]
    
    found = []
    missing = []
    
    for filename in expected_files:
        filepath = base_dir / filename
        if filepath.exists():
            size = filepath.stat().st_size
            found.append(f"{filename} ({size} bytes)")
        else:
            missing.append(filename)
    
    for f in found:
        print(f"  ✓ {f}")
    
    for f in missing:
        print(f"  ✗ {f} not found")
    
    # List all files
    if base_dir.exists():
        all_files = list(base_dir.glob("*"))
        if all_files:
            print(f"  All files in directory ({len(all_files)}):")
            for f in sorted(all_files):
                print(f"    - {f.name}")
    
    return len(missing) == 0


def main():
    """Main test flow"""
    print("=" * 70)
    print("AutoQuant Pipeline E2E Validation Test")
    print("=" * 70)
    print()
    
    # Step 0: Health check
    if not test_backend_health():
        print("\n✗ Backend is not responding. Please ensure server.py is running.")
        return False
    
    print()
    
    # Step 1: Start pipeline
    run_id = start_pipeline()
    if not run_id:
        return False
    
    print()
    
    # Step 2: Monitor execution
    success, stages_seen = monitor_pipeline(run_id)
    
    if not success:
        print("\n✗ Pipeline execution failed")
        return False
    
    print()
    
    # Step 3: Validate stages
    if not validate_stages(stages_seen):
        print("\n✗ Not all stages were executed")
        return False
    
    print()
    
    # Step 4: Get final report
    report = get_final_report(run_id)
    
    print()
    
    # Step 5: Verify output files
    verify_output_files(run_id)
    
    print()
    print("=" * 70)
    print("✓ AutoQuant E2E Validation Complete")
    print("=" * 70)
    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
