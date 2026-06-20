"""Tests for the AutoQuant Freqtrade deployment export endpoint."""

from __future__ import annotations

import asyncio
import json
import re
import zipfile
from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.api.routers.auto_quant import export_pipeline
from .test_helpers import _make_state


def _run(coro):
    return asyncio.run(coro)


def _completed_export_state(root, strategy: str = "ExportStrategy"):
    user_data = root / "user_data"
    user_data.mkdir(parents=True, exist_ok=True)

    state = _make_state(str(user_data), strategy=strategy, status="completed")
    run_dir = user_data / "auto_quant" / state.run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    strategy_file = run_dir / f"{strategy}_Optimized.py"
    config_file = run_dir / "config.json"
    report_file = run_dir / "report.json"
    params_file = run_dir / f"{strategy}_Optimized.json"
    state_file = run_dir / "state_latest.json"

    strategy_file.write_text(f"class {strategy}_Optimized: pass\n", encoding="utf-8")
    config_file.write_text(json.dumps({"exchange": {"name": "binance"}}), encoding="utf-8")
    params_file.write_text(json.dumps({"params": {"buy": {}}}), encoding="utf-8")

    report = {
        "run_id": state.run_id,
        "strategy": strategy,
        "files": {
            "optimized_strategy": strategy_file.name,
            "config": config_file.name,
            "report": report_file.name,
            "params_json": params_file.name,
        },
    }
    report_file.write_text(json.dumps(report), encoding="utf-8")
    state_file.write_text(json.dumps({"run_id": state.run_id, "status": "completed"}), encoding="utf-8")

    state.report = report
    state.artifact_versions = {"state_latest": state_file.name}
    return state


def test_export_rejects_non_completed(tmp_path):
    state = _make_state(str(tmp_path / "user_data"), status="pending", report={"files": {}})

    with pytest.raises(HTTPException) as exc_info:
        _run(export_pipeline(state.run_id))

    assert exc_info.value.status_code == 409


def test_export_unknown_run():
    with pytest.raises(HTTPException) as exc_info:
        _run(export_pipeline("fake-id"))

    assert exc_info.value.status_code == 404


def test_export_zip_contains_expected_files(tmp_path):
    state = _completed_export_state(tmp_path)
    response = _run(export_pipeline(state.run_id))

    assert response.media_type == "application/zip"

    with zipfile.ZipFile(Path(response.path)) as bundle:
        names = set(bundle.namelist())

    assert "ExportStrategy_Optimized.py" in names
    assert "config.json" in names
    assert "report.json" in names


def test_export_zip_filename_format(tmp_path):
    state = _completed_export_state(tmp_path, strategy="FormatStrategy")

    response = _run(export_pipeline(state.run_id))

    content_disposition = response.headers.get("content-disposition", "")
    assert re.search(
        r'filename="?FormatStrategy_\d{8}_\d{6}\.zip"?',
        content_disposition,
    )
