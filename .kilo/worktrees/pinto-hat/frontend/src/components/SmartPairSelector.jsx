/**
 * SmartPairSelector — drop-in replacement for the Trading Pairs input.
 *
 * Props:
 *   value               string[]   – currently selected pairs (controlled)
 *   onChange            fn         – called with new string[] when selection changes
 *   onMaxTradesChange   fn         – called with new number when max trades changes
 *   disabled            bool       – disables trigger and all interactions
 */
import { useState, useEffect, useRef, useCallback } from "react";

const API = {
  state:        ()            => fetch("/api/pairs").then(r => r.json()),
  search:       (q)           => fetch(`/api/pairs/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
  toggleFav:    (pair)        => fetch("/api/pairs/toggle-favorite",  { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({pair}) }).then(r => r.json()),
  toggleLock:   (pair)        => fetch("/api/pairs/toggle-lock",      { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({pair}) }).then(r => r.json()),
  toggleSelect: (pair, sel)   => fetch("/api/pairs/toggle-select",    { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({pair, selected: sel}) }).then(r => r.json()),
  randomize:    ()            => fetch("/api/pairs/randomize",        { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({preserve_locked: true}) }).then(r => r.json()),
  updateMax:    (n)           => fetch("/api/pairs/update-max-trades",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({max_open_trades: n}) }).then(r => r.json()),
  clear:        ()            => fetch("/api/pairs/clear",            { method:"POST" }).then(r => r.json()),
};

function absorb(data, setPs, setMaxInput, onChange, onMaxTradesChange) {
  if (!data) return;
  const selected  = new Set(data.selected_pairs  || []);
  const favorites = new Set(data.favorite_pairs  || []);
  const locked    = new Set(data.locked_pairs    || []);
  const max       = data.max_open_trades ?? 1;
  setPs({ available: data.available_pairs || [], selected, favorites, locked, maxTrades: max });
  setMaxInput(String(max));
  if (onChange) onChange([...selected]);
  if (onMaxTradesChange) onMaxTradesChange(max);
}

export default function SmartPairSelector({ value, onChange, onMaxTradesChange, disabled }) {
  const [ps, setPs]           = useState({ available: [], selected: new Set(), favorites: new Set(), locked: new Set(), maxTrades: 1 });
  const [maxInput, setMaxInput] = useState("1");
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState("");
  const [busy, setBusy]         = useState(new Set());
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const wrapRef  = useRef(null);
  const maxTimer = useRef(null);
  const searchTimer = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    API.state()
      .then(data => absorb(data, setPs, setMaxInput, onChange, onMaxTradesChange))
      .catch(() => setError("Failed to load pairs"))
      .finally(() => setLoading(false));
  // run once on mount — onChange/onMaxTradesChange refs don't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await API.search(search);
        setSearchResults(data.matches || []);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 200);
  }, [search]);

  // ── mutation helper ───────────────────────────────────────────────────────
  const mutate = useCallback(async (key, fn) => {
    setBusy(b => new Set([...b, key]));
    try {
      const data = await fn();
      absorb(data, setPs, setMaxInput, onChange, onMaxTradesChange);
      setError(null);
    } catch (e) {
      setError(e.message || "Action failed");
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(key); return n; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, onMaxTradesChange]);

  const handleToggleFav    = (e, pair) => { e.stopPropagation(); mutate(`fav-${pair}`,  () => API.toggleFav(pair)); };
  const handleToggleLock   = (e, pair) => { e.stopPropagation(); mutate(`lock-${pair}`, () => API.toggleLock(pair)); };
  const handleToggleSelect = (pair)    => { mutate(`sel-${pair}`, () => API.toggleSelect(pair, !ps.selected.has(pair))); };
  const handleRandomize    = ()        => { mutate("randomize",   () => API.randomize()); };
  const handleClear        = ()        => { mutate("clear",       () => API.clear()); };

  const handleMaxInput = (raw) => {
    setMaxInput(raw);
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 1) return;
    if (maxTimer.current) clearTimeout(maxTimer.current);
    maxTimer.current = setTimeout(() => mutate("max", () => API.updateMax(n)), 600);
  };

  // ── display list (favorites pinned, filtered by search) ──────────────────
  const displayList = (() => {
    const q = search.trim().toUpperCase();
    if (q && searchResults.length > 0) {
      return searchResults;
    }
    const base = q ? ps.available.filter(p => p.includes(q)) : ps.available;
    const favs   = base.filter(p => ps.favorites.has(p)).sort();
    const others = base.filter(p => !ps.favorites.has(p)).sort();
    return [...favs, ...others];
  })();

  const selectedArr = [...ps.selected];
  const atLimit = selectedArr.length >= ps.maxTrades;

  // ── trigger label ─────────────────────────────────────────────────────────
  const triggerLabel = (() => {
    if (loading)               return "Loading pairs…";
    if (selectedArr.length === 0) return null;
    const first2 = selectedArr.slice(0, 2).join(", ");
    return selectedArr.length > 2 ? `${first2}  +${selectedArr.length - 2} more` : first2;
  })();

  return (
    <div className="form-control" ref={wrapRef}>
      <label className="label">
        <span className="label-text font-medium">Trading Pairs</span>
        <span className="label-text-alt text-base-content/50">
          {selectedArr.length > 0
            ? <span className={`font-mono ${atLimit ? "text-warning" : ""}`}>{selectedArr.length} / {ps.maxTrades} selected</span>
            : "Click to choose pairs"}
        </span>
      </label>

      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`input input-bordered w-full text-left flex items-center justify-between gap-2 px-3 cursor-pointer transition-colors
          ${open ? "border-primary/60 ring-1 ring-primary/20" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-base-content/30"}
        `}
      >
        <span className={`flex-1 truncate font-mono text-sm ${triggerLabel ? "text-base-content/80" : "text-base-content/30 italic"}`}>
          {triggerLabel || "Select trading pairs…"}
        </span>
        {loading
          ? <span className="loading loading-spinner loading-xs text-primary shrink-0" />
          : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-base-content/30 transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
        }
      </button>

      {/* ── Popover panel ── */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-sm bg-base-100 border border-base-300 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          style={{ top: "calc(100% + 4px)", left: 0, maxHeight: "420px" }}
        >
          {error && (
            <div className="px-3 pt-2 pb-0">
              <div className="text-[10px] text-error bg-error/10 border border-error/20 rounded px-2 py-1">{error}</div>
            </div>
          )}

          {/* Top controls */}
          <div className="px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-base-300/60">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/25 text-xs pointer-events-none select-none">🔍</span>
              <input
                type="text"
                placeholder="Filter pairs…"
                className="input input-xs input-bordered w-full pl-7 font-mono text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
              {searchLoading && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs text-primary" />}
              {search && !searchLoading && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 text-xs" onClick={() => setSearch("")}>✕</button>
              )}
            </div>

            {/* Max trades + action buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-base-content/40 font-semibold uppercase tracking-wider shrink-0">Max</span>
              <input
                type="number"
                min={1}
                className="input input-xs input-bordered w-14 text-center font-mono text-xs"
                value={maxInput}
                onChange={e => handleMaxInput(e.target.value)}
              />
              <div className="flex-1"/>
              <button
                type="button"
                disabled={busy.has("randomize")}
                onClick={handleRandomize}
                className="btn btn-xs gap-1 btn-ghost border border-base-300 hover:border-primary/40 hover:text-primary disabled:opacity-40"
                title="Randomize selection (respects max trades, preserves locks)"
              >
                {busy.has("randomize") ? <span className="loading loading-spinner loading-xs"/> : "🎲"}
                <span className="text-[10px]">Randomize</span>
              </button>
              <button
                type="button"
                disabled={busy.has("clear")}
                onClick={handleClear}
                className="btn btn-xs gap-1 btn-ghost border border-base-300 hover:border-error/40 hover:text-error disabled:opacity-40"
                title="Clear all unlocked pairs"
              >
                {busy.has("clear") ? <span className="loading loading-spinner loading-xs"/> : "✕"}
                <span className="text-[10px]">Clear</span>
              </button>
            </div>
          </div>

          {/* Pair list */}
          <div className="overflow-y-auto flex-1 px-1.5 py-1.5">
            {displayList.length === 0 && (
              <div className="text-center py-5 text-xs text-base-content/25 italic">
                {search ? "No matches found." : "No pairs available."}
              </div>
            )}
            {displayList.map(pair => {
              const isSel      = ps.selected.has(pair);
              const isFav      = ps.favorites.has(pair);
              const isLock     = ps.locked.has(pair);
              const isBusySel  = busy.has(`sel-${pair}`);
              const isBusyFav  = busy.has(`fav-${pair}`);
              const isBusyLock = busy.has(`lock-${pair}`);
              const canSelect  = isSel || !atLimit;

              return (
                <div
                  key={pair}
                  onClick={() => { if (!isBusySel && canSelect) handleToggleSelect(pair); }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 transition-colors cursor-pointer group select-none
                    ${isSel ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-base-200/70"}
                    ${!canSelect && !isSel ? "opacity-40 cursor-not-allowed" : ""}
                  `}
                >
                  {/* Checkbox */}
                  <div className="shrink-0 w-4 flex items-center justify-center">
                    {isBusySel
                      ? <span className="loading loading-spinner loading-xs text-primary"/>
                      : <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={isSel}
                          disabled={!canSelect && !isSel}
                          onChange={() => {}}
                          onClick={e => { e.stopPropagation(); if (!isBusySel && canSelect) handleToggleSelect(pair); }}
                          readOnly
                        />
                    }
                  </div>

                  {/* Pair name */}
                  <span className={`flex-1 font-mono text-xs truncate ${isSel ? "text-base-content/90 font-semibold" : "text-base-content/60"}`}>
                    {pair}
                  </span>

                  {/* Locked badge */}
                  {isLock && <span className="text-[9px] text-warning/60 font-mono leading-none">locked</span>}

                  {/* Favorite */}
                  <button
                    type="button"
                    onClick={e => handleToggleFav(e, pair)}
                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-sm transition-colors leading-none
                      ${isFav ? "text-yellow-400" : "text-base-content/10 group-hover:text-base-content/25 hover:!text-yellow-400"}
                      ${isBusyFav ? "pointer-events-none" : ""}
                    `}
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    {isBusyFav ? <span className="loading loading-spinner loading-xs"/> : "★"}
                  </button>

                  {/* Lock toggle */}
                  <button
                    type="button"
                    onClick={e => handleToggleLock(e, pair)}
                    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-[11px] transition-colors
                      ${isLock ? "text-warning hover:text-warning/60" : "text-base-content/10 group-hover:text-base-content/25 hover:!text-warning/60"}
                      ${isBusyLock ? "pointer-events-none" : ""}
                    `}
                    title={isLock ? "Unlock (will be affected by clear/randomize)" : "Lock (survives clear and randomize)"}
                  >
                    {isBusyLock ? <span className="loading loading-spinner loading-xs"/> : (isLock ? "🔒" : "🔓")}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer: selected badges */}
          {selectedArr.length > 0 && (
            <div className="border-t border-base-300/60 px-3 py-2 flex flex-wrap gap-1.5 bg-base-200/40 max-h-24 overflow-y-auto">
              {selectedArr.map(p => (
                <span key={p} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border
                  ${ps.locked.has(p) ? "border-warning/30 text-warning/70 bg-warning/5" : "border-primary/25 text-primary/80 bg-primary/5"}
                `}>
                  {ps.locked.has(p) && <span className="text-[9px]">🔒</span>}
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
