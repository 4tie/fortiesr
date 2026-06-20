import { Fragment, useState } from "react";
import SortableHeader from "./SortableHeader";
import StatusBadge from "./StatusBadge";
import { fmtPct, fmtRaw, fmtWin } from "../formatters";
import { completedPairsFromResults, rowPairs } from "../utils";

export default function ResultsTable({
  sortedResults,
  sortCol,
  sortDir,
  onSort,
  checkedPairs,
  setCheckedPairs,
  applying,
  applySuccess,
  onApplyPairs,
  syncEnabled,
}) {
  const [expandedError, setExpandedError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  if (!sortedResults.length) {
    return (
      <div className="text-[10px] text-base-content/50 text-center py-2" data-component-name="ResultsTable">
        No trade data available
      </div>
    );
  }

  const completedPairs = completedPairsFromResults(sortedResults);
  const allChecked = completedPairs.length > 0 && completedPairs.every((pair) => checkedPairs.has(pair));
  const someChecked = completedPairs.some((pair) => checkedPairs.has(pair));

  const handleToggleAll = () => {
    if (allChecked) setCheckedPairs(new Set());
    else setCheckedPairs(new Set(completedPairs));
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-base-300 flex items-center gap-3">
        <span className="text-[10px] text-base-content/40 font-mono">
          {checkedPairs.size > 0
            ? `${checkedPairs.size} pair${checkedPairs.size > 1 ? "s" : ""} selected`
            : "Check pairs below then apply"}
        </span>
        <div className="flex-1" />
        {applySuccess && (
          <span className="text-[10px] text-success font-medium">Pairs updated</span>
        )}
        <button
          type="button"
          disabled={checkedPairs.size === 0 || applying || !syncEnabled}
          onClick={onApplyPairs}
          className="btn btn-xs btn-primary gap-1 disabled:opacity-40"
        >
          {applying ? <span className="loading loading-spinner loading-xs" /> : null}
          Apply {checkedPairs.size > 0 ? `(${checkedPairs.size})` : ""}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="table table-xs w-full">
          <thead className="sticky top-0 bg-base-100 z-10 border-b border-base-300">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs checkbox-primary"
                  checked={allChecked}
                  ref={(element) => { if (element) element.indeterminate = someChecked && !allChecked; }}
                  onChange={handleToggleAll}
                  title="Select / deselect all completed pairs"
                />
              </th>
              <SortableHeader column="group" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Pairs / Group</SortableHeader>
              <SortableHeader column="total_profit_pct" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Profit %</SortableHeader>
              <SortableHeader column="win_rate" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Win Rate</SortableHeader>
              <SortableHeader column="sharpe_ratio" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Sharpe</SortableHeader>
              <SortableHeader column="max_drawdown" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Max DD</SortableHeader>
              <SortableHeader column="total_trades" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Trades</SortableHeader>
              <SortableHeader column="status" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Status</SortableHeader>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
                Error
              </th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((row) => {
              const key = row.group ?? row.pair ?? JSON.stringify(row.pairs);
              const pairs = rowPairs(row);
              const isExpanded = expandedError === key;
              const isRowExpanded = expandedRow === key;
              const isCompleted = row.status === "completed";
              const rowChecked = isCompleted && pairs.every((pair) => checkedPairs.has(pair));
              const rowPartial = isCompleted && !rowChecked && pairs.some((pair) => checkedPairs.has(pair));

              const handleRowCheck = () => {
                if (!isCompleted) return;
                setCheckedPairs((prev) => {
                  const next = new Set(prev);
                  if (rowChecked) pairs.forEach((pair) => next.delete(pair));
                  else pairs.forEach((pair) => next.add(pair));
                  return next;
                });
              };

              return (
                <Fragment key={key}>
                  <tr
                    className={`transition-colors
                      ${isCompleted ? "cursor-pointer hover:bg-base-200/50" : ""}
                      ${rowChecked ? "bg-primary/8" : ""}
                      ${row.status === "failed" && isExpanded ? "bg-error/5" : ""}
                    `}
                    onClick={isCompleted ? handleRowCheck : undefined}
                  >
                    <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                      {isCompleted ? (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={rowChecked}
                          ref={(element) => { if (element) element.indeterminate = rowPartial; }}
                          onChange={handleRowCheck}
                        />
                      ) : (
                        <span className="w-3 h-3 block" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold max-w-[180px]">
                      {pairs.length > 1 ? (
                        <div className="flex flex-col gap-0.5">
                          {pairs.map((pair) => (
                            <span key={pair} className="truncate">{pair}</span>
                          ))}
                        </div>
                      ) : pairs[0] ?? key}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs ${
                      row.total_profit_pct == null ? "text-base-content/30"
                        : row.total_profit_pct >= 0 ? "text-success" : "text-error"
                    }`}>
                      {fmtPct(row.total_profit_pct)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-base-content/70">
                      {fmtWin(row.win_rate)}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs ${
                      row.sharpe_ratio == null ? "text-base-content/30"
                        : row.sharpe_ratio >= 0 ? "text-base-content/80" : "text-error/80"
                    }`}>
                      {fmtRaw(row.sharpe_ratio)}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs ${
                      row.max_drawdown == null ? "text-base-content/30" : "text-warning"
                    }`}>
                      {row.max_drawdown == null ? "-" : `${Math.abs(Number(row.max_drawdown)).toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-base-content/60">
                      {row.total_trades ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2">
                      {row.status === "failed" ? (
                        <button
                          className="text-[10px] text-error/60 hover:text-error/90 truncate max-w-[160px] block text-left transition-colors"
                          title="Click to expand error"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedError((previous) => (previous === key ? null : key));
                          }}
                        >
                          {row.error || "failed"} {row.error ? "v" : ""}
                        </button>
                      ) : row.status !== "completed" ? (
                        <span className="loading loading-dots loading-xs opacity-30" />
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      {isCompleted && (
                        <button
                          className="text-[10px] text-base-content/40 hover:text-base-content/80 transition-colors"
                          title="Click to expand trade details"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedRow((previous) => (previous === key ? null : key));
                          }}
                        >
                          {isRowExpanded ? "▼" : "▶"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {row.status === "failed" && isExpanded && (
                    <tr className="bg-error/5">
                      <td colSpan={10} className="px-4 py-2">
                        <div className="text-[11px] font-mono text-error/80 break-all whitespace-pre-wrap bg-error/5 rounded p-2 border border-error/20">
                          {row.error || "No error details available."}
                        </div>
                        {row.download_warning && (
                          <p className="text-[10px] text-warning/60 mt-1">
                            Download warning: {row.download_warning}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                  {isCompleted && isRowExpanded && (
                    <tr className="bg-base-200/30">
                      <td colSpan={10} className="px-4 py-3">
                        <div className="space-y-4">
                          {/* Pair Breakdown */}
                          {row.trades_by_pair && Object.keys(row.trades_by_pair).length > 1 && (
                            <div>
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-base-content/60 mb-2">
                                Performance by Pair
                              </h4>
                              <table className="table table-xs w-full">
                                <thead>
                                  <tr className="text-[10px] uppercase tracking-wider text-base-content/40">
                                    <th className="px-2 py-1">Pair</th>
                                    <th className="px-2 py-1">Trades</th>
                                    <th className="px-2 py-1">Net Profit</th>
                                    <th className="px-2 py-1">Win Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(row.trades_by_pair).map(([pair, data]) => (
                                    <tr key={pair} className="hover:bg-base-200/50">
                                      <td className="px-2 py-1 font-mono text-xs">{pair}</td>
                                      <td className="px-2 py-1 font-mono text-xs text-base-content/70">{data.total_trades}</td>
                                      <td className={`px-2 py-1 font-mono text-xs ${
                                        data.net_profit >= 0 ? "text-success" : "text-error"
                                      }`}>
                                        {data.net_profit.toFixed(2)}
                                      </td>
                                      <td className="px-2 py-1 font-mono text-xs text-base-content/70">{data.win_rate.toFixed(1)}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {/* Trade Details */}
                          {row.trades_by_pair && Object.keys(row.trades_by_pair).length > 0 ? (
                            <div>
                              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-base-content/60 mb-2">
                                Trades by Pair
                              </h4>
                              <div className="space-y-3">
                                {Object.entries(row.trades_by_pair).map(([pair, data]) => (
                                  <div key={pair} className="border border-base-300 rounded overflow-hidden">
                                    <div className="bg-base-200/50 px-3 py-1.5 border-b border-base-300">
                                      <span className="font-mono text-xs font-semibold">{pair}</span>
                                      <span className="text-[10px] text-base-content/50 ml-2">
                                        ({data.total_trades} trades)
                                      </span>
                                    </div>
                                    <div className="max-h-48 overflow-auto">
                                      <table className="table table-xs w-full">
                                        <thead className="sticky top-0 bg-base-100 z-10">
                                          <tr className="text-[10px] uppercase tracking-wider text-base-content/40">
                                            <th className="px-2 py-1">Open Date</th>
                                            <th className="px-2 py-1">Close Date</th>
                                            <th className="px-2 py-1">Entry</th>
                                            <th className="px-2 py-1">Exit</th>
                                            <th className="px-2 py-1">Profit $</th>
                                            <th className="px-2 py-1">Profit %</th>
                                            <th className="px-2 py-1">Duration</th>
                                            <th className="px-2 py-1">Exit Reason</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {data.trades && data.trades.length > 0 ? (
                                            data.trades.map((trade, idx) => (
                                              <tr key={idx} className="hover:bg-base-200/50">
                                                <td className="px-2 py-1 text-[10px] text-base-content/70">
                                                  {trade.open_date ? new Date(trade.open_date).toLocaleString() : "-"}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-base-content/70">
                                                  {trade.close_date ? new Date(trade.close_date).toLocaleString() : "-"}
                                                </td>
                                                <td className="px-2 py-1 font-mono text-xs text-base-content/70">
                                                  {trade.open_rate ? trade.open_rate.toFixed(2) : "-"}
                                                </td>
                                                <td className="px-2 py-1 font-mono text-xs text-base-content/70">
                                                  {trade.close_rate ? trade.close_rate.toFixed(2) : "-"}
                                                </td>
                                                <td className={`px-2 py-1 font-mono text-xs ${
                                                  trade.profit_abs >= 0 ? "text-success" : "text-error"
                                                }`}>
                                                  {trade.profit_abs ? trade.profit_abs.toFixed(2) : "-"}
                                                </td>
                                                <td className={`px-2 py-1 font-mono text-xs ${
                                                  trade.profit_ratio >= 0 ? "text-success" : "text-error"
                                                }`}>
                                                  {trade.profit_ratio ? (trade.profit_ratio * 100).toFixed(2) + "%" : "-"}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-base-content/70">{trade.trade_duration || "-"}</td>
                                                <td className="px-2 py-1 text-[10px] text-base-content/70">{trade.exit_reason || "-"}</td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan={8} className="px-2 py-2 text-[10px] text-base-content/50 text-center">
                                                No trades available for this pair
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-base-content/50 text-center py-2">
                              No trade data available
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
