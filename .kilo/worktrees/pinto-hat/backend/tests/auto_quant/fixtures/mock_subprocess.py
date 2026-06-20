"""Mock subprocess for testing AutoQuant pipeline without running freqtrade."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any


@dataclass
class MockAsyncProcess:
    """Mock asyncio.subprocess.Process for testing."""

    stdout_data: bytes
    return_code: int = 0
    pid: int = 99999

    @property
    def stdout(self):
        """Mock stdout stream."""
        return MockStream(self.stdout_data)

    @property
    def stderr(self):
        """Mock stderr stream."""
        return None

    async def wait(self) -> int:
        """Wait for process to complete."""
        await asyncio.sleep(0.01)
        return self.return_code

    async def communicate(self) -> tuple[bytes, bytes | None]:
        """Return stdout and stderr."""
        await self.wait()
        return self.stdout_data, None

    def kill(self) -> None:
        """Mock kill."""
        pass

    def terminate(self) -> None:
        """Mock terminate."""
        pass


class MockStream:
    """Mock async stream."""

    def __init__(self, data: bytes):
        self.data = data
        self.position = 0

    async def readline(self) -> bytes:
        """Read one line from data."""
        if self.position >= len(self.data):
            return b""

        # Find next newline
        next_newline = self.data.find(b"\n", self.position)
        if next_newline == -1:
            # No more newlines, return rest of data
            line = self.data[self.position :]
            self.position = len(self.data)
        else:
            # Return up to and including newline
            line = self.data[self.position : next_newline + 1]
            self.position = next_newline + 1

        # Add small delay to simulate real subprocess
        await asyncio.sleep(0.001)
        return line


def create_backtest_result(
    profit: float = 0.05,
    max_dd: float = 0.10,
    trades: int = 42,
    win_rate: float = 0.55,
    sharpe: float = 1.2,
    profit_factor: float = 1.5,
    pairs: list[str] | None = None,
) -> bytes:
    """
    Generate realistic freqtrade backtest result JSON.

    Args:
        profit: Total profit as decimal (e.g., 0.05 = 5%)
        max_dd: Max drawdown as decimal (e.g., 0.10 = 10%)
        trades: Total number of trades
        win_rate: Win rate as decimal (e.g., 0.55 = 55%)
        sharpe: Sharpe ratio
        profit_factor: Profit factor
        pairs: List of trading pairs (default: BTC/USDT, ETH/USDT)

    Returns:
        JSON bytes suitable for freqtrade backtest results
    """
    if pairs is None:
        pairs = ["BTC/USDT", "ETH/USDT"]

    wins = int(trades * win_rate)
    losses = trades - wins

    result = {
        "strategy": {
            "TestStrategy": {
                "profit_total": profit,
                "profit_abs": 1000 * profit,
                "max_drawdown_account": max_dd,
                "max_drawdown_abs": 100 * max_dd,
                "total_trades": trades,
                "wins": wins,
                "losses": losses,
                "draws": 0,
                "win_rate": win_rate,
                "profit_factor": profit_factor,
                "sharpe_ratio": sharpe,
                "sortino_ratio": sharpe * 1.1,
                "calmar_ratio": 0.5,
                "trade_count": trades,
                "results_per_pair": [
                    {
                        "key": pair,
                        "profit_total": profit * 0.8,
                        "profit_abs": 800 * profit,
                        "trades": max(1, trades // len(pairs)),
                    }
                    for pair in pairs
                ],
            }
        },
        "config": {"stake_currency": "USDT"},
        "locks": [],
    }

    return json.dumps(result).encode("utf-8")


def create_hyperopt_result(
    epochs: int = 10,
    best_profit: float = 0.08,
) -> bytes:
    """
    Generate freqtrade hyperopt result output with epoch lines.

    Args:
        epochs: Number of hyperopt epochs to simulate
        best_profit: Best profit found

    Returns:
        Hyperopt output suitable for parsing
    """
    lines = []

    # Add some header text
    lines.append(b"Starting optimization...")
    lines.append(b"")

    # Add epoch progress lines
    for epoch in range(1, epochs + 1):
        profit = best_profit * (0.8 + (epoch / epochs) * 0.4)
        trades = 30 + epoch * 2
        objective = -profit

        line = f"{epoch}/{epochs}:    {trades} trades. Profit: {profit:.2%}. Max drawdown: {0.15:.2%}. Objective: {objective:.4f}.\n"
        lines.append(line.encode("utf-8"))

    # Add final result
    lines.append(b"\nBest result:")
    lines.append(
        f"Best: {epochs}/{epochs} profit: {best_profit:.4f} (Total: {best_profit:.2%})".encode(
            "utf-8"
        )
    )

    return b"".join(lines)


def create_backtest_output(
    include_hyperopt: bool = False,
    epochs: int = 10,
    profit: float = 0.05,
) -> bytes:
    """Create combined output with optional hyperopt progress."""
    lines = []

    if include_hyperopt:
        lines.append(create_hyperopt_result(epochs=epochs, best_profit=profit))

    # Add final backtest result at end
    lines.append(b"\nBacktest Summary:")
    lines.append(create_backtest_result(profit=profit))

    return b"".join(lines)
