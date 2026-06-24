#!/usr/bin/env python3
"""
Hermes Integration Smoke Test

Tests the end-to-end workflow for Hermes Strategy Designer integration:
1. Test Backend Endpoint with valid payload
2. Validate Generated Spec with strict_validation=True
3. Test Strategy Code Generation with render_strategy_from_spec
4. Test Candidate Workflow Integration end-to-end
5. Verify Final Result with metrics and verdict
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx
from pydantic import ValidationError

# Add project root to path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.models.strategy_spec import StrategySpec, validate_spec
from backend.services.strategy.strategy_code_writer import render_strategy_from_spec

# Configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 120  # seconds


async def test_backend_endpoint():
    """Test POST /api/auto-quant/generate-strategy-spec with valid payload."""
    print("\n" + "="*70)
    print("TEST 1: Backend Endpoint")
    print("="*70)
    
    payload = {
        "trading_style": "swing",
        "direction": "long",
        "risk_profile": "balanced",
        "timeframe_preference": "5m",
        "user_notes": "Test smoke test strategy"
    }
    
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{BASE_URL}/api/auto-quant/generate-strategy-spec",
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        
        print(f"Status Code: {response.status_code}")
        print(f"Errors: {data.get('errors', [])}")
        
        if data.get("spec"):
            print("✓ Spec generated successfully")
            print(f"Spec keys: {list(data['spec'].keys())}")
            return data["spec"], data.get("raw_response", "")
        else:
            print("✗ No spec generated")
            print(f"Raw response: {data.get('raw_response', '')[:500]}")
            return None, data.get("raw_response", "")


async def test_validate_spec(spec_dict):
    """Validate Generated Spec with strict_validation=True."""
    print("\n" + "="*70)
    print("TEST 2: Validate Generated Spec")
    print("="*70)
    
    if not spec_dict:
        print("✗ No spec to validate (skipping)")
        return None
    
    try:
        spec = StrategySpec(**spec_dict)
        print(f"✓ StrategySpec parsed successfully")
        print(f"  Name: {spec.name}")
        print(f"  Direction: {spec.direction}")
        print(f"  Timeframe: {spec.timeframe}")
        print(f"  Trading Style: {spec.trading_style}")
        print(f"  Indicators: {len(spec.indicators)}")
        print(f"  Entry Conditions: {len(spec.entry_conditions)}")
        print(f"  Exit Conditions: {len(spec.exit_conditions)}")
        
        # Strict validation
        errors = validate_spec(spec, strict_validation=True)
        if errors:
            print(f"✗ Strict validation failed with errors:")
            for error in errors:
                print(f"  - {error}")
            return None
        else:
            print("✓ Strict validation passed")
            return spec
    except ValidationError as e:
        print(f"✗ Pydantic validation error: {e}")
        return None


async def test_strategy_code_generation(spec):
    """Test Strategy Code Generation with render_strategy_from_spec."""
    print("\n" + "="*70)
    print("TEST 3: Strategy Code Generation")
    print("="*70)
    
    if not spec:
        print("✗ No spec to generate code from (skipping)")
        return None
    
    try:
        result = render_strategy_from_spec(spec)
        print(f"✓ Strategy code generated")
        print(f"  Warnings: {result.get('warnings', [])}")
        print(f"  Source length: {len(result.get('source', ''))} characters")
        
        # Check that core fields are applied
        source = result.get('source', '')
        checks = {
            'timeframe': spec.timeframe in source,
            'stoploss': str(spec.stoploss) in source,
            'roi': 'roi' in source.lower(),
            'direction': spec.direction in source.lower() if spec.direction else True,
        }
        
        print("\nCore field application:")
        for field, applied in checks.items():
            status = "✓" if applied else "✗"
            print(f"  {status} {field}: {'applied' if applied else 'NOT applied'}")
        
        return result
    except Exception as e:
        print(f"✗ Code generation error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_candidate_workflow(spec_dict):
    """Test Candidate Workflow Integration end-to-end."""
    print("\n" + "="*70)
    print("TEST 4: Candidate Workflow Integration")
    print("="*70)
    
    if not spec_dict:
        print("✗ No spec to test workflow with (skipping)")
        return None
    
    # First, we need to generate the strategy file from the spec
    try:
        spec = StrategySpec(**spec_dict)
        result = render_strategy_from_spec(spec)
        strategy_source = result.get('source', '')
        
        # Save strategy to file
        from backend.core.config import settings
        strategies_dir = Path(settings.strategies_directory_path)
        strategies_dir.mkdir(parents=True, exist_ok=True)
        
        strategy_name = spec.name
        strategy_path = strategies_dir / f"{strategy_name}.py"
        
        # Check if already exists
        if strategy_path.exists():
            print(f"Strategy file already exists: {strategy_path}")
            print("Using existing file for workflow test")
        else:
            strategy_path.write_text(strategy_source, encoding='utf-8')
            print(f"✓ Strategy saved to: {strategy_path}")
        
        # Start a pipeline run with the generated strategy
        pipeline_payload = {
            "strategy": strategy_name,
            "strategy_source": "generated",
            "generated_by": "hermes",
            "trading_style": spec.trading_style,
            "risk_profile": "balanced",  # Default for smoke test
            "analysis_depth": "quick",  # Use quick for smoke test
            "timeframe": spec.timeframe,
            "in_sample_range": "20240624-20251224",
            "out_sample_range": "20251224-20260624",
            "exchange": "binance",
        }
        
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{BASE_URL}/api/auto-quant/start",
                json=pipeline_payload
            )
            response.raise_for_status()
            data = response.json()
            
            print(f"✓ Pipeline started")
            print(f"  Run ID: {data['run_id']}")
            print(f"  Status: {data['status']}")
            print(f"  Message: {data['message']}")
            
            return data['run_id']
    except Exception as e:
        print(f"✗ Workflow test error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def monitor_pipeline(run_id):
    """Monitor pipeline progress and check final result."""
    print("\n" + "="*70)
    print("TEST 5: Monitor Pipeline Progress")
    print("="*70)
    
    if not run_id:
        print("✗ No run_id to monitor (skipping)")
        return None
    
    print(f"Monitoring run {run_id}...")
    print("(This may take several minutes for quick analysis depth)")
    
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Poll for status
        max_polls = 60  # 5 minutes max
        for i in range(max_polls):
            response = await client.get(f"{BASE_URL}/api/auto-quant/status/{run_id}")
            response.raise_for_status()
            data = response.json()
            
            status = data.get('status')
            current_stage = data.get('current_stage')
            stages = data.get('stages', [])
            
            print(f"  Poll {i+1}: Status={status}, Stage={current_stage}")
            
            # Print stage statuses
            for stage in stages:
                stage_status = stage.get('status')
                if stage_status in ['running', 'passed', 'failed']:
                    print(f"    - Stage {stage.get('index')} ({stage.get('name')}): {stage_status}")
            
            if status in ['completed', 'failed', 'interrupted']:
                print(f"\n✓ Pipeline finished with status: {status}")
                
                # Get final report
                try:
                    report_response = await client.get(f"{BASE_URL}/api/auto-quant/report/{run_id}")
                    if report_response.status_code == 200:
                        report = report_response.json()
                        print("\nFinal Report Summary:")
                        print(f"  Strategy: {report.get('strategy')}")
                        print(f"  Status: {report.get('status')}")
                        print(f"  Verdict: {report.get('verdict', 'N/A')}")
                        
                        # Print metrics if available
                        metrics = report.get('metrics', {})
                        if metrics:
                            print("\nMetrics:")
                            for key, value in metrics.items():
                                print(f"  {key}: {value}")
                        
                        return report
                except Exception as e:
                    print(f"Could not fetch report: {e}")
                
                return data
            
            await asyncio.sleep(5)
        
        print("✗ Pipeline monitoring timed out")
        return None


async def main():
    """Run all smoke tests."""
    print("\n" + "="*70)
    print("HERMES INTEGRATION SMOKE TEST")
    print("="*70)
    
    # Test 1: Backend Endpoint
    spec_dict, raw_response = await test_backend_endpoint()
    
    # Test 2: Validate Spec
    spec = await test_validate_spec(spec_dict)
    
    # Test 3: Code Generation
    code_result = await test_strategy_code_generation(spec)
    
    # Test 4: Candidate Workflow (optional - can be long-running)
    run_id = None
    if spec_dict:
        print("\n" + "="*70)
        print("OPTIONAL: Candidate Workflow Test")
        print("This test can take several minutes. Press Ctrl+C to skip.")
        print("="*70)
        try:
            run_id = await test_candidate_workflow(spec_dict)
        except KeyboardInterrupt:
            print("\nSkipping workflow test per user request")
    
    # Test 5: Monitor Pipeline (if workflow was started)
    final_report = None
    if run_id:
        try:
            final_report = await monitor_pipeline(run_id)
        except KeyboardInterrupt:
            print("\nSkipping pipeline monitoring per user request")
    
    # Summary
    print("\n" + "="*70)
    print("SMOKE TEST SUMMARY")
    print("="*70)
    
    results = {
        "Backend Endpoint": spec_dict is not None,
        "Validate Spec": spec is not None,
        "Code Generation": code_result is not None,
        "Candidate Workflow": run_id is not None,
        "Pipeline Monitoring": final_report is not None,
    }
    
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    print("\n" + "="*70)
    if all_passed:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
    print("="*70)
    
    return all_passed


if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
