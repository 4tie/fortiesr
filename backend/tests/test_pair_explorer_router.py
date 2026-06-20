import pytest

from backend.api.routers import pair_explorer


def test_safe_config_filename_removes_pair_separators():
    cases = [
        (
            "bacf9ea3-7720-4fdf-a495-60db2d0ebb87",
            "ADA/USDT + BTC/USDT",
            "pe_bacf9ea3-7720-4fdf-a495-60db2d0ebb87_ADA_USDT_BTC_USDT.json",
        ),
        (
            "96ec9b20-fcf6-43e3-a5c9-46d81ee826de",
            "XRP/USDT + APT/USDT + SOL/USDT + STX/USDT",
            "pe_96ec9b20-fcf6-43e3-a5c9-46d81ee826de_XRP_USDT_APT_USDT_SOL_USDT_STX_USDT.json",
        ),
    ]

    for session_id, group_key, expected in cases:
        filename = pair_explorer._safe_config_filename(session_id, group_key)
        assert filename == expected
        assert "/" not in filename
        assert "\\" not in filename


def test_extract_metrics_groups_strategy_block_trades_by_pair():
    payload = {
        "strategy": {
            "DemoStrategy": {
                "total_trades": 3,
                "profit_total": 0.045,
                "wins": 2,
                "losses": 1,
                "winrate": 2 / 3,
                "max_drawdown_account": 0.012,
                "trades": [
                    {"pair": "BTC/USDT", "profit_abs": 2.5, "profit_ratio": 0.03},
                    {"pair": "ETH/USDT", "profit_abs": -1.0, "profit_ratio": -0.01},
                    {"pair": "BTC/USDT", "profit_abs": 1.0, "profit_ratio": 0.02},
                ],
            }
        },
        "strategy_comparison": [{"sharpe": 1.25}],
    }

    metrics = pair_explorer._extract_metrics(payload, "DemoStrategy")

    assert metrics["total_trades"] == 3
    assert metrics["total_profit_pct"] == 4.5
    assert metrics["trades"] == payload["strategy"]["DemoStrategy"]["trades"]
    assert sorted(metrics["trades_by_pair"]) == ["BTC/USDT", "ETH/USDT"]
    assert metrics["trades_by_pair"]["BTC/USDT"]["total_trades"] == 2
    assert metrics["trades_by_pair"]["BTC/USDT"]["win_rate"] == 100.0
    assert metrics["trades_by_pair"]["ETH/USDT"]["total_trades"] == 1
    assert metrics["trades_by_pair"]["ETH/USDT"]["win_rate"] == 0.0


def test_extract_metrics_falls_back_to_results_per_pair_without_trade_rows():
    payload = {
        "strategy": {
            "DemoStrategy": {
                "total_trades": 5,
                "profit_total": -0.01,
                "results_per_pair": [
                    {"key": "BTC/USDT", "trades": 3, "profit_total_abs": 1.5, "wins": 2, "winrate": 2 / 3},
                    {"key": "ETH/USDT", "trades": 2, "profit_total_abs": -2.5, "wins": 0, "winrate": 0},
                    {"key": "TOTAL", "trades": 5, "profit_total_abs": -1.0, "wins": 2, "winrate": 0.4},
                ],
            }
        }
    }

    metrics = pair_explorer._extract_metrics(payload, "DemoStrategy")

    assert metrics["trades"] == []
    assert sorted(metrics["trades_by_pair"]) == ["BTC/USDT", "ETH/USDT"]
    assert metrics["trades_by_pair"]["BTC/USDT"] == {
        "total_trades": 3,
        "net_profit": 1.5,
        "wins": 2,
        "win_rate": 66.67,
        "trades": [],
    }


@pytest.mark.asyncio
async def test_explore_task_marks_unfinished_group_failed(tmp_path, monkeypatch):
    session_id = "session-unfinished"
    pair_explorer._SESSIONS.clear()
    pair_explorer._SESSIONS[session_id] = {
        "session_id": session_id,
        "status": "running",
        "total": 1,
        "completed": 0,
        "results": {},
        "strategy_name": "DemoStrategy",
        "timeframe": "1h",
        "timerange": "20240101-20240201",
        "dry_run_wallet": 1000.0,
        "max_open_trades": 1,
        "pairs": ["BTC/USDT"],
        "created_at": "2024-01-01T00:00:00+00:00",
        "completed_at": None,
    }

    async def fake_run_pair_group(semaphore, task_session_id, chunk, *_args, **_kwargs):
        async with semaphore:
            group_key = pair_explorer._group_key(chunk)
            pair_explorer._SESSIONS[task_session_id]["results"][group_key] = {
                "group": group_key,
                "pairs": chunk,
                "status": "running",
            }

    monkeypatch.setattr(pair_explorer, "_run_pair_group", fake_run_pair_group)

    await pair_explorer._explore_task(
        session_id,
        [["BTC/USDT"]],
        "DemoStrategy",
        "1h",
        "20240101-20240201",
        "freqtrade",
        "config.json",
        "strategies",
        str(tmp_path),
        "binance",
        object(),
    )

    session = pair_explorer._SESSIONS[session_id]
    row = session["results"]["BTC/USDT"]
    assert session["status"] == "completed"
    assert session["completed"] == 1
    assert row["status"] == "failed"
    assert "without a terminal result" in row["error"]
