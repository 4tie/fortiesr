#!/usr/bin/env python3
"""Grid search over DualMomentum parameters using freqtrade CLI."""
import subprocess, json, re, sys
from itertools import product
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STRATEGY = "DualMomentum"
STRAT_PATH = str(BASE / "user_data/strategies")
CONFIG = str(BASE / "user_data/config.json")
PAIRS = ["ETH/USDT", "BNB/USDT", "DOGE/USDT", "SOL/USDT"]
MAX_OPEN = 3
FREQTRADE = str(BASE / ".venv/bin/freqtrade")

FAST = [8, 12, 20]
SLOW = [21, 26, 50]
SMA = [10, 20, 50, 100]

def modify_strategy(fast, slow, sma):
    py = Path(STRAT_PATH) / f"{STRATEGY}.py"
    src = py.read_text()
    src = re.sub(
        r'dataframe\["ema_fast"\].*=.*ta\.EMA\(dataframe\["close"\].*?, timeperiod=(\d+)\)',
        f'dataframe["ema_fast"] = ta.EMA(dataframe["close"].values, timeperiod={fast})',
        src,
    )
    src = re.sub(
        r'dataframe\["ema_slow"\].*=.*ta\.EMA\(dataframe\["close"\].*?, timeperiod=(\d+)\)',
        f'dataframe["ema_slow"] = ta.EMA(dataframe["close"].values, timeperiod={slow})',
        src,
    )
    src = re.sub(
        r'daily_sma = ta\.SMA\(daily\["close"\].*?, timeperiod=(\d+)\)',
        f'daily_sma = ta.SMA(daily["close"].values, timeperiod={sma})',
        src,
    )
    py.write_text(src)
    return src

def run_backtest(timerange):
    result = subprocess.run(
        [FREQTRADE, "backtesting",
         "--strategy", STRATEGY,
         "--strategy-path", STRAT_PATH,
         "--config", CONFIG,
         "--timerange", timerange,
         "--timeframe", "1h",
         "--pairs"] + PAIRS +
        ["--max-open-trades", str(MAX_OPEN),
         "--cache", "none",
         "--no-color"],
        capture_output=True, text=True, timeout=600,
    )
    out = result.stdout
    m = re.search(r'│ DualMomentum │\s+(\d+)\s+│\s+(-?[\d.]+)\s+│\s+(-?[\d.]+)\s+│\s+(-?[\d.]+)\s+│', out)
    if m:
        trades = int(m.group(1))
        avg_profit = float(m.group(2))
        tot_profit_usdt = float(m.group(3))
        tot_profit_pct = float(m.group(4))
        return trades, avg_profit, tot_profit_usdt, tot_profit_pct, out
    print(f"PARSE ERROR for {timerange}:\n{out[-500:]}")
    return None

def extract_drawdown(out):
    m = re.search(r'Drawdown\s+│\s+(-?[\d.]+) USDT\s+(-?[\d.]+)%', out)
    return float(m.group(2)) if m else None

results = []
total = len(FAST) * len(SLOW) * len(SMA)
for i, (fast, slow, sma) in enumerate(product(FAST, SLOW, SMA)):
    print(f"\n[{i+1}/{total}] Testing EMA({fast},{slow}) + SMA({sma})...", flush=True)
    if fast >= slow:
        print(f"  Skip (fast>=slow)")
        continue

    modify_strategy(fast, slow, sma)

    is_res = run_backtest("20250701-20251101")
    oos_res = run_backtest("20251101-20260101")
    full_res = run_backtest("20250701-20260101")

    if is_res and oos_res and full_res:
        _, is_avg, _, is_pct, is_out = is_res
        _, oos_avg, _, oos_pct, _ = oos_res
        _, full_avg, _, full_pct, full_out = full_res
        dd = extract_drawdown(full_out)
        results.append({
            "fast": fast, "slow": slow, "sma": sma,
            "is_pct": is_pct, "oos_pct": oos_pct, "full_pct": full_pct,
            "full_trades": full_res[0], "dd": dd,
            "is_trades": is_res[0], "oos_trades": oos_res[0],
        })
        print(f"  IS={is_pct:+.2f}%  OOS={oos_pct:+.2f}%  Full={full_pct:+.2f}%  DD={dd}%  Trades={full_res[0]}")

# Sort by OOS performance (descending)
results.sort(key=lambda r: r["oos_pct"], reverse=True)

print("\n\n========== TOP 10 BY OOS ==========")
print(f"{'Fast':>4} {'Slow':>4} {'SMA':>4} {'IS%':>7} {'OOS%':>7} {'Full%':>7} {'Trades':>6} {'DD%':>6}")
print("-" * 55)
for r in results[:10]:
    print(f"{r['fast']:>4} {r['slow']:>4} {r['sma']:>4} {r['is_pct']:>+7.2f} {r['oos_pct']:>+7.2f} {r['full_pct']:>+7.2f} {r['full_trades']:>6} {r['dd'] if r['dd'] else '?':>6}")

print("\n\n========== ALL RESULTS BY OOS ==========")
for r in results:
    print(f"EMA({r['fast']},{r['slow']})+SMA{r['sma']}: IS={r['is_pct']:+.2f}% OOS={r['oos_pct']:+.2f}% Full={r['full_pct']:+.2f}% DD={r['dd']}% Tr={r['full_trades']}")

Path(STRAT_PATH) / f"{STRATEGY}.py"
