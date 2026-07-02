"""Check file sizes to enforce line count limits."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MAX_LINES = 800

INCLUDE_SUFFIXES = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
}

IGNORE_PARTS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "__pycache__",
    ".pytest_cache",
}

IGNORE_PREFIXES = (
    "data/",
    "user_data/backtest_results/",
    "user_data/hyperopt_results/",
    "user_data/data_downloads/",
    "user_data/auto_quant/",
)

# Temporary exceptions must include a reason in docs/FILE_SIZE_AUDIT.md.
ALLOWLIST = {
    # Already refactored in previous work - test file split
    "backend/services/candidate/orchestrator.py": "Already refactored - split into 4 test modules (test_orchestrator_basic, test_orchestrator_data_quality, test_orchestrator_portfolio, test_orchestrator_repair)",
    # Frontend components deferred to Phase 3
    "frontend/src/components/StrategyLabTab.jsx": "Deferred - complex strategy lab UI, Phase 3 refactor",
    "frontend/src/components/OptimizerTab.jsx": "Deferred - optimizer UI, Phase 3 refactor",
    "frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx": "Deferred - run dashboard UI, Phase 3 refactor",
    "frontend/src/features/autoquant/components/AutoQuantConfigPanel.jsx": "Deferred - config panel UI, Phase 3 refactor",
    "frontend/src/components/PerformanceTab.jsx": "Deferred - performance UI, Phase 3 refactor",
    "frontend/src/components/SettingsTab.jsx": "Deferred - settings UI, Phase 3 refactor",
    # Test files deferred to refactor alongside source files
    "backend/tests/auto_quant/test_pipeline_validation.py": "Deferred - refactor alongside stages_validation.py",
    "backend/tests/test_candidate_api.py": "Deferred - refactor alongside candidate service",
    # Backend services - Phase 1 and 2 refactors
    "backend/services/assistant_service.py": "Phase 2 - ready to split",
    "backend/services/auto_quant/policy/__init__.py": "Phase 2 - ready to split",
}


def should_ignore(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()

    if any(part in IGNORE_PARTS for part in path.parts):
        return True

    if rel.startswith(IGNORE_PREFIXES):
        return True

    # Strategy source files are intentionally excluded from this app-refactor gate.
    # They are user strategies, not app architecture files.
    if rel.startswith("user_data/strategies/"):
        return True

    return False


def count_lines(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
    except Exception:
        return 0


def main() -> int:
    records: list[tuple[int, str]] = []

    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in INCLUDE_SUFFIXES:
            continue
        if should_ignore(path):
            continue

        rel = path.relative_to(ROOT).as_posix()
        lines = count_lines(path)
        records.append((lines, rel))

    records.sort(reverse=True)

    print("Top largest source files:")
    for lines, rel in records[:30]:
        marker = "ALLOWLISTED" if rel in ALLOWLIST else ""
        print(f"{lines:5d}  {rel} {marker}")

    failures = [
        (lines, rel)
        for lines, rel in records
        if lines > MAX_LINES and rel not in ALLOWLIST
    ]

    if failures:
        print()
        print(f"ERROR: Files over {MAX_LINES} lines:")
        for lines, rel in failures:
            print(f"{lines:5d}  {rel}")
        print()
        print("Refactor these files or add a temporary allowlist entry with a documented reason.")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
