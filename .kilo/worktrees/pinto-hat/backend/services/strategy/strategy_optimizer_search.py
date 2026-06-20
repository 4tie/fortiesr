"""Algorithmic search helpers for strategy optimizer trial selection."""

from __future__ import annotations

import itertools
import random
from typing import Any

from ...models import (
    OptimizerSession,
    OptimizerTrialStatus,
    ParameterSearchSpace,
    ParameterSearchType,
    SearchStrategy,
)


def select_parameters_for_trial(
    session: OptimizerSession,
    spaces: list[ParameterSearchSpace],
    trial_number: int,
) -> dict[str, Any]:
    """Choose the next trial parameter set from the configured search strategy."""
    strategy = session.config.search_strategy
    if strategy == SearchStrategy.RANDOM:
        return _random_search(spaces, trial_number)
    if strategy == SearchStrategy.GRID:
        return _grid_search(spaces, trial_number)
    if strategy == SearchStrategy.BAYESIAN:
        return _bayesian_search(session, spaces, trial_number)
    if strategy == SearchStrategy.EVOLUTIONARY:
        return _evolutionary_search(session, spaces, trial_number)
    return _random_search(spaces, trial_number)


def _random_search(spaces: list[ParameterSearchSpace], trial_number: int) -> dict[str, Any]:
    """Sample parameter values independently at random."""
    params: dict[str, Any] = {}
    roi_spaces = [s for s in spaces if s.name.startswith("roi__")]
    other_spaces = [s for s in spaces if not s.name.startswith("roi__")]

    if roi_spaces:
        params.update(_sample_roi_monotonic(roi_spaces, trial_number))

    for space in other_spaces:
        params[space.name] = _sample_one(space, trial_number)

    return params


def _grid_search(spaces: list[ParameterSearchSpace], trial_number: int) -> dict[str, Any]:
    """Select parameter values from deterministic grid combinations."""
    candidates = list(_grid_candidates(spaces))
    if not candidates:
        return {}

    roi_spaces = [s for s in spaces if s.name.startswith("roi__")]
    if roi_spaces:
        candidates = [c for c in candidates if _is_roi_monotonic(c, roi_spaces)]
    if not candidates:
        return {}

    index = min(trial_number - 1, len(candidates) - 1)
    return candidates[index]


def _bayesian_search(
    session: OptimizerSession,
    spaces: list[ParameterSearchSpace],
    trial_number: int,
) -> dict[str, Any]:
    """Choose parameters using lightweight history-aware exploration."""
    completed = [
        t for t in (session.trials or [])
        if t.status == OptimizerTrialStatus.COMPLETED and t.metrics is not None
    ]
    if not completed:
        return _random_search(spaces, trial_number)

    best = max(completed, key=lambda t: t.metrics.score or float("-inf"))
    params: dict[str, Any] = {}
    roi_spaces = [s for s in spaces if s.name.startswith("roi__")]
    other_spaces = [s for s in spaces if not s.name.startswith("roi__")]

    if roi_spaces:
        params.update(_sample_roi_monotonic(roi_spaces, trial_number))

    for space in other_spaces:
        previous = best.parameters.get(space.name)
        if (
            space.param_type in {ParameterSearchType.INT, ParameterSearchType.DECIMAL}
            and previous is not None
        ):
            if isinstance(previous, (int, float)) and space.min_value is not None and space.max_value is not None:
                span = float(space.max_value) - float(space.min_value)
                delta = max(span * 0.1, float(space.step or 1.0))
                if space.param_type == ParameterSearchType.INT:
                    candidates = [int(previous), int(previous + delta), int(previous - delta)]
                else:
                    candidates = [float(previous), float(previous + delta), float(previous - delta)]
                candidates = [c for c in candidates if c is not None]
                candidates = [
                    min(max(c, float(space.min_value)), float(space.max_value))
                    for c in candidates
                ]
                params[space.name] = random.choice(candidates)
                continue
        if space.param_type == ParameterSearchType.CATEGORICAL and space.choices:
            params[space.name] = previous if previous in space.choices else random.choice(space.choices)
        elif space.param_type == ParameterSearchType.BOOLEAN:
            params[space.name] = previous if isinstance(previous, bool) else random.choice(space.choices or [True, False])
        else:
            params[space.name] = _sample_one(space, trial_number)

    return params


def _evolutionary_search(
    session: OptimizerSession,
    spaces: list[ParameterSearchSpace],
    trial_number: int,
) -> dict[str, Any]:
    """Mutate strong prior trials and blend with random exploration."""
    completed = [t for t in (session.trials or []) if t.status == OptimizerTrialStatus.COMPLETED]
    if not completed:
        return _random_search(spaces, trial_number)

    parent = random.choice(completed)
    params = dict(parent.parameters)
    roi_spaces = [s for s in spaces if s.name.startswith("roi__")]
    other_spaces = [s for s in spaces if not s.name.startswith("roi__")]

    if roi_spaces and random.random() > 0.5:
        params.update(_sample_roi_monotonic(roi_spaces, trial_number))

    for space in other_spaces:
        if random.random() > 0.5:
            continue
        current = params.get(space.name)
        if space.param_type == ParameterSearchType.INT and isinstance(current, int):
            step = int(space.step or 1)
            direction = random.choice([-1, 1])
            value = min(max(current + direction * step, int(space.min_value or 0)), int(space.max_value or current))
            params[space.name] = value
        elif space.param_type == ParameterSearchType.DECIMAL and isinstance(current, (int, float)):
            step = float(space.step or 0.01)
            direction = random.choice([-1, 1])
            value = round(
                min(max(float(current) + direction * step, float(space.min_value or 0.0)), float(space.max_value or current)),
                6,
            )
            params[space.name] = value
        elif space.param_type == ParameterSearchType.CATEGORICAL and space.choices:
            choices = [c for c in space.choices if c != current]
            params[space.name] = random.choice(choices) if choices else current
        elif space.param_type == ParameterSearchType.BOOLEAN:
            params[space.name] = not bool(current if current is not None else False)

    return params


