# AutoQuant Premium Workflow Pipeline — Visual Polish Design

## Overview

**Scope**: Visual-only polish pass on the 7-stage AutoQuant pipeline UI.  
**Constraints**: No backend changes, no WebSocket logic changes, no final status classification changes, no event-to-step mapping changes, no new features.  
**Theme**: Glassmorphism dark — `base-100: #15151F`, `primary: #8B5CF6`, `success: #5EE2B5`, `warning: #F5B544`, `error: #F26D6D`. Tailwind 4 + daisyUI 5.

---

## 1. Design Principles

| Principle | Application |
|-----------|-------------|
| **Progressive disclosure** | Headers always visible; details only when expanded |
| **State hierarchy** | Running > Passed > Failed/Warning > Pending — visual weight matches urgency |
| **Visual calm** | Pending/skipped stages recede; active stage pulls focus without screaming |
| **Scanability** | Metrics in grids, not prose; labels uppercase tiny, values large mono |
| **Depth not brightness** | Use border thickness, shadow size, and opacity — not saturated fills — to denote importance |

---

## 2. Color & State Token System

All state colors must use daisyUI semantic tokens. No hardcoded hex values in components.

| State | Border | Background fill | Icon/text | Shadow |
|-------|--------|-----------------|-----------|--------|
| `pending` | `border-base-300/40` | `bg-base-200/30` | `text-base-content/35` | none |
| `running` | `border-primary/40` | `bg-primary/8` | `text-primary` | `shadow-sm shadow-primary/10` |
| `passed` | `border-success/25` | `bg-success/5` | `text-success/85` | none |
| `failed` | `border-error/35` | `bg-error/8` | `text-error` | none |
| `warning` | `border-warning/35` | `bg-warning/8` | `text-warning` | none |
| `skipped` | `border-base-300/30` | `bg-base-200/20` | `text-base-content/25` | none |

---

## 3. AutoQuantPipelineCard — Component Design

### 3.1 Card Shell
- Outer `card` with `rounded-xl` and `transition-all duration-200`
- Border and background derived from state token table above
- Running state: add a very subtle left accent bar (`border-l-2 border-l-primary`) for extra visual pop
- No `neon-glow` on individual step cards — reserve glow effects for the dashboard header and stepper

### 3.2 Card Header (always visible)
```
┌─────────────────────────────────────────────────────────┐
│ [Step number icon] [Step name]   [Status badge]  [⌄/▶]  │
│                    [One-line description]                 │
│                    [Short status message if passed/fail] │
└─────────────────────────────────────────────────────────┘
```
- Step number icon: `w-9 h-9 rounded-lg` with state-colored background. Number in `font-mono text-sm font-bold`. Running state: add `ring-1 ring-primary/30`.
- Step name: `text-sm font-semibold text-base-content` — NOT truncated (wrap is fine)
- Status badge: pushed to the right via `ml-auto` on a flex row. Never in the middle of the title row.
- Duration: shown as `(45s)` in `text-[10px] font-mono text-base-content/35` after the badge for `passed` only
- Expand toggle: `btn-ghost btn-xs btn-circle` with explicit `aria-label`. Chevron rotates 90° via `transition-transform`.
- Description line: `text-xs text-base-content/55 mt-1 leading-relaxed` — always visible, max 2 lines

### 3.3 Status Badge — Revised
Remove inline CSS `style` props using CSS var string interpolation. Replace with Tailwind utility classes using a `cn`-style mapping object:

```js
const STATUS_CLASSES = {
  pending:  "bg-base-300/25 border-base-300/40  text-base-content/40",
  running:  "bg-primary/10  border-primary/30   text-primary  animate-pulse",
  passed:   "bg-success/10  border-success/25   text-success/85",
  failed:   "bg-error/10    border-error/30     text-error",
  warning:  "bg-warning/10  border-warning/25   text-warning",
  skipped:  "bg-base-300/20 border-base-300/30  text-base-content/25",
};
```
- Badge has `rounded-full border px-2.5 py-0.5 text-xs font-medium flex items-center gap-1.5`
- Running icon: `loading loading-spinner loading-xs` (daisyUI) instead of `animate-spin` on a HeroIcon — cleaner

### 3.4 Expanded Section — Layout

Sections appear in this fixed order with consistent spacing (`space-y-4 pt-4`):

