import { useEffect, useMemo, useState } from "react";
import SmartPairSelector from "../../../components/SmartPairSelector.jsx";
import { getPairSelectorState } from "../api";
import {
  LAST_USED_PAIR_PRESET_EVENT,
  LAST_USED_PAIR_PRESET_ID,
  PAIR_PRESETS,
  TIMEFRAMES,
} from "../constants";
import { datePreset } from "../formatters";
import { loadLastUsedPairPreset } from "../utils";

export default function SetupPanel({
  form,
  strategies,
  strategiesLoading,
  isRunning,
  submitError,
  setField,
  setPairs,
}) {
  const [availablePairs, setAvailablePairs] = useState([]);
  const [presetId, setPresetId] = useState("");
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetError, setPresetError] = useState("");
  const [lastUsedPreset, setLastUsedPreset] = useState(null);
  const tradesNum = parseInt(form.maxTrades, 10) || 1;
  const numGroups = form.pairs.length > 0 ? Math.ceil(form.pairs.length / tradesNum) : 0;
  const presetOptions = useMemo(
    () => {
      const configuredOptions = PAIR_PRESETS.map((preset) => {
        const pairCount = preset.pairCount ?? availablePairs.length;
        return {
          ...preset,
          pairCount,
          groups: pairCount > 0 ? Math.ceil(pairCount / preset.maxTrades) : 0,
        };
      });

      if (!lastUsedPreset) return configuredOptions;
      return [
        {
          id: LAST_USED_PAIR_PRESET_ID,
          label: "Last used",
          pairCount: lastUsedPreset.pairs.length,
          maxTrades: lastUsedPreset.maxTrades,
          groups: Math.ceil(lastUsedPreset.pairs.length / lastUsedPreset.maxTrades),
          isLastUsed: true,
        },
        ...configuredOptions,
      ];
    },
    [availablePairs.length, lastUsedPreset]
  );

  useEffect(() => {
    let cancelled = false;
    getPairSelectorState()
      .then((data) => {
        if (cancelled) return;
        setAvailablePairs(data.available_pairs || []);
        setPresetError("");
      })
      .catch((err) => {
        if (cancelled) return;
        console.debug("Failed to load pair presets:", err);
        setPresetError("Could not load configured pair presets.");
      })
      .finally(() => {
        if (!cancelled) setPresetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshLastUsedPreset = () => {
      setLastUsedPreset(loadLastUsedPairPreset());
    };

    queueMicrotask(refreshLastUsedPreset);
    if (typeof window === "undefined") return undefined;
    window.addEventListener("storage", refreshLastUsedPreset);
    window.addEventListener(LAST_USED_PAIR_PRESET_EVENT, refreshLastUsedPreset);
    return () => {
      window.removeEventListener("storage", refreshLastUsedPreset);
      window.removeEventListener(LAST_USED_PAIR_PRESET_EVENT, refreshLastUsedPreset);
    };
  }, []);

  const clearPreset = () => {
    if (presetId) setPresetId("");
  };

  const handlePresetChange = (event) => {
    const nextPresetId = event.target.value;
    setPresetId(nextPresetId);
    setPresetError("");
    if (!nextPresetId) return;

    const preset = nextPresetId === LAST_USED_PAIR_PRESET_ID
      ? lastUsedPreset
      : PAIR_PRESETS.find((item) => item.id === nextPresetId);
    if (!preset) {
      setPresetError("Preset is no longer available.");
      return;
    }

    const pairCount = preset.pairCount ?? availablePairs.length;
    const selectedPairs = preset.pairs || availablePairs.slice(0, pairCount);
    setPairs(selectedPairs);
    setField("maxTrades", String(preset.maxTrades));
    if (selectedPairs.length < pairCount) {
      setPresetError(`Only ${selectedPairs.length} configured pairs are available.`);
    }
  };

  const handleManualPairsChange = (pairs) => {
    clearPreset();
    setPairs(pairs);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
          Strategy
        </label>
        {strategiesLoading ? (
          <div className="skeleton h-8 rounded" />
        ) : (
          <select
            className="select select-sm select-bordered w-full font-mono text-xs"
            value={form.strategyName}
            onChange={(event) => {
              clearPreset();
              setField("strategyName", event.target.value);
            }}
            disabled={isRunning}
          >
            <option value="">- pick a strategy -</option>
            {strategies.map((strategy) => (
              <option key={`${strategy.strategy_name}:${strategy.file || ""}`} value={strategy.strategy_name}>
                {strategy.strategy_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
          Timeframe
        </label>
        <select
          className="select select-sm select-bordered w-full font-mono text-xs"
          value={form.timeframe}
          onChange={(event) => {
            clearPreset();
            setField("timeframe", event.target.value);
          }}
          disabled={isRunning}
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
          Date Range
        </label>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "1M", days: 30 },
            { label: "3M", days: 90 },
            { label: "6M", days: 180 },
            { label: "1Y", days: 365 },
            { label: "2Y", days: 730 },
            { label: "3Y", days: 1095 },
            { label: "5Y", days: 1825 },
          ].map(({ label, days }) => (
            <button
              key={label}
              className="btn btn-xs btn-ghost border border-base-300 flex-1"
              disabled={isRunning}
              onClick={() => {
                const { start, end } = datePreset(days);
                clearPreset();
                setField("dateStart", start);
                setField("dateEnd", end);
              }}
            >
              {label} ({days}d)
            </button>
          ))}
        </div>
        <input
          type="date"
          className="input input-sm input-bordered w-full font-mono text-xs"
          value={form.dateStart}
          onChange={(event) => {
            clearPreset();
            setField("dateStart", event.target.value);
          }}
          disabled={isRunning}
        />
        <input
          type="date"
          className="input input-sm input-bordered w-full font-mono text-xs"
          value={form.dateEnd}
          onChange={(event) => {
            clearPreset();
            setField("dateEnd", event.target.value);
          }}
          disabled={isRunning}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
            Wallet
          </label>
          <input
            type="number"
            min="1"
            step="100"
            className="input input-sm input-bordered w-full font-mono text-xs"
            value={form.wallet}
            onChange={(event) => {
              clearPreset();
              setField("wallet", event.target.value);
            }}
            disabled={isRunning}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
            Max Trades
          </label>
          <input
            type="number"
            min="1"
            step="1"
            className="input input-sm input-bordered w-full font-mono text-xs"
            value={form.maxTrades}
            onChange={(event) => {
              clearPreset();
              setField("maxTrades", event.target.value);
            }}
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-base-content/40">
          Pair Preset
        </label>
        <select
          aria-label="Pair preset"
          className="select select-sm select-bordered w-full font-mono text-xs"
          value={presetId}
          onChange={handlePresetChange}
          disabled={isRunning || presetLoading}
        >
          <option value="">Custom/manual</option>
          {presetOptions.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} - {preset.pairCount} pairs, {preset.groups} groups of {preset.maxTrades}
            </option>
          ))}
        </select>
        {presetError && (
          <p className="text-[10px] text-warning/70 leading-snug">{presetError}</p>
        )}
      </div>

      <div className="relative">
        <SmartPairSelector
          value={form.pairs}
          onChange={handleManualPairsChange}
          maxTrades={form.maxTrades}
          onMaxTradesChange={(value) => {
            clearPreset();
            setField("maxTrades", String(value));
          }}
          disabled={isRunning}
        />
        <p className="text-[10px] text-base-content/35 mt-1.5 leading-snug">
          {form.pairs.length === 0
            ? <span className="text-warning/70">Select at least one pair to run.</span>
            : tradesNum === 1
              ? `${form.pairs.length} solo run${form.pairs.length !== 1 ? "s" : ""}`
              : `${form.pairs.length} pairs -> ${numGroups} group${numGroups !== 1 ? "s" : ""} of ${tradesNum}`}
        </p>
      </div>

      {submitError && (
        <div className="alert alert-error text-xs p-2">
          <span>{submitError}</span>
        </div>
      )}
    </div>
  );
}