def _grid_candidates(spaces: list[ParameterSearchSpace]) -> list[dict[str, Any]]:
    """Precompute a bounded list of grid candidate combinations."""
    if not spaces:
        return []

    all_values: list[list[Any]] = []
    for space in spaces:
        if space.param_type == ParameterSearchType.BOOLEAN:
            all_values.append(space.choices or [True, False])
        elif space.param_type == ParameterSearchType.CATEGORICAL:
            all_values.append(space.choices or [space.default])
        elif space.param_type == ParameterSearchType.INT:
            lo = int(space.min_value) if space.min_value is not None else 1
            hi = int(space.max_value) if space.max_value is not None else lo
            step = int(space.step) if space.step is not None else 1
            all_values.append(list(range(lo, hi + 1, max(step, 1))) or [lo])
        elif space.param_type == ParameterSearchType.DECIMAL:
            lo = float(space.min_value) if space.min_value is not None else 0.0
            hi = float(space.max_value) if space.max_value is not None else lo
            step = float(space.step) if space.step is not None else 0.01
            count = max(int(round((hi - lo) / step)) + 1, 1)
            values = [round(min(max(lo + i * step, lo), hi), 6) for i in range(count)]
            all_values.append(values or [lo])
        else:
            all_values.append([space.default])

    return [
        {spaces[i].name: combination[i] for i in range(len(spaces))}
        for combination in itertools.product(*all_values)
    ]


def _sample_roi_monotonic(
    roi_spaces: list[ParameterSearchSpace], trial_number: int
) -> dict[str, Any]:
    """Sample ROI parameters ensuring monotonic decrease over time."""
    if not roi_spaces:
        return {}

    sorted_spaces = sorted(roi_spaces, key=lambda s: int(s.name[5:]))
    roi_params: dict[str, Any] = {}
    previous_max = None

    for space in sorted_spaces:
        lo = float(space.min_value) if space.min_value is not None else 0.001
        hi = float(space.max_value) if space.max_value is not None else 0.30
        if previous_max is not None:
            hi = min(hi, previous_max)
        if hi < lo:
            hi = lo
        step = float(space.step) if space.step is not None else 0.001
        steps_count = max(int(round((hi - lo) / step)), 1)
        idx = random.randint(0, steps_count)
        value = lo + idx * step
        decimals = len(str(step).rstrip("0").split(".")[-1]) if "." in str(step) else 3
        value = round(min(max(value, lo), hi), decimals)
        roi_params[space.name] = value
        previous_max = value

    return roi_params


def _is_roi_monotonic(candidate: dict[str, Any], roi_spaces: list[ParameterSearchSpace]) -> bool:
    """Check whether ROI values decrease over time."""
    roi_entries: list[tuple[int, float]] = []
    for space in roi_spaces:
        if space.name in candidate:
            roi_entries.append((int(space.name[5:]), float(candidate[space.name])))
    if len(roi_entries) <= 1:
        return True
    roi_entries.sort(key=lambda x: x[0])
    return all(roi_entries[i][1] >= roi_entries[i + 1][1] for i in range(len(roi_entries) - 1))


def _sample_one(space: ParameterSearchSpace, trial_number: int) -> Any:
    """Sample one value from one search-space definition."""
    if space.param_type == ParameterSearchType.BOOLEAN:
        return random.choice(space.choices or [True, False])
    if space.param_type == ParameterSearchType.CATEGORICAL:
        choices = space.choices or []
        return random.choice(choices) if choices else space.default
    if space.param_type == ParameterSearchType.INT:
        lo = int(space.min_value) if space.min_value is not None else 1
        hi = int(space.max_value) if space.max_value is not None else 100
        step = int(space.step) if space.step is not None else 1
        candidates = list(range(lo, hi + 1, max(step, 1)))
        return random.choice(candidates) if candidates else lo
    if space.param_type == ParameterSearchType.DECIMAL:
        lo = float(space.min_value) if space.min_value is not None else 0.0
        hi = float(space.max_value) if space.max_value is not None else 1.0
        step = float(space.step) if space.step is not None else 0.01
        steps_count = max(int(round((hi - lo) / step)), 1)
        idx = random.randint(0, steps_count)
        value = lo + idx * step
        decimals = len(str(step).rstrip("0").split(".")[-1]) if "." in str(step) else 2
        return round(min(max(value, lo), hi), decimals)
    return space.default
