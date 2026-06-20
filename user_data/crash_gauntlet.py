#!/usr/bin/env python3
"""Crash gauntlet: run the strategy on known crash periods to test robustness."""
import subprocess, re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FREQTRADE = str(BASE / ".venv/bin/freqtrade")
STRATEGY = "DualMomentum"
STRAT_PATH = str(BASE / "user_data/strategies")
CONFIG = str(BASE / "user_data/config.json")
PAIRS = ["ETH/USDT", "BNB/USDT", "DOGE/USDT", "SOL/USDT"]

CRASH_PERIODS = [
    ("COVID Crash", "20200215-20200331"),
    ("China Mining Ban", "20210510-20210731"),
    ("Crypto Winter", "20220101-20220401"),
    ("LUNA Collapse", "20220505-20220620"),
    ("FTX Collapse", "20221101-20221231"),
]

def download_data(pair, timerange):
    subprocess.run(
        [FREQTRADE, "download-data",
         "--user-data-dir", str(BASE / "user_data"),
         "--config", CONFIG,
         "--exchange", "binance",
         "--pairs", pair,
         "--timerange", timerange,
         "--timeframe", "1d,1h",
         "--erase"],
        capture_output=True, timeout=300,
    )

def run_backtest(timerange):
    result = subprocess.run(
        [FREQTRADE, "backtesting",
         "--strategy", STRATEGY, "--strategy-path", STRAT_PATH,
         "--config", CONFIG, "--timerange", timerange,
         "--timeframe", "1h", "--pairs"] + PAIRS +
        ["--max-open-trades", "3", "--cache", "none", "--no-color"],
        capture_output=True, text=True, timeout=600,
    )
    out = result.stdout
    m = re.search(r'│ DualMomentum │\s+(\d+)\s+│\s+(-?[\d.]+)\s+│\s+(-?[\d.]+)\s+│\s+(-?[\d.]+)\s+│', out)
    if m:
        trades = int(m.group(1))
        avg_profit = float(m.group(2))
        tot_usdt = float(m.group(3))
        tot_pct = float(m.group(4))
        return trades, avg_profit, tot_usdt, tot_pct
    # try different format
    m = re.search(rf'│\s*DualMomentum\s*│\s*(\d+)\s*│', out)
    if m:
        print(f"  Alternative parse failed. Output: {out[-300:]}")
    return None

# Download data for each crash period
print("Downloading crash period data...")
for label, trange in CRASH_PERIODS:
    start = trange.split("-")[0]
    for pair in PAIRS:
        dl_range = f"{start}-20230101"
        print(f"  {pair} ({dl_range})...", end=" ", flush=True)
        download_data(pair, dl_range)
        print("OK")

# Run crash tests
print("\n\n========== CRASH GAUNTLET ==========")
print(f"{'Period':<22} {'Trades':>6} {'Avg%':>7} {'Profit$':>9} {'Profit%':>8}")
print("-" * 55)
passed = 0
total = 0
for label, trange in CRASH_PERIODS:
    print(f"{label:<22} ", end="", flush=True)
    res = run_backtest(trange)
    total += 1
    if res:
        trades, avg, usdt, pct = res
        print(f"{trades:>6} {avg:>+7.2f} {usdt:>+9.1f} {pct:>+8.2f}%")
        if pct > -10:
            passed += 1
        else:
            print(f"  ⚠ FAIL (lost >10%)")
    else:
        print(f"  {'N/A':>6} {'N/A':>7} {'N/A':>9} {'N/A':>8}")

print(f"\nCrash gauntlet: {passed}/{total} periods passed (loss <10%)")
