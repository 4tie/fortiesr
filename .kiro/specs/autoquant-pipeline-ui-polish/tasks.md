# AutoQuant Pipeline UI Polish — Tasks

## Task 1: Polish AutoQuantPipelineCard

**File**: `frontend/src/components/autoquant/AutoQuantPipelineCard.jsx`

### Sub-tasks

- [ ] 1.1 Replace `StatusBadge` inline `style` props with Tailwind utility class mapping object (`STATUS_CLASSES`). Replace `animate-spin` on HeroIcon with daisyUI `loading loading-spinner loading-xs` for running state.
- [ ] 1.2 Apply state token system to card shell: use `border-l-2 border-l-primary` accent on running state; reduce pending border opacity; use `shadow-sm shadow-primary/10` only on running.
- [ ] 1.3 Fix header layout: status badge right-aligned via `ml-auto`; step description always visible; duration shown as `(45s)` after badge for passed only.
- [ ] 1.4 Auto-expand logic: use `defaultExpanded` prop (already exists). In the parent, pass `defaultExpanded={stage.status === 'running' || stage.status === 'failed' || stage.status === 'warning'}`. Inside the component, keep local `useState(defaultExpanded)` so the user can still manually collapse/expand after the initial render. Do NOT use a permanently forced prop that overrides user interaction.
- [ ] 1.5 Replace section `border-t` dividers with `<div className="h-px bg-base-200/60" />` between sections in expanded area.
- [ ] 1.6 Polish empty state: replace `ClockIcon` with step-number watermark in `text-3xl font-mono text-base-content/12` + `"Waiting to start"` text in `text-xs text-base-content/35`.
- [ ] 1.7 Replace null metric values `"Not available"` with em-dash `—`.
- [ ] 1.8 Add `transition-transform duration-200` to expand chevron; chevron rotates from `rotate-0` (collapsed) to `rotate-90` (expanded).

### Acceptance
Tests in `AutoQuantPipelineCard.test.jsx` pass unchanged. No inline `style` props remain in component. Running card expands by default in storybook/browser.

---

## Task 2: Polish AutoQuantStageStepper

**File**: `frontend/src/components/autoquant/AutoQuantStageStepper.jsx`

### Sub-tasks

- [ ] 2.1 Running stage row: add `ring-1 ring-primary/20 ring-offset-1 ring-offset-base-200` to running stage icon container for visual emphasis.
- [ ] 2.2 Pending rows: apply `opacity-50` to entire pending row div. The immediately-next pending row (index === running index + 1) gets `opacity-70`.
- [ ] 2.3 Connector line: change from fixed `bg-base-300/40` to conditional `bg-success/35` when the preceding stage is `passed`, `bg-base-300/35` otherwise. Connector height `h-3`.
- [ ] 2.4 Replace `<span className="badge badge-xs badge-primary animate-pulse">live</span>` with `<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" aria-label="Running" />`.
- [ ] 2.5 Replace `<details>` / `<summary>` failed error disclosure with a styled chevron-toggle div: button shows "Error details" with ChevronRightIcon that rotates on open; error text in `bg-error/5 border border-error/15 rounded-lg p-2 text-[10px] font-mono text-error/70 mt-1`.

### Acceptance
Tests in `AutoQuantStageStepper.test.jsx` pass. No `<details>` element rendered for failed stages. Running stage has ring class.

---

## Task 3: Polish AutoQuantFinalResultCard

**File**: `frontend/src/components/autoquant/AutoQuantFinalResultCard.jsx`

### Sub-tasks

- [ ] 3.1 Replace `StatusBanner` inline `style` props with Tailwind class mapping. Remove `style={{ backgroundColor: ... }}` and `style={{ borderColor: ... }}` — use daisyUI utility classes directly.
- [ ] 3.2 Increase status label size to `text-base font-bold`; add clear separation between label, description, and reason via `border-t border-base-200/50 pt-2 mt-2`.
- [ ] 3.3 MetricGrid cell polish: padding to `p-3.5`; value to `text-base font-mono font-bold`; label to `text-[10px] font-semibold uppercase tracking-wider text-base-content/45`; threshold to `text-[10px] text-base-content/35`; add `hover:border-primary/25 transition-colors` to cell.
- [ ] 3.4 File download buttons: add `group` class; icon gets `group-hover:text-primary transition-colors`; file type label `text-[10px] text-base-content/40 capitalize`.
- [ ] 3.5 File empty state: icon `h-8 w-8 text-base-content/20`; message `text-xs text-base-content/35 mt-2`.
- [ ] 3.6 Section headers made consistent: `text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-3`.

