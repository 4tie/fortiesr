import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

const RunDetailPairs = ({ run }) => {
  const report = run.report || {};
  const stressTest = report.stress_test || {};
  const perPair = stressTest.per_pair || [];
  const winningPairs = stressTest.winning_pairs || [];
  const failingPairs = stressTest.failing_pairs || [];

  const [expandedStress, setExpandedStress] = useState(false);

  const totalPairs = perPair.length;
  const winCount = winningPairs.length;
  const failCount = failingPairs.length;

  const fmt = (n, decimals = 2) => {
    if (typeof n !== "number") return "N/A";
    return n.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-base-200 border border-base-300 rounded-lg p-5">
          <div className="text-sm text-base-content/50 mb-1">Total Pairs Tested</div>
          <div className="text-3xl font-bold text-primary">{totalPairs}</div>
        </div>
        <div className="bg-base-200 border border-success/30 rounded-lg p-5">
          <div className="text-sm text-success mb-1">✓ Winning Pairs</div>
          <div className="text-3xl font-bold text-success">{winCount}</div>
        </div>
        <div className="bg-base-200 border border-error/30 rounded-lg p-5">
          <div className="text-sm text-error mb-1">✗ Filtered Pairs</div>
          <div className="text-3xl font-bold text-error">{failCount}</div>
        </div>
      </div>

      <div className="bg-base-200 border border-base-300 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-base-300">
          <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
            <span>💱</span> Per-Pair Performance
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-base-300 border-b border-base-300">
              <tr>
                <th className="px-4 py-3 text-left text-base-content/70 font-semibold">Pair</th>
                <th className="px-4 py-3 text-right text-base-content/70 font-semibold">
                  Profit (USDT)
                </th>
                <th className="px-4 py-3 text-right text-base-content/70 font-semibold">
                  Profit %
                </th>
                <th className="px-4 py-3 text-right text-base-content/70 font-semibold">
                  Win Rate
                </th>
                <th className="px-4 py-3 text-right text-base-content/70 font-semibold">
                  Max DD
                </th>
                <th className="px-4 py-3 text-right text-base-content/70 font-semibold">
                  Trades
                </th>
                <th className="px-4 py-3 text-left text-base-content/70 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {perPair.map((pair, idx) => {
                const isWinning = winningPairs.some((p) => p.key === pair.key);
                const profit = pair.profit_total || 0;
                const profitPct = pair.profit_pct || 0;
                const winRate = pair.trade_stats?.win_rate || 0;
                const maxDD = pair.trade_stats?.max_drawdown || 0;
                const trades = pair.trade_count || 0;

                return (
                  <tr key={idx} className="hover:bg-base-300 transition">
                    <td className="px-4 py-3 text-base-content font-mono">{pair.key}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${profit > 0 ? "text-success" : "text-error"}`}>
                      ${fmt(profit, 2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${profitPct > 0 ? "text-success" : "text-error"}`}>
                      {fmt(profitPct * 100, 1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-base-content/70">
                      {fmt(winRate * 100, 1)}%
                    </td>
                    <td className={`px-4 py-3 text-right ${maxDD > 30 ? "text-error" : "text-base-content/70"}`}>
                      {fmt(maxDD, 1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-base-content/70">{trades}</td>
                    <td className="px-4 py-3">
                      {isWinning ? (
                        <span className="inline-block px-3 py-1 bg-success/20 text-success rounded text-xs font-semibold">
                          ✓ Winning
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-error/20 text-error rounded text-xs font-semibold">
                          ✗ Filtered
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-base-200 border border-base-300 rounded-lg">
        <button
          onClick={() => setExpandedStress(!expandedStress)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-base-300 transition"
        >
          <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
            <span>📈</span> Stress Test Results (1x, 2x, 3x Fees)
          </h3>
          {expandedStress ? (
            <ChevronUpIcon className="w-5 h-5 text-base-content/50" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-base-content/50" />
          )}
        </button>

        {expandedStress && (
          <div className="px-6 pb-4 border-t border-base-300 space-y-4">
            {stressTest.stress_levels ? (
              Object.entries(stressTest.stress_levels).map(([level, data]) => (
                <div
                  key={level}
                  className="bg-base-300 p-5 rounded border border-base-300"
                >
                  <div className="text-sm font-semibold text-base-content/70 mb-2">
                    {level === "1x" && "1x Fees (Baseline)"}
                    {level === "2x" && "2x Fees"}
                    {level === "3x" && "3x Fees"}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs text-base-content/50">Total Profit</div>
                      <div className={`font-bold ${data.total_profit > 0 ? "text-success" : "text-error"}`}>
                        ${fmt(data.total_profit, 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-base-content/50">Max DD</div>
                      <div className="text-primary font-bold">
                        {fmt(data.max_drawdown * 100, 1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-base-content/50">Win Rate</div>
                      <div className="text-primary font-bold">
                        {fmt(data.win_rate * 100, 1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-base-content/50">Trades</div>
                      <div className="text-primary font-bold">{data.trade_count}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-base-content/40 italic">No stress test data available</div>
            )}

            {stressTest.stress_levels && (
              <div className="bg-primary/10 border border-primary/30 p-5 rounded text-sm text-primary/80 italic">
                💡 The strategy was tested at 1x (normal fees), 2x, and 3x fee multipliers to
                ensure it remains profitable even when trading costs increase. This validates
                robustness to market conditions and exchange fees.
              </div>
            )}
          </div>
        )}
      </div>

      {winCount > 0 && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-6">
          <h3 className="text-lg font-bold text-success mb-3">✓ Winning Pairs Advanced</h3>
          <div className="flex flex-wrap gap-2">
            {winningPairs.map((pair) => (
              <div
                key={pair.key}
                className="bg-success/20 text-success px-4 py-2 rounded font-mono text-sm border border-success/30"
              >
                {pair.key}
              </div>
            ))}
          </div>
          <p className="text-success/80 text-xs mt-3">
            These pairs met all profitability criteria and were selected for portfolio testing.
          </p>
        </div>
      )}

      {failCount > 0 && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-6">
          <h3 className="text-lg font-bold text-error mb-3">✗ Filtered Pairs</h3>
          <div className="flex flex-wrap gap-2">
            {failingPairs.map((pair) => (
              <div
                key={pair.key}
                className="bg-error/20 text-error px-4 py-2 rounded font-mono text-sm border border-error/30"
              >
                {pair.key}
              </div>
            ))}
          </div>
          <p className="text-error/80 text-xs mt-3">
            These pairs did not meet profitability thresholds and were excluded from the final
            strategy.
          </p>
        </div>
      )}
    </div>
  );
};

export default RunDetailPairs;
