"""services/strategy/strategy_source.py contains backend logic for strategy source.

This file is intentionally documented in plain English so readers can follow
what each section does even without deep Python experience.
"""

from __future__ import annotations
import ast
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from ...models import (
    ManagedStatus,
    ParamsSchema,
    StrategyParameterDefinition,
    StrategyProtectionDefinition,
    StrategyRecord,
)
from ...utils import ast_node_name, to_snake_case, utc_now

PARAMETER_CLASS_NAMES = {
    "IntParameter",
    "DecimalParameter",
    "CategoricalParameter",
    "BooleanParameter",
}


@dataclass(slots=True)
class ParsedStrategySource:
    """ParsedStrategySource contains class-level backend logic."""
    record: StrategyRecord
    declared_parameters: dict[str, StrategyParameterDefinition]
    required_methods: set[str]
    raw_defaults: dict[str, Any]
    source_text: str
    sidecar_json: dict[str, Any] | None = None


class StrategySourceParser:
    """StrategySourceParser contains class-level backend logic."""
    def __init__(self, strategies_dir: Path, versions_root: Path) -> None:
        """__init__ implements function-level backend logic."""
        self.strategies_dir = strategies_dir.resolve()
        self.versions_root = versions_root.resolve()

    def parse(self, path: Path) -> ParsedStrategySource:
        """parse implements function-level backend logic."""
        source_text = path.read_text(encoding="utf-8")
        tree = ast.parse(source_text, filename=str(path))
        class_def = self._find_strategy_class(tree)
        if class_def is None:
            raise ValueError("No valid Freqtrade strategy class was found.")

        sidecar_json = self._load_sidecar_json(path, class_def.name)
        assignments = self._collect_assignments(class_def)
        declared_parameters = self._collect_parameters(class_def)
        protections = self._collect_protections(class_def, assignments)
        raw_defaults = {
            "buy_params": self._safe_literal(assignments.get("buy_params"), fallback={}) or {},
            "sell_params": self._safe_literal(assignments.get("sell_params"), fallback={}) or {},
            "minimal_roi": self._safe_literal(assignments.get("minimal_roi"), fallback={}) or {},
            "stoploss": self._safe_literal(assignments.get("stoploss"), fallback=-0.1),
            "trailing_stop": self._safe_literal(assignments.get("trailing_stop"), fallback=False),
            "trailing_stop_positive": self._safe_literal(
                assignments.get("trailing_stop_positive"), fallback=None
            ),
            "trailing_stop_positive_offset": self._safe_literal(
                assignments.get("trailing_stop_positive_offset"), fallback=None
            ),
            "trailing_only_offset_is_reached": self._safe_literal(
                assignments.get("trailing_only_offset_is_reached"), fallback=None
            ),
        }
        if sidecar_json is not None:
            raw_defaults = self._merge_sidecar_raw_defaults(raw_defaults, sidecar_json)
        record = StrategyRecord(
            strategy_name=class_def.name,
            strategy_id=to_snake_case(class_def.name),
            class_name=class_def.name,
            file_path=str(path.resolve()),
            timeframe=self._safe_literal(assignments.get("timeframe")),
            parameter_count=len(declared_parameters),
            protection_count=len(protections),
            managed_status=self._determine_managed_status(path, class_def.name),
            last_modified_timestamp=datetime.fromtimestamp(path.stat().st_mtime),
            indicator_method_names=sorted(
                node.name
                for node in class_def.body
                if isinstance(node, ast.FunctionDef) and node.name.startswith("populate_")
            ),
            parameters=list(declared_parameters.values()),
            protections=protections,
            parse_error=None,
        )
        required_methods = {
            node.name
            for node in class_def.body
            if isinstance(node, ast.FunctionDef)
            and node.name in {"populate_indicators", "populate_entry_trend", "populate_exit_trend"}
        }
        return ParsedStrategySource(
            record=record,
            declared_parameters=declared_parameters,
            required_methods=required_methods,
            raw_defaults=raw_defaults,
            source_text=source_text,
            sidecar_json=sidecar_json,
        )

    def extract_params(self, parsed: ParsedStrategySource, version_id: str) -> ParamsSchema:
        """extract_params implements function-level backend logic."""
        buy_params = parsed.raw_defaults["buy_params"]
        sell_params = parsed.raw_defaults["sell_params"]
        protection_params: dict[str, Any] = {}
        custom_params: dict[str, Any] = {}

        for name, definition in parsed.declared_parameters.items():
            default_value = definition.default
            if definition.space == "buy":
                buy_params.setdefault(name, default_value)
            elif definition.space == "sell":
                sell_params.setdefault(name, default_value)
            elif definition.space == "protection":
                protection_params[name] = default_value
            else:
                custom_params[name] = default_value

        roi_table = {
            str(key): float(value)
            for key, value in (parsed.raw_defaults.get("minimal_roi") or {}).items()
        }
        stoploss = float(parsed.raw_defaults.get("stoploss") or 0.0)
        trailing_stop_positive = parsed.raw_defaults.get("trailing_stop_positive")
        trailing_stop_positive_offset = parsed.raw_defaults.get("trailing_stop_positive_offset")
        return ParamsSchema(
            strategy_name=parsed.record.strategy_name,
            version_id=version_id,
            extracted_at=utc_now(),
            pair_list=None,
            buy_params=buy_params,
            sell_params=sell_params,
            protection_params=protection_params,
            roi_table=roi_table,
            stoploss=stoploss,
            trailing_stop=bool(parsed.raw_defaults.get("trailing_stop")),
            trailing_stop_positive=(
                None if trailing_stop_positive is None else float(trailing_stop_positive)
            ),
            trailing_stop_positive_offset=(
                None
                if trailing_stop_positive_offset is None
                else float(trailing_stop_positive_offset)
            ),
            trailing_only_offset_is_reached=parsed.raw_defaults.get(
                "trailing_only_offset_is_reached"
            ),
            custom_params=custom_params,
        )

    def _find_strategy_class(self, tree: ast.AST) -> ast.ClassDef | None:
        """_find_strategy_class implements function-level backend logic."""
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            base_names = {ast_node_name(base) for base in node.bases}
            method_names = {
                child.name for child in node.body if isinstance(child, ast.FunctionDef)
            }
            if "IStrategy" in base_names or {
                "populate_indicators",
                "populate_entry_trend",
                "populate_exit_trend",
            }.issubset(method_names):
                return node
        return None

    def _collect_assignments(self, class_def: ast.ClassDef) -> dict[str, ast.AST]:
        """_collect_assignments implements function-level backend logic."""
        assignments: dict[str, ast.AST] = {}
        for node in class_def.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        assignments[target.id] = node.value
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                assignments[node.target.id] = node.value
        return assignments

    def _collect_parameters(
        self, class_def: ast.ClassDef
    ) -> dict[str, StrategyParameterDefinition]:
        """_collect_parameters implements function-level backend logic."""
        params: dict[str, StrategyParameterDefinition] = {}
        for node in class_def.body:
            value: ast.AST | None = None
            name: str | None = None
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(
                node.targets[0], ast.Name
            ):
                name = node.targets[0].id
                value = node.value
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                name = node.target.id
                value = node.value
            if name is None or not isinstance(value, ast.Call):
                continue
            parameter_type = ast_node_name(value.func)
            if parameter_type not in PARAMETER_CLASS_NAMES:
                continue
            default = None
            space = None
            for keyword in value.keywords:
                if keyword.arg == "default":
                    default = self._safe_literal(keyword.value)
                if keyword.arg == "space":
                    space = self._safe_literal(keyword.value)
            params[name] = StrategyParameterDefinition(
                name=name,
                parameter_type=parameter_type,
                space=space,
                default=default,
            )
        return params

    def _collect_protections(
        self, class_def: ast.ClassDef, assignments: dict[str, ast.AST]
    ) -> list[StrategyProtectionDefinition]:
        """_collect_protections implements function-level backend logic."""
        protections: list[StrategyProtectionDefinition] = []
        if "protections" in assignments:
            raw = self._safe_literal(assignments["protections"], fallback=None)
            if isinstance(raw, list):
                for entry in raw:
                    protections.append(
                        StrategyProtectionDefinition(source="attribute", detail=str(entry))
                    )
        for node in class_def.body:
            if isinstance(node, ast.FunctionDef) and node.name == "protections":
                protections.append(
                    StrategyProtectionDefinition(source="method", detail="protections()")
                )
        return protections

    def _determine_managed_status(self, path: Path, strategy_name: str) -> ManagedStatus:
        """_determine_managed_status implements function-level backend logic."""
        if not strategy_name:
            return ManagedStatus.EXTERNAL
        try:
            resolved = path.resolve()
        except FileNotFoundError:
            resolved = path
        pointer = self.versions_root / strategy_name / "current_accepted.json"
        if pointer.exists():
            return ManagedStatus.MANAGED
        try:
            resolved.relative_to(self.strategies_dir)
            return ManagedStatus.UNMANAGED
        except ValueError:
            return ManagedStatus.EXTERNAL

    def _safe_literal(self, node: ast.AST | None, fallback: Any = None) -> Any:
        """_safe_literal implements function-level backend logic."""
        if node is None:
            return fallback
        try:
            return ast.literal_eval(node)
        except Exception:
            return fallback

    def _load_sidecar_json(self, path: Path, expected_strategy_name: str) -> dict[str, Any] | None:
        """_load_sidecar_json implements function-level backend logic."""
        json_path = path.with_suffix(".json")
        if not json_path.exists():
            return None
        try:
            payload = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON sidecar file '{json_path.name}': {exc}") from exc
        if not isinstance(payload, dict):
            raise ValueError(f"Sidecar JSON file '{json_path.name}' must contain a JSON object.")
        if "strategy_name" in payload and payload["strategy_name"] != expected_strategy_name:
            raise ValueError(
                f"Sidecar JSON strategy_name {payload['strategy_name']!r} does not match strategy class {expected_strategy_name!r}."
            )
        return payload

    def _merge_sidecar_raw_defaults(
        self, raw_defaults: dict[str, Any], sidecar_json: dict[str, Any]
    ) -> dict[str, Any]:
        """_merge_sidecar_raw_defaults implements function-level backend logic."""
        params = sidecar_json.get("params")
        if params is None:
            return raw_defaults
        if not isinstance(params, dict):
            raise ValueError("Sidecar JSON 'params' must be a JSON object.")

        merged = dict(raw_defaults)
        buy_params = params.get("buy")
        if isinstance(buy_params, dict):
            merged["buy_params"] = {**merged["buy_params"], **buy_params}

        sell_params = params.get("sell")
        if isinstance(sell_params, dict):
            merged["sell_params"] = {**merged["sell_params"], **sell_params}

        roi_table = params.get("roi")
        if isinstance(roi_table, dict):
            merged["minimal_roi"] = {**merged["minimal_roi"], **roi_table}

        stoploss_value = self._parse_sidecar_stoploss(params.get("stoploss"))
        if stoploss_value is not None:
            merged["stoploss"] = stoploss_value

        trailing = params.get("trailing")
        if isinstance(trailing, dict):
            for field in [
                "trailing_stop",
                "trailing_stop_positive",
                "trailing_stop_positive_offset",
                "trailing_only_offset_is_reached",
            ]:
                if field in trailing:
                    merged[field] = trailing[field]

        return merged

    def _parse_sidecar_stoploss(self, value: Any) -> float | None:
        """_parse_sidecar_stoploss implements function-level backend logic."""
        if value is None:
            return None
        if isinstance(value, dict) and "stoploss" in value:
            return float(value["stoploss"])
        if isinstance(value, (int, float)):
            return float(value)
        raise ValueError("Sidecar JSON 'stoploss' must be a number or object containing stoploss.")