1. **Why this matters** — `InformationCircleIcon` accent, indented block
2. **Inputs** — horizontal flex-wrap of `badge badge-xs badge-ghost` chips
3. **Checks** — icon+text list, icons stateful (✓/⚠/✗ based on final stage status)
4. **Metrics** — 2-column grid of `MetricItem` rows inside a `bg-base-200/40 rounded-lg p-3`
5. **Pairs / WFO windows** — badge chips or count line
6. **Warnings** — amber callout box (only if present)
7. **Errors** — red callout box (only if present)
8. **Running message** — animated spinner row (only when `running`)
9. **Pending empty state** — centered icon + message (only when `pending` with no data)

Each section separated by a subtle `<div className="h-px bg-base-200/60" />` divider instead of always-on `border-t`.

### 3.5 Empty State
Replace the plain `<ClockIcon>` with:
- Step number in `text-3xl font-mono text-base-content/12` centered
- Below it: `text-xs text-base-content/35` — "Waiting to start"
- No bold text, no dark icon — this state should be barely noticeable

### 3.6 MetricItem — Polished
```
label (text-[10px] text-base-content/50 uppercase tracking-wide) ........... value (text-xs font-mono font-semibold text-base-content)
```
- `border-b border-base-200/50 last:border-0 py-1.5`
- Numbers right-aligned in `text-right` column
- Null values: `—` (em dash) not "Not available"

### 3.7 Warnings / Errors Callout
- Warnings: `bg-warning/8 border border-warning/20 rounded-lg p-3`
  - Header: `text-[10px] font-semibold uppercase tracking-wider text-warning/80`
  - Each item: `ExclamationTriangleIcon h-3.5 w-3.5 text-warning/70` + translated message
- Errors: `bg-error/8 border border-error/25 rounded-lg p-3`
  - Translated user message prominent (`text-xs text-error/90`)
  - Raw technical string secondary below in `text-[10px] font-mono text-error/50 break-all pl-5`

---

## 4. AutoQuantStageStepper — Design

The stepper is the compact sidebar progress tracker.

### 4.1 Container
- `space-y-1` between rows (was `gap-1.5`)
- No outer card wrapper — let the dashboard card wrap it

### 4.2 Stage Row
```
┌──────────────────────────────────────────────────────┐
│  [icon]  S01  Stage Name           [badge/time]       │
│   |      Short metric summary (passed only)           │
└──────────────────────────────────────────────────────┘
```
- Row padding: `px-3 py-2 rounded-xl`
- Running row: `ring-1 ring-primary/25` in addition to bg/border — makes it visually pop from the list without being gaudy
- Pending rows: `opacity-50` (whole row) so they visually recede
- Connector line between steps: `w-px h-3 bg-base-300/40` — only show on non-last items; grows to `bg-success/35` when preceding stage passed

### 4.3 Running State Label
- Replace `<span className="badge badge-xs badge-primary animate-pulse">live</span>` with a simpler pulsing dot: `<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />`
- The elapsed timer stays in `font-mono text-[10px] text-primary/70`

### 4.4 Failed Stage Error
- Replace raw `<details>` tag with a styled `<div>` collapsible (chevron button + conditional render)
- Error text in `bg-error/5 border border-error/15 rounded-lg p-2 text-[10px] font-mono text-error/70`

---

## 5. AutoQuantRunDashboard — Layout Polish

### 5.1 Pipeline Cards Grid
The 7 pipeline cards currently render in a `space-y-?` list. Polish:
- Container: `space-y-2.5` (was `space-y-4` equivalent)
- Running card: automatically expanded (`isExpanded={stage.status === 'running'}`)
- Passed cards: collapsed by default, user can expand
- Failed/warning cards: automatically expanded
- Pending cards: collapsed, header only visible

### 5.2 View Mode Toggle
Replace the current text buttons with a compact `join` group:
```jsx
<div className="join">
  <button className={`join-item btn btn-xs ${viewMode === 'compact' ? 'btn-primary' : 'btn-ghost border-base-300/40'}`}>Compact</button>
  <button className={`join-item btn btn-xs ${viewMode === 'detailed' ? 'btn-primary' : 'btn-ghost border-base-300/40'}`}>Detailed</button>
</div>
```

