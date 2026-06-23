# AutoQuant Pipeline UI Polish — Requirements

## Scope Constraints (Non-negotiable)
- No backend changes
- No WebSocket routing changes
- No final status classification logic changes
- No event-to-step mapping changes
- No new features added

---

## R1 — Pipeline Cards Layout

**R1.1** The 7 workflow step cards must be visually distinct by state: running cards stand out clearly, completed cards feel subdued, pending cards recede visually, failed/warning cards are clear but not alarming.

**R1.2** Card spacing must be consistent and balanced. Cards must not feel cluttered at desktop or mobile widths.

**R1.3** The currently-running card must automatically render in expanded state. Failed and warning cards must also auto-expand. Passed and pending cards default to collapsed.

**R1.4** State styling must use Tailwind utility class tokens only. Inline `style` props using CSS variable string interpolation must be removed from `StatusBadge` and `StatusBanner`.

---

## R2 — AutoQuantPipelineCard Component

**R2.1** The card header (step number, step name, status badge, expand toggle) must always be visible. The status badge must be right-aligned, never in the middle of the title row.

**R2.2** The step description must always be visible in the header (not only in the expanded section).

**R2.3** The expand/collapse toggle must have a visible chevron that rotates on state change and a meaningful `aria-label`.

**R2.4** Expanded sections must appear in a fixed order: Why this matters → Inputs → Checks → Metrics → Pairs/WFO → Warnings → Errors → Running message → Empty state.

**R2.5** Section dividers within the expanded area must be visible but subtle (thin horizontal lines or space). Sections must not visually bleed into each other.

**R2.6** The "not available yet" empty state (pending, no data) must be minimal — step number watermark + "Waiting to start" text. No bold icons or heavy messaging.

**R2.7** Metric values must use em-dash `—` for null values instead of "Not available".

**R2.8** The running status indicator must use a daisyUI `loading loading-spinner` instead of a spinning HeroIcon.

---

## R3 — AutoQuantStageStepper (Compact Sidebar)

**R3.1** The running stage row must visually dominate the stepper list. A ring or equivalent emphasis must differentiate it from other rows.

**R3.2** Pending stage rows must have reduced visual weight (lower opacity) compared to active/completed rows.

**R3.3** The connector line between stages must reflect completion state: passed segments use success color, future segments use muted base color.

**R3.4** The "live" pulse badge must be replaced with a compact pulsing dot indicator, preserving the same live-state signal with less visual noise.

**R3.5** The failed stage error detail must use a styled collapsible div (not a raw `<details>` element).

---

## R4 — AutoQuantFinalResultCard

**R4.1** The status banner must immediately communicate the outcome. The status label must be the largest text in the banner area.

**R4.2** Inline `style` props in `StatusBanner` must be replaced with Tailwind utility class mappings.

**R4.3** The metric grid cells must be easily scannable: metric values visually larger than labels, thresholds shown as secondary hints, consistent layout across all 8 cells.

**R4.4** The exported files section must have a clear empty state and a hover affordance on file download buttons.

**R4.5** Technical details in the status banner must default to collapsed.

---

## R5 — AutoQuantFailureReport

**R5.1** The translated user-friendly error message must be the most visually prominent text in the failure view (after the failure title).

**R5.2** Suggested next steps must be displayed as a scannable bullet list, not as prose.

**R5.3** Retry history must be collapsed by default. The toggle must show the attempt count.

**R5.4** Raw backend error details must be collapsed by default.

---

## R6 — Responsive Design

**R6.1** No horizontal overflow must occur at 375px viewport width on any polished component.

**R6.2** Cards must stack cleanly at mobile widths. No broken spacing or tiny unreadable text at `< sm` breakpoint.

**R6.3** Metric grid must adapt: 2 columns on mobile, 3 on tablet+. Min cell width must prevent cells from becoming unreadably narrow.

---

## R7 — Theme Consistency

**R7.1** `neon-glow`, `scan-effect`, and `crt-flicker` custom classes must be removed from individual pipeline step cards. These effects are reserved for the dashboard run header.

**R7.2** All color tokens must use daisyUI semantic names (`text-primary`, `bg-success/10`, etc.) — no hardcoded hex values in component files.

**R7.3** Dark mode must remain readable. All text must maintain sufficient contrast against the glassmorphism dark backgrounds.

---

## R8 — QA

**R8.1** The following test suite must pass without modification after all visual changes:
```
npx jest --testPathPatterns="eventToStepMapper|pipelineSteps|AutoQuantPipelineCard|AutoQuantFinalResultCard|errorTranslator" --no-coverage
```

**R8.2** The browser console must produce zero new warnings or errors introduced by the visual changes.
