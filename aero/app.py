r"""aero/app.py is the AeRo FastAPI micro-app."""

from __future__ import annotations

import io
import os
import threading
import webbrowser
import base64
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from aero.backend_api import find_source_text, list_backtest_runs, read_backtest_result
from aero.doctor import Analyze
from aero.fixer import apply_baseline
from aero.models import BacktestVisit, Finding


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
UPLOAD_DIR = ROOT / "uploads"


app = FastAPI(title="AeRo", description="Strategy doctor for Fortiesr")


@app.on_event("startup")
async def _log_routes():
    routes = [r.path for r in app.routes]
    print("AERO_ROUTES=" + repr(routes))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/aero/static", StaticFiles(directory=str(STATIC_DIR)), name="aero-static")


class AnalyzeRequest(BaseModel):
    run_id: str
    source_code: Optional[str] = None


@app.get("/api/aero/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "app": "Aero"})


@app.get("/api/aero/latest-run")
async def latest_run() -> JSONResponse:
    runs = list_backtest_runs()
    latest = runs[0]["run_id"] if runs else None
    return JSONResponse({"latest_run_id": latest, "runs": runs[:20]})


@app.post("/api/aero/upload")
async def upload_strategy(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=422, detail="Expected JSON body")

    filename = str(body.get("filename") or "strategy.py").strip()
    if not filename.endswith(".py"):
        filename = f"{filename}.py"
    content = body.get("content")
    if not content:
        raise HTTPException(status_code=422, detail="Missing file content")

    try:
        decoded = base64.b64decode(content)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 content")

    destination = UPLOAD_DIR / filename
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(decoded)
    return JSONResponse({
        "run_id": destination.stem,
        "filename": filename,
        "path": str(destination),
    })


@app.get("/api/aero/uploads")
async def list_uploads() -> JSONResponse:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    files = [
        {"name": p.name, "path": str(p), "run_id": p.stem}
        for p in UPLOAD_DIR.glob("*.py")
        if p.is_file()
    ]
    files.sort(key=lambda item: item["name"])
    return JSONResponse({"files": files[-50:]})


@app.post("/api/aero/analyze")
async def analyze_endpoint(request: AnalyzeRequest) -> JSONResponse:
    run_id = (request.run_id or "").strip()
    if not run_id:
        raise HTTPException(status_code=422, detail="run_id is required")

    visit = read_backtest_result(run_id)
    source = (request.source_code or "").strip()
    if not source:
        _, source = find_source_text(run_id)

    improved_source, applied_fix_findings = apply_baseline(source or "", visit=visit)
    improved_cache = ROOT / "improved"
    improved_path = improved_cache / f"{run_id}_improved.py"
    if improved_source and improved_source != (source or ""):
        improved_cache.mkdir(parents=True, exist_ok=True)
        improved_path.write_text(improved_source, encoding="utf-8")

    analyzer = Analyze(visit=visit, source_text=source or "")
    findings = [_finding_to_dict(f) for f in analyzer.findings()] + [
        _finding_to_dict(f) for f in applied_fix_findings
    ]
    findings = _dedupe(findings)

    return JSONResponse(
        {
            "run_id": run_id,
            "visit": _visit_dict(visit),
            "findings": findings,
            "improved_path": str(improved_path) if improved_source and improved_source != (source or "") else None,
        }
    )


@app.get("/api/aero/improved/{run_id}")
async def improved_result(run_id: str) -> HTMLResponse:
    path = ROOT / "improved" / f"{run_id}_improved.py"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Improved copy not found")
    content = path.read_text(encoding="utf-8")
    return HTMLResponse(f"<pre style='white-space:pre-wrap;color:#e2e8f0;background:#020617;padding:14px;border-radius:10px;'>{_escape(content)}</pre>")


@app.get("/api/aero/improved/{run_id}/download")
async def improved_download(run_id: str):
    print("DEBUG download run_id=" + repr(run_id))
    path = ROOT / "improved" / f"{run_id}_improved.py"
    print("DEBUG download path=" + repr(str(path)) + " exists=" + str(path.exists()))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Improved copy not found")
    content = path.read_bytes()
    filename = f"{run_id}_improved.py"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/x-python",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/aero/improved/{run_id}/apply")
async def improved_apply(run_id: str) -> JSONResponse:
    source = ROOT / "improved" / f"{run_id}_improved.py"
    if not source.exists():
        raise HTTPException(status_code=404, detail="Improved copy not found")
    destination = UPLOAD_DIR / f"{run_id}_improved.py"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(source.read_bytes())
    return JSONResponse({"applied": True, "path": str(destination), "run_id": run_id})


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return (STATIC_DIR / "index.html").read_text(encoding="utf-8")


def _finding_to_dict(finding: Finding) -> dict:
    return {
        "finding_id": finding.finding_id,
        "title": finding.title,
        "severity": finding.severity,
        "plain_explanation": finding.plain_explanation,
        "fix_description": finding.fix_description,
        "diff": finding.diff,
        "applied": finding.applied,
    }


def _visit_dict(visit: BacktestVisit) -> dict:
    return {
        "run_id": visit.run_id,
        "strategy_profit": visit.strategy_profit,
        "trades_count": visit.trades_count,
        "win_rate": visit.win_rate,
        "drawdown": visit.drawdown,
        "profit_factor": visit.profit_factor,
        "expectancy": visit.expectancy,
        "final_balance": visit.final_balance,
        "starting_balance": visit.starting_balance,
    }


def _dedupe(items: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for item in items:
        key = item.get("finding_id") or item.get("title")
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    port = int(os.environ.get("AERO_PORT", "5173"))
    threading.Timer(0.8, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    uvicorn.run("aero.app:app", host="127.0.0.1", port=port, reload=False)