### 5.3 Run Header Card
- Keep `neon-glow` on the header card (it's the primary action area)
- Progress bar: increase to `h-1.5` (was `h-1`) for better visibility
- Status dot: keep existing `StatusDot` — clean enough

### 5.4 Summary Cells
- `SummaryCell` already has `hover:scale-105` — keep
- Reduce border from `border-primary/30` to `border-primary/20` for pending state; increase to `border-primary/40` for running state

---

## 6. AutoQuantFinalResultCard — Design

### 6.1 Card Header
- Replace the plain `ChartBarIcon + text` header with:
  ```
  [Status-colored Icon]  Final Result   [Status badge right-aligned]
  ```
- Status badge uses same token system as PipelineCard

### 6.2 StatusBanner
Remove inline `style` props. Use Tailwind utility classes via a mapping object (same pattern as PipelineCard `STATUS_CLASSES`).

Revised layout:
```
┌─────────────────────────────────────────────────────┐
│ [Icon in status-colored bg]  EXPORT READY           │
│                              Strategy passes all... │
│                              Reason: ...            │
│                              [▶ Technical details]  │
└─────────────────────────────────────────────────────┘
```
- Icon container: `p-2 rounded-lg` with `bg-{status}/15`
- Title: `text-base font-bold` (slightly larger than current `text-sm`)
- Description: `text-xs text-base-content/60 mt-0.5`
- Reason: `text-xs font-medium text-base-content/75 mt-2 border-t border-base-200/60 pt-2`

### 6.3 MetricGrid
- Current `grid-cols-2 sm:grid-cols-3` — keep responsive grid
- Each cell: increase padding to `p-3.5`, add `hover:border-primary/25 transition-colors`
- Value: `text-base font-mono font-bold` (was `text-sm`) — easier to scan
- Label: `text-[10px] font-semibold uppercase tracking-wider text-base-content/45`
- Threshold hint: `text-[10px] text-base-content/35 mt-0.5` — subtle, not competing

### 6.4 Selected Pairs
- Pair badges: `badge badge-xs badge-success badge-outline` — keep
- Truncated "+N more": same ghost badge style — keep
- Section label: consistent with other section headers (`text-xs font-semibold uppercase tracking-wider text-base-content/50`)

### 6.5 Configuration Summary
- Inline `flex justify-between` rows — keep pattern
- Values: `font-mono text-xs text-base-content/80` (slightly more visible)

### 6.6 Exported Files
- Empty state: `DocumentArrowDownIcon h-8 w-8 text-base-content/20` centered with `text-xs text-base-content/35 mt-2`
- File button: add `group` class, file icon gets `group-hover:text-primary transition-colors`
- File type label: `text-[10px] text-base-content/40 capitalize mt-0.5`

### 6.7 Technical Details Toggle
- The current inline `button` in StatusBanner needs explicit `type="button"` (already has it — keep)
- Collapsed details: `bg-base-200/40 rounded-lg p-2.5` with `text-[10px] font-mono text-base-content/45`

---

## 7. AutoQuantFailureReport — Design

### 7.1 Top-level Failure Shell
```
┌─ error/8 bg, error/30 border ──────────────────────────┐
│ [XCircle/Warning icon]  Pipeline Failed                 │
│                         Stage 4 — WFA Hyperopt          │
│                                                         │
│ WHAT HAPPENED                                           │
│ [translated user-friendly message — text-sm prominent]  │
│                                                         │
│ NEXT STEPS                                              │
│ • Bullet 1                                              │
│ • Bullet 2                                              │
│ • Bullet 3                                              │
│                                                         │
│ [▶ Technical details]  ← collapsed by default          │
└────────────────────────────────────────────────────────┘
```

### 7.2 What Happened Section
- `text-sm text-base-content/85 font-medium leading-relaxed` — friendly message is the largest text after the title
- Section eyebrow: `text-[10px] uppercase tracking-wider text-error/60 mb-1` (or warning-colored for sharp_peak)

### 7.3 Suggested Actions
- Eyebrow: "NEXT STEPS"
- Bullet list: `ul` with `space-y-1`, each `li` has `flex items-start gap-2 text-xs text-base-content/70`
- No list-disc — use a small `ChevronRightIcon h-3 w-3 text-base-content/35 mt-0.5 shrink-0` as the bullet

### 7.4 Retry History (RetryHistoryTable)
- Collapsed by default behind a `"▶ Show attempt history (N attempts)"` toggle
- When open: each attempt in `bg-base-200/40 rounded-lg border border-base-300/40 p-3`
- Badges horizontally scrollable if many
- Metrics comparison: stay as 2-column before/after grid
- Action buttons (Accept/Reject): `btn btn-xs btn-success` / `btn btn-xs btn-error` — keep

### 7.5 GeneralizationFailurePanel
- Use `ErrorDisplay` component as-is (already consistent)
- Active gates badges: keep the `badge-outline` style
- Best attempt file artifact: `bg-base-200/50 rounded-lg p-2.5` with `DocumentTextIcon h-4 w-4 text-warning/70`
- Retry with Relaxed Thresholds button: `btn btn-sm btn-outline btn-warning gap-2 w-full` — keep

### 7.6 Technical Details
- Always collapsed by default — `showTechnicalDetails` starts `false` ✓
- Show/hide button: `text-[10px] text-base-content/40 hover:text-base-content/60 flex items-center gap-1 mt-2`
- Content: `bg-base-300/25 rounded p-2 text-[10px] font-mono text-base-content/50 max-h-32 overflow-y-auto`

---

## 8. Responsive Design Rules

| Breakpoint | Pipeline cards | Stage stepper | Final result | Failure report |
|------------|---------------|---------------|-------------|----------------|
| Mobile `< sm` | Full width, stacked | Full width above cards | Full width | Full width |
| Tablet `sm-lg` | Full width | Sidebar `lg:col-span-1` | 2-col metric grid | Full width |
| Desktop `>= lg` | `lg:col-span-2` content | `lg:col-span-1` sidebar | 3-col metric grid | Full width |

- No horizontal overflow on any card at any width
- Metric grid cells must not shrink below `min-w-[100px]`
- Pair badge wraps, never overflows
- File list buttons wrap label text, never clip

---

## 9. Pipeline Progress Feeling

### Current issues
- No visual "spine" connecting the 7 steps
- Active step doesn't pull enough attention
- Pending steps have same visual weight as completed ones

### Solution
**StageStepper spine connector**: Make connector lines between steps form a continuous vertical track. The filled portion (passed stages) uses `bg-success/40`, upcoming portion uses `bg-base-300/30`. Connector height exactly bridges the gap between icons.

**Running stage emphasis**: Apply `ring-2 ring-primary/20 ring-offset-1 ring-offset-base-200` to the running stage icon container. Keeps emphasis subtle but unmistakable.

**Pending stages**: Entire row at `opacity-45` unless it's immediately next (the one after `running`). That next-up stage gets `opacity-70` as a soft preview.

---

## 10. Theme Consistency Audit

The current code uses a mix of:
- Tailwind opacity modifier syntax: `bg-primary/10` ✓
- Inline CSS `style={{ color: 'var(--primary)' }}` ✗ (needs removal from `StatusBadge` and `StatusBanner`)
- `neon-glow` custom class (defined in index.css) — **keep only on the dashboard run header card**, remove from individual pipeline step cards
- `crt-flicker` and `cyber-grid` — keep only on the AutoQuantTab page header

### Classes to remove from step cards
- `neon-glow` (step-level glow is too noisy)
- `scan-effect` (same)
- `crt-flicker` on step names

---

## 11. QA Plan

### Automated Tests (no changes to logic)
```
npx jest --testPathPatterns="eventToStepMapper|pipelineSteps|AutoQuantPipelineCard|AutoQuantFinalResultCard|errorTranslator" --no-coverage
```
These tests must pass without modification (they test logic, not visual classes).

### Visual Checklist (manual)
- [ ] Running card stands out clearly among 7 cards
- [ ] Completed cards feel calm/subdued, not bright
- [ ] Pending cards visually recede
- [ ] Failed/warning cards are clear but not alarming
- [ ] Expand/collapse chevron visible and intuitive
- [ ] Empty "waiting to start" state is minimal
- [ ] Metrics are scannable (grid layout, mono font)
- [ ] Technical details default to collapsed
- [ ] No horizontal overflow at 375px viewport
- [ ] No broken spacing at 1440px viewport
- [ ] Failure friendly message is the most prominent text in failure view
- [ ] Retry history collapsed by default
- [ ] Final result status banner immediately communicates outcome
- [ ] File download buttons have clear affordance
- [ ] Browser console: zero new warnings after changes

---

## 12. Files to Modify

| File | Changes |
|------|---------|
| `components/autoquant/AutoQuantPipelineCard.jsx` | StatusBadge (remove inline styles), card shell tokens, empty state, MetricItem, section dividers, expanded auto-open logic |
| `components/autoquant/AutoQuantStageStepper.jsx` | Running stage ring, pending opacity, connector line polish, live badge → dot, failed error collapsible |
| `components/autoquant/AutoQuantFinalResultCard.jsx` | StatusBanner (remove inline styles), metric cell sizing, file list hover state, section headers |
| `components/autoquant/AutoQuantFailureReport.jsx` | Failure shell layout, "What Happened" prominence, next steps bullets, retry history default-collapsed |
| `features/autoquant/components/AutoQuantRunDashboard.jsx` | View toggle join group, pipeline card auto-expand logic, summary cell border tokens |

**Files NOT to modify**: `eventToStepMapper.js`, `pipelineSteps.js`, `errorTranslator.js`, `viewModel.js`, any backend files, any WebSocket hooks.