### Acceptance
Tests in `AutoQuantFinalResultCard.test.jsx` pass unchanged. No inline `style` props in component. Status banner uses only Tailwind classes.

---

## Task 4: Polish AutoQuantFailureReport

**File**: `frontend/src/components/autoquant/AutoQuantFailureReport.jsx`

### Sub-tasks

- [ ] 4.1 Add section label "WHAT HAPPENED" (`text-[10px] uppercase tracking-wider text-error/60 mb-1 mt-3`) before the translated user message. Increase message font to `text-sm text-base-content/85 font-medium leading-relaxed`.
- [ ] 4.2 Rename "Next steps" label to `"NEXT STEPS"` styled as `text-[10px] uppercase tracking-wider text-base-content/50 mt-3 mb-2`. Replace `<ul className="list-disc list-inside">` with `<ul className="space-y-1">` where each `<li>` uses `flex items-start gap-2` with a `ChevronRightIcon h-3 w-3 text-base-content/35 mt-0.5 shrink-0` bullet.
- [ ] 4.3 RetryHistoryTable: ensure the outer toggle button defaults to closed (the `open` state in `GeneralizationFailurePanel` is already `false` ✓). Verify `AutoQuantFailureReport` non-generalization path: `showTechnicalDetails` starts `false` ✓ — just verify styling matches spec.
- [ ] 4.4 `GeneralizationFailurePanel` best attempt artifact: change container to `bg-base-200/50 rounded-lg p-2.5` and icon to `text-warning/70`.
- [ ] 4.5 Top-level failure shell: standardize padding to `p-5` and `gap-3`; remove redundant `space-y-2` in outer `AutoQuantFailureReport` wrapper div.

### Acceptance
Failure view renders with "WHAT HAPPENED" label. Bullet list uses ChevronRight icon. Retry history is collapsed by default. Tests in `errorTranslator.test.js` pass unchanged.

---

## Task 5: Polish AutoQuantRunDashboard

**File**: `frontend/src/features/autoquant/components/AutoQuantRunDashboard.jsx`

### Sub-tasks

- [ ] 5.1 View mode toggle: replace the two separate `<button>` elements with a daisyUI `join` group using `join-item btn btn-xs` classes.
- [ ] 5.2 Pipeline card container: change to `space-y-2.5`. Pass `defaultExpanded` prop to each `AutoQuantPipelineCard` based on its status: `running` → true, `failed` → true, `warning` → true, others → false. Since `defaultExpanded` only sets the initial open state, the user retains full collapse/expand control after render.
- [ ] 5.3 `SummaryCell` border: change from fixed `border-primary/30` to `border-primary/20` for non-running status, `border-primary/40` when `flags.isRunning`.

### Acceptance
View toggle renders as a joined button group. Pipeline cards auto-expand based on status. No regressions to existing dashboard tests.

---

## Task 6: Run QA Tests and Fix Visual Regressions

### Sub-tasks

- [ ] 6.1 Run `npx jest --testPathPatterns="eventToStepMapper|pipelineSteps|AutoQuantPipelineCard|AutoQuantFinalResultCard|errorTranslator" --no-coverage` from `frontend/`. All tests must pass.
- [ ] 6.2 Fix any test failures caused by class name or structural changes (e.g., a test that queries by a CSS class we changed). Must not change test assertions about logic.
- [ ] 6.3 Check browser console for zero new warnings or errors. Document result.
- [ ] 6.4 Verify no horizontal overflow at narrow viewports (375px) by inspecting component markup.

### Dependencies
- Task 1, Task 2, Task 3, Task 4, Task 5 must all be completed before this task.

### Acceptance
All 5 test pattern suites pass. Console clean. QA checklist from design.md section 11 completed.
