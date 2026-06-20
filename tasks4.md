# tasks4.md — Data Quality Gate

## 1. Goal

Create a backend helper that validates market data quality before any backtest run. This prevents strategy failures from being confused with missing or bad data by failing fast with clear `data_quality_failed` status instead of ambiguous strategy errors.

## 2. Why this task comes next

Tasks 2–3 produce validated strategy specs and rendered code. Task 4 ensures the data layer is sound before Freqtrade execution. Without this gate, backtest failures could be due to missing files, insufficient history, candle gaps, or invalid pair formats—making strategy debugging impossible.

## 3. Existing files to reuse

| File | What it provides |
|------|-----------------|
| `backend/services/execution/backtest_runner.py` | `_check_data_exists()`, `_check_data_covers_timerange()` — basic data existence and timerange coverage checks |
| `backend/paths.py` | `build_local_paths()` — resolves user_data_dir, data_dir paths |
| `backend/models/contracts.py` | `RunRequest` — timerange, pairs, timeframe, exchange fields |
| `backend/core/errors.py` | `BackendError` — error handling pattern |

## 4. Files likely to change

| File | Change |
|------|--------|
| `backend/services/execution/data_quality_gate.py` | New helper module for data quality validation |
| `backend/tests/test_data_quality_gate.py` | New tests for all quality checks |

## 5. Proposed helper function name and location

Location:
`backend/services/execution/data_quality_gate.py`

Function:
```python
def check_data_quality(
    pairs: list[str],
    timeframe: str,
    timerange: str,
    user_data_dir: str,
    exchange: str = "binance",
) -> dict:
```

## 6. Data quality checks

1. **Data file exists** — Check each pair's JSON file exists at `user_data/data/{exchange}/{pair}-{timeframe}.json`
2. **Enough history for timerange** — Parse timerange end date, verify data file last timestamp covers it
3. **Timeframe is available** — Verify timeframe is in Freqtrade valid timeframes
4. **No critical candle gaps** — Load JSON, check timestamp gaps > 5x expected candle duration, flag if > 10% of candles have gaps
5. **Pair format is valid** — Validate pair format matches exchange pattern (e.g., `BTC/USDT`, `BTC_USDT` for binance)
6. **File is readable JSON** — Catch malformed JSON, empty arrays, or corrupt files

Failure returns `data_quality_failed` status with specific error codes, not generic strategy failure.

## 7. Return shape

```python
{
    "passed": bool,
    "errors": list[str],
    "warnings": list[str],
    "details": dict,  # per-pair results: {"BTC/USDT": {"exists": true, "covers_timerange": true, "gap_pct": 0.02}}
}
```

Error codes:
- `MISSING_DATA_FILE` — pair data file does not exist
- `INSUFFICIENT_HISTORY` — data does not cover requested timerange
- `INVALID_TIMEFRAME` — timeframe not supported
- `CRITICAL_CANDLE_GAPS` — >10% of candles have gaps >5x expected duration
- `INVALID_PAIR_FORMAT` — pair format does not match exchange pattern
- `CORRUPT_DATA_FILE` — file is not valid JSON or is empty

## 8. Tests needed

Create `backend/tests/test_data_quality_gate.py`:

1. `test_data_file_exists` — existing file passes check
2. `test_missing_data_file_fails` — missing file returns `MISSING_DATA_FILE` error
3. `test_timerange_coverage_pass` — data covers full timerange
4. `test_insufficient_history_fails` — data ends before timerange end
5. `test_valid_timeframe_pass` — valid timeframe passes
6. `test_invalid_timeframe_fails` — invalid timeframe returns error
7. `test_no_critical_gaps_pass` — normal data with minor gaps passes
8. `test_critical_gaps_fail` — >10% gap rate returns `CRITICAL_CANDLE_GAPS`
9. `test_valid_pair_format_pass` — correctly formatted pair passes
10. `test_invalid_pair_format_fails` — malformed pair returns `INVALID_PAIR_FORMAT`
11. `test_corrupt_json_fails` — malformed JSON returns `CORRUPT_DATA_FILE`
12. `test_empty_json_fails` — empty array returns `CORRUPT_DATA_FILE`

Run:
`.venv/bin/pytest backend/tests/test_data_quality_gate.py -xvs`

## 9. What not to touch

- Do not modify frontend.
- Do not modify pipeline files.
- Do not create API endpoints.
- Do not modify `backtest_runner.py` (reuse existing checks, don't rewrite).
- Do not run backtests.
- Do not download data.
- Do not touch Ollama files.
- Do not modify strategy code or templates.

## 10. First implementation task only

Create `backend/services/execution/data_quality_gate.py` and `backend/tests/test_data_quality_gate.py`.

Implement only `check_data_quality()` with the 6 checks from section 6. Use temporary test data files (mock JSON) in tests. Do not integrate with backtest runner, API routers, or AutoQuant pipeline in this task.
