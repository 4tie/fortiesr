"""AeRo MCP Server — strategy-doctor tools that wrap the FortiesR backend.

No old code is modified.  AeRo talks to FortiesR only via HTTP.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aero")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from config import FORTIESR_API_URL, OLLAMA_URL  # noqa: E402
from fortiesr_client import (  # noqa: E402
    get_candidate_evaluation,
    get_run_detail,
    get_run_results,
    get_run_status,
    get_strategies,
    get_strategy_content,
    run_backtest,
)
from strategy_writer import apply_edit, diff_strategies, preview_edit, read_strategy  # noqa: E402

TOOLS: list[dict[str, Any]] = [
    {
        "name": "aero.list_strategies",
        "description": "List all strategies registered in FortiesR.",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "aero.read_strategy",
        "description": "Return the full Python source of a strategy file.",
        "inputSchema": {
            "type": "object",
            "properties": {"strategy_name": {"type": "string"}},
            "required": ["strategy_name"],
        },
    },
    {
        "name": "aero.run_backtest",
        "description": (
            "Start an async backtest. Returns run_id. "
            "Poll aero.run_status until finished, then read aero.read_results."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "strategy_name": {"type": "string"},
                "timerange": {"type": "string"},
                "pairs": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["strategy_name", "timerange"],
        },
    },
    {
        "name": "aero.run_status",
        "description": "Check status of a running or finished backtest.",
        "inputSchema": {
            "type": "object",
            "properties": {"run_id": {"type": "string"}},
            "required": ["run_id"],
        },
    },
    {
        "name": "aero.read_results",
        "description": "Read metrics of a finished backtest run.",
        "inputSchema": {
            "type": "object",
            "properties": {"run_id": {"type": "string"}},
            "required": ["run_id"],
        },
    },
    {
        "name": "aero.analyze_failure",
        "description": "Plain-language diagnosis of a losing backtest + fixes.",
        "inputSchema": {
            "type": "object",
            "properties": {"run_id": {"type": "string"}},
            "required": ["run_id"],
        },
    },
    {
        "name": "aero.preview_edit",
        "description": "Show unified diff of a proposed change WITHOUT saving.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "strategy_name": {"type": "string"},
                "old_text": {"type": "string"},
                "new_text": {"type": "string"},
            },
            "required": ["strategy_name", "old_text", "new_text"],
        },
    },
    {
        "name": "aero.apply_edit",
        "description": (
            "Apply change to a working copy only. "
            "The original uploaded strategy is NEVER modified."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "strategy_name": {"type": "string"},
                "old_text": {"type": "string"},
                "new_text": {"type": "string"},
            },
            "required": ["strategy_name", "old_text", "new_text"],
        },
    },
    {
        "name": "aero.diff_versions",
        "description": "Diff between the original upload and the current working copy.",
        "inputSchema": {
            "type": "object",
            "properties": {"strategy_name": {"type": "string"}},
            "required": ["strategy_name"],
        },
    },
]


def _send(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _recv() -> dict[str, Any] | None:
    raw = sys.stdin.readline()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _on_list_strategies(args: dict[str, Any]) -> str:
    result = await get_strategies()
    items = result if isinstance(result, list) else result.get("strategies", [])
    names = [s.get("name", str(s)) if isinstance(s, dict) else str(s) for s in items]
    return json.dumps({"strategies": names}, ensure_ascii=False)


async def _on_read_strategy(args: dict[str, Any]) -> str:
    source = await get_strategy_content(args["strategy_name"])
    return json.dumps({"strategy_name": args["strategy_name"], "source": source}, ensure_ascii=False)


async def _on_run_backtest(args: dict[str, Any]) -> str:
    result = await run_backtest(
        strategy_name=args["strategy_name"],
        timerange=args["timerange"],
        pairs=args.get("pairs"),
    )
    return json.dumps(result, ensure_ascii=False)


async def _on_run_status(args: dict[str, Any]) -> str:
    return json.dumps(await get_run_status(args["run_id"]), ensure_ascii=False)


async def _on_read_results(args: dict[str, Any]) -> str:
    return json.dumps(await get_run_results(args["run_id"]), ensure_ascii=False)


async def _on_analyze_failure(args: dict[str, Any]) -> str:
    rid = args["run_id"]
    detail = await get_run_detail(rid)
    candidate = await get_candidate_evaluation(rid)

    profit = detail.get("profit_total", detail.get("profit_total_pct", "?"))
    trades = detail.get("trades", "?")
    drawdown = detail.get("max_drawdown", "?")
    win_rate = detail.get("win_rate", "?")

    lines: list[str] = [
        f"Backtest run: {rid}",
        f"profit={profit}, trades={trades}, drawdown={drawdown}, win_rate={win_rate}",
        "",
    ]
    issues: list[str] = []
    fixes: list[str] = []

    try:
        pf = float(detail.get("profit_factor", 0) or 0)
        wr = float(detail.get("win_rate", 0) or 0)
        dd = float(detail.get("max_drawdown", 0) or 0)
        ntrades = int(detail.get("trades", 0) or 0)

        if ntrades < 5:
            issues.append("Very few trades — result is not statistically reliable.")
        if pf < 1.0:
            issues.append("Profit Factor < 1.0 — this is a losing strategy.")
        if wr < 0.35:
            issues.append("Win rate below 35% — entry logic needs tightening.")
        if dd > 0.25:
            issues.append("Drawdown above 25% — risk per trade is too high.")
        if pf < 1.0 and wr < 0.4:
            fixes.append("Widen stoploss OR add an exit filter to cut losses faster.")
        if ntrades < 5:
            fixes.append("Test on a wider timerange or more pairs.")
        if dd > 0.25:
            fixes.append("Add trailing stop OR reduce position size.")
    except (ValueError, TypeError):
        pass

    lines.append("Issues found:")
    lines.extend(f"• {i}" for i in issues) if issues else lines.append("• None detected")
    lines.append("")
    lines.append("Suggested fixes (review before applying):")
    lines.extend(f"• {f}" for f in fixes) if fixes else lines.append("• Strategy seems OK.")
    lines.append("")
    lines.append(
        "Use aero.preview_edit to review a change, then aero.apply_edit to apply it."
    )

    return json.dumps({"analysis": "\n".join(lines), "run_id": rid}, ensure_ascii=False)


async def _on_preview_edit(args: dict[str, Any]) -> str:
    return json.dumps(
        preview_edit(args["strategy_name"], args["old_text"], args["new_text"]),
        ensure_ascii=False,
    )


async def _on_apply_edit(args: dict[str, Any]) -> str:
    return json.dumps(
        apply_edit(args["strategy_name"], args["old_text"], args["new_text"]),
        ensure_ascii=False,
    )


async def _on_diff_versions(args: dict[str, Any]) -> str:
    return json.dumps(diff_strategies(args["strategy_name"]), ensure_ascii=False)


_HANDLERS: dict[str, Any] = {
    "aero.list_strategies": _on_list_strategies,
    "aero.read_strategy": _on_read_strategy,
    "aero.run_backtest": _on_run_backtest,
    "aero.run_status": _on_run_status,
    "aero.read_results": _on_read_results,
    "aero.analyze_failure": _on_analyze_failure,
    "aero.preview_edit": _on_preview_edit,
    "aero.apply_edit": _on_apply_edit,
    "aero.diff_versions": _on_diff_versions,
}


async def _handle_initialize(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": message.get("id"),
        "result": {
            "protocolVersion": message.get("params", {}).get(
                "protocolVersion", "2024-11-05"
            ),
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": "aero", "version": "0.1.0"},
        },
    }


async def _handle_tools_list(message: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": message.get("id"),
        "result": {"tools": TOOLS},
    }


async def _handle_tools_call(params: dict[str, Any]) -> dict[str, Any]:
    tool_name = params.get("name", "")
    arguments = params.get("arguments", {})
    call_id = params.get("id")

    handler = _HANDLERS.get(tool_name)
    if handler is None:
        return {
            "jsonrpc": "2.0",
            "id": call_id,
            "error": {"code": -32601, "message": f"Unknown tool: {tool_name}"},
        }

    try:
        text = await handler(arguments)
        return {
            "jsonrpc": "2.0",
            "id": call_id,
            "result": {"content": [{"type": "text", "text": text}], "isError": False},
        }
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("tool failed: %s", tool_name)
        return {
            "jsonrpc": "2.0",
            "id": call_id,
            "result": {"content": [{"type": "text", "text": f"ERROR: {exc}"}], "isError": True},
        }


async def run() -> None:
    logger.info("AeRo MCP server ready (stdio)")
    _send({"jsonrpc": "2.0", "method": "notifications/initialized"})

    while True:
        msg = await asyncio.get_running_loop().run_in_executor(None, _recv)
        if msg is None:
            break
        if msg.get("jsonrpc") != "2.0":
            continue

        method = msg.get("method", "")
        call_id = msg.get("id")

        if method == "initialize":
            response = await _handle_initialize(msg)
            _send(response)
        elif method == "shutdown":
            _send({"jsonrpc": "2.0", "id": call_id, "result": {}})
            break
        elif method == "tools/list":
            response = await _handle_tools_list(msg)
            _send(response)
        elif method == "tools/call":
            response = await _handle_tools_call(msg.get("params", {}))
            _send(response)
        else:
            _send({
                "jsonrpc": "2.0",
                "id": call_id,
                "error": {"code": -32601, "message": f"Unknown method: {method}"},
            })

    logger.info("AeRo MCP server stopped.")


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
