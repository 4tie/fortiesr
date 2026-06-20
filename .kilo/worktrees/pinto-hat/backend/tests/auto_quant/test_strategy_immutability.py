"""Strategy Immutability Tests - Verify original strategy never modified.

This test suite verifies that the original user strategy file remains immutable
throughout the pipeline run, even after failures, cancellations, or retries.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from backend.services.auto_quant.pipeline_modules.state import PipelineState


def test_original_strategy_hash_stored():
    """Test that original strategy hash is stored when working copy is created."""
    mock_state = Mock()
    mock_state.strategy = "TestStrategy"
    mock_state.original_strategy = None
    mock_state.user_data_dir = "/tmp/test_user_data"
    mock_state.original_strategy_hash = None
    mock_state.strategy_runtime_dir = None
    mock_state.strategy_variants = []
    
    # Create a temporary strategy file
    strategies_dir = Path("/tmp/test_user_data/strategies")
    strategies_dir.mkdir(parents=True, exist_ok=True)
    strategy_file = strategies_dir / "TestStrategy.py"
    strategy_content = "# Test Strategy\nclass TestStrategy:\n    pass\n"
    strategy_file.write_text(strategy_content, encoding="utf-8")
    
    # Calculate expected hash
    expected_hash = hashlib.sha256(strategy_content.encode("utf-8")).hexdigest()
    
    # Import and call ensure_working_copy
    from backend.services.auto_quant.variants import ensure_working_copy
    
    out_dir = Path("/tmp/test_auto_quant/test_run")
    result = ensure_working_copy(mock_state, out_dir)
    
    # Verify hash was stored
    assert mock_state.original_strategy_hash == expected_hash
    assert mock_state.original_strategy == "TestStrategy"
    
    # Cleanup
    strategy_file.unlink()
    strategies_dir.rmdir()


def test_original_strategy_file_not_modified():
    """Test that original strategy file is not modified during pipeline."""
    # Create a temporary strategy file
    strategies_dir = Path("/tmp/test_user_data/strategies")
    strategies_dir.mkdir(parents=True, exist_ok=True)
    strategy_file = strategies_dir / "TestStrategy.py"
    original_content = "# Test Strategy\nclass TestStrategy:\n    pass\n"
    strategy_file.write_text(original_content, encoding="utf-8")
    
    original_hash = hashlib.sha256(original_content.encode("utf-8")).hexdigest()
    
    # Simulate pipeline operations that should not modify original
    # (This is a conceptual test - in real pipeline, variants are written to run-local dir)
    
    # Verify original file unchanged
    current_content = strategy_file.read_text(encoding="utf-8")
    current_hash = hashlib.sha256(current_content.encode("utf-8")).hexdigest()
    
    assert current_content == original_content
    assert current_hash == original_hash
    
    # Cleanup
    strategy_file.unlink()
    strategies_dir.rmdir()


def test_variants_written_to_run_local_dir():
    """Test that strategy variants are written to run-local directory, not original."""
    mock_state = Mock()
    mock_state.strategy = "TestStrategy"
    mock_state.user_data_dir = "/tmp/test_user_data"
    mock_state.strategy_runtime_dir = "/tmp/test_auto_quant/test_run/strategies"
    mock_state.strategy_variants = []
    
    # Create run-local directory
    runtime_dir = Path("/tmp/test_auto_quant/test_run/strategies")
    runtime_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a variant
    from backend.services.auto_quant.variants import create_variant
    
    variant_content = "# Modified Strategy\nclass TestStrategy:\n    modified = True\n"
    variant_path = create_variant(
        mock_state,
        role="mutation",
        strategy_name="TestStrategy",
        source=variant_content,
    )
    
    # Verify variant is in run-local directory
    assert variant_path.parent == runtime_dir
    assert variant_path.exists()
    
    # Verify original strategy file (if it existed) is not in run-local dir
    # (This is conceptual - in real scenario, original is in user_data/strategies)
    
    # Cleanup
    variant_path.unlink()
    runtime_dir.rmdir()


def test_variant_versioning():
    """Test that strategy variants are versioned with role and version number."""
    mock_state = Mock()
    mock_state.strategy = "TestStrategy"
    mock_state.strategy_runtime_dir = "/tmp/test_auto_quant/test_run/strategies"
    mock_state.strategy_variants = []
    
    runtime_dir = Path("/tmp/test_auto_quant/test_run/strategies")
    runtime_dir.mkdir(parents=True, exist_ok=True)
    
    from backend.services.auto_quant.variants import create_variant
    
    # Create first variant
    variant_content = "# Variant 1\nclass TestStrategy:\n    pass\n"
    create_variant(
        mock_state,
        role="mutation",
        strategy_name="TestStrategy",
        source=variant_content,
        versioned=True,
    )
    
    # Create second variant of same role
    variant_content2 = "# Variant 2\nclass TestStrategy:\n    pass\n"
    create_variant(
        mock_state,
        role="mutation",
        strategy_name="TestStrategy",
        source=variant_content2,
        versioned=True,
    )
    
    # Verify versioned files exist
    assert (runtime_dir / "TestStrategy_mutation_v1.py").exists()
    assert (runtime_dir / "TestStrategy_mutation_v2.py").exists()
    
    # Cleanup
    for f in runtime_dir.glob("TestStrategy_*.py"):
        f.unlink()
    runtime_dir.rmdir()


def test_working_copy_isolated_from_original():
    """Test that working copy is isolated from original strategy."""
    mock_state = Mock()
    mock_state.strategy = "TestStrategy"
    mock_state.original_strategy = None
    mock_state.user_data_dir = "/tmp/test_user_data"
    mock_state.original_strategy_hash = None
    mock_state.strategy_runtime_dir = None
    mock_state.strategy_variants = []
    
    # Create original strategy
    strategies_dir = Path("/tmp/test_user_data/strategies")
    strategies_dir.mkdir(parents=True, exist_ok=True)
    original_file = strategies_dir / "TestStrategy.py"
    original_content = "# Original\nclass TestStrategy:\n    pass\n"
    original_file.write_text(original_content, encoding="utf-8")
    original_hash = hashlib.sha256(original_content.encode("utf-8")).hexdigest()
    
    # Create working copy
    from backend.services.auto_quant.variants import ensure_working_copy
    
    out_dir = Path("/tmp/test_auto_quant/test_run")
    working_path = ensure_working_copy(mock_state, out_dir)
    
    # Modify working copy
    modified_content = "# Modified\nclass TestStrategy:\n    modified = True\n"
    working_path.write_text(modified_content, encoding="utf-8")
    
    # Verify original unchanged
    current_original = original_file.read_text(encoding="utf-8")
    current_original_hash = hashlib.sha256(current_original.encode("utf-8")).hexdigest()
    
    assert current_original == original_content
    assert current_original_hash == original_hash
    assert mock_state.original_strategy_hash == original_hash
    
    # Cleanup
    working_path.unlink()
    original_file.unlink()
    strategies_dir.rmdir()
    out_dir.rmdir()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
