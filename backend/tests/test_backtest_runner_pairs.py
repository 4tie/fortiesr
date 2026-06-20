from backend.services.execution.backtest_runner import BacktestRunner


def test_normalize_futures_pairs_adds_settlement_suffix():
    runner = BacktestRunner.__new__(BacktestRunner)

    pairs = runner._normalize_pairs_for_config(
        ["ADA/USDT", "ETH/USDT", "BTC/USDT:USDT", "ADA/USDT"],
        {"trading_mode": "futures"},
    )

    assert pairs == ["ADA/USDT:USDT", "ETH/USDT:USDT", "BTC/USDT:USDT"]


def test_normalize_spot_pairs_leaves_symbols_unchanged():
    runner = BacktestRunner.__new__(BacktestRunner)

    pairs = runner._normalize_pairs_for_config(
        ["ADA/USDT", "ETH/USDT"],
        {"trading_mode": "spot"},
    )

    assert pairs == ["ADA/USDT", "ETH/USDT"]
