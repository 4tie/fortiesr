# Full Frontend Refactor and Project Cleanup Plan

## 1. Purpose
This document defines a complete plan for refactoring the frontend, cleaning up project structure, removing duplication, and fixing maintainability issues without breaking the current product behavior.

## 2. Project Context
The application is a React + Vite frontend connected to a FastAPI backend. The main concerns are:
- multiple tabs with overlapping state and repeated logic;
- large components that mix UI, data fetching, business rules, and local state;
- multiple API wrappers and hook variants that may overlap;
- legacy or partially used feature folders that add confusion;
- testing and verification gaps that make cleanup risky.

## 3. Goals
### Primary goals
- Create a clear frontend architecture with a single source of truth for shared concerns.
- Reduce duplication across components, hooks, constants, and API layers.
- Break down large screens into smaller reusable pieces.
- Eliminate stale, unused, or conflicting implementations.
- Improve readability, maintainability, and testability.

### Non-goals
- Do not change core trading logic unless a bug is discovered during cleanup.
- Do not change backend behavior unnecessarily.
- Do not rewrite the app in a different stack.
- Do not remove features without first confirming they are unused or duplicate.

## 4. Current Architecture Summary
### App shell
- [frontend/src/App.jsx](frontend/src/App.jsx) controls tab routing, global state, backend health checks, assistant context, pending editor navigation, and tab-specific wrappers.

### Core API layer
- [frontend/src/services/api.js](frontend/src/services/api.js) is the main HTTP/WebSocket transport layer.

### Feature-specific modules
- [frontend/src/features/autoquant/api.js](frontend/src/features/autoquant/api.js) is a feature wrapper around the same domain.
- [frontend/src/features/autoquant/hooks/useAutoQuantPipeline.js](frontend/src/features/autoquant/hooks/useAutoQuantPipeline.js) contains pipeline lifecycle logic.

### Large UI screen
- [frontend/src/components/AutoQuantTab.jsx](frontend/src/components/AutoQuantTab.jsx) appears to be a large container mixing layout, data orchestration, rendering, and state transitions.

### Shared hooks
- [frontend/src/hooks/useSharedState.js](frontend/src/hooks/useSharedState.js)
- [frontend/src/hooks/useStrategies.js](frontend/src/hooks/useStrategies.js)
- [frontend/src/hooks/usePairs.js](frontend/src/hooks/usePairs.js)
- [frontend/src/hooks/useTheme.js](frontend/src/hooks/useTheme.js)
- [frontend/src/hooks/useAgentUiState.js](frontend/src/hooks/useAgentUiState.js)

## 5. Major Issues to Fix
### 5.1 Duplicate or overlapping domain logic
There are signs that multiple layers try to manage the same concerns:
- API wrappers appear to overlap with feature wrappers.
- The same AutoQuant domain is represented in both the main component layer and feature-specific folders.
- Different hooks may be managing similar state shapes.

### 5.2 Large monolithic components
The AutoQuant page is likely too large and should be split into:
- configuration form;
- run control panel;
- stage progress panel;
- log panel;
- chart panels;
- report summary panel;
- failure/interrupt handling.

### 5.3 Inconsistent structure
The repository contains multiple patterns for:
- hooks;
- services;
- constants;
- layouts;
- feature modules.

The refactor should standardize how each domain is organized.

### 5.4 Dead or unused code risk
Some folders and files look like they may be legacy or not actively used. These should be identified and removed or archived with care.

### 5.5 Test coverage gaps
Critical flows such as API error handling, WebSocket reconnects, destructive form actions, and tab routing need tests.

## 6. Recommended Target Structure
A clean structure should look roughly like this:

- `src/app/`
  - app shell
  - providers
  - layout
  - router/tab registry

- `src/components/common/`
  - reusable buttons, cards, loaders, empty states, modals, tables

- `src/components/tabs/`
  - one component per top-level tab

- `src/features/<feature>/`
  - `api.js`
  - `constants.js`
  - `hooks/`
  - `components/`
  - `selectors/` or `utils/` if needed

- `src/lib/`
  - generic utilities
  - formatting helpers
  - safe parsing helpers

- `src/services/`
  - only canonical HTTP/WebSocket transport and infrastructure helpers

- `src/tests/`
  - integration and end-to-end coverage

## 7. Refactor Phases

### Phase 1 — Baseline verification
1. Run the frontend lint, tests, and build commands.
2. Record the exact current behavior of core flows.
3. Identify what is actually used by the app.
4. Capture duplicate imports and duplicate logic.
5. Decide which files are active, legacy, or optional.

### Phase 2 — Canonicalize data and transport
1. Keep one HTTP transport layer for all JSON calls.
2. Keep one WebSocket helper for connection URL construction and reconnect logic.
3. Standardize response parsing and error handling.
4. Centralize endpoint names and resource constants.
5. Remove wrapper functions that only duplicate one another.

### Phase 3 — Fix app-level architecture
1. Refactor the top-level app shell into a clear composition pattern.
2. Replace hardcoded conditional tab rendering with a tab registry.
3. Keep global concerns in isolated providers or hooks.
4. Ensure assistant context and tab context use one consistent flow.
5. Make error boundaries cover major sections.

### Phase 4 — Refactor AutoQuant feature
1. Separate configuration UI from pipeline execution UI.
2. Split the large page into smaller components.
3. Move transformation logic out of rendering code.
4. Keep pipeline lifecycle state in one hook or state model.
5. Make stages, logs, metrics, and charts independently reusable.

### Phase 5 — Standardize hooks and state ownership
1. Decide which state belongs to the app, which belongs to a feature, and which belongs to a component.
2. Remove duplicate state updates across multiple hooks.
3. Use consistent naming for loading, error, success, and idle statuses.
4. Ensure child components receive only what they need.

### Phase 6 — Clean up duplicates and dead code
1. Remove unused imports and unused props.
2. Archive or delete files whose only purpose is legacy support.
3. Remove duplicate mock utilities and repeated test setup.
4. Collapse multiple similar helpers into one shared version.
5. Make naming consistent across folders, components, and hooks.

### Phase 7 — Strengthen quality gates
1. Add tests for the main API contract layer.
2. Add tests for AutoQuant flow transitions.
3. Add tests for WebSocket reconnection and failure handling.
4. Add tests for routing and tab-change behavior.
5. Verify linting and build stability after every cleanup batch.

## 8. Specific Cleanup Targets
### High priority files
- [frontend/src/App.jsx](frontend/src/App.jsx)
- [frontend/src/components/AutoQuantTab.jsx](frontend/src/components/AutoQuantTab.jsx)
- [frontend/src/services/api.js](frontend/src/services/api.js)
- [frontend/src/features/autoquant/api.js](frontend/src/features/autoquant/api.js)
- [frontend/src/features/autoquant/hooks/useAutoQuantPipeline.js](frontend/src/features/autoquant/hooks/useAutoQuantPipeline.js)

### Other important files
- [frontend/src/hooks/useSharedState.js](frontend/src/hooks/useSharedState.js)
- [frontend/src/hooks/useStrategies.js](frontend/src/hooks/useStrategies.js)
- [frontend/src/hooks/usePairs.js](frontend/src/hooks/usePairs.js)
- [frontend/src/components/SettingsTab.jsx](frontend/src/components/SettingsTab.jsx)

## 9. Verification Checklist
1. Frontend lint passes.
2. Frontend unit/integration tests pass.
3. Build succeeds.
4. Main user flows still work:
   - switching tabs;
   - loading strategies;
   - opening settings;
   - starting AutoQuant;
   - viewing logs and reports;
   - handling errors cleanly.
5. No duplicate imports remain.
6. No unused files are referenced by the production app.
7. No major behavior regressions appear during manual testing.

## 10. Suggested Execution Order
1. Audit and baseline verification.
2. Canonicalize API transport.
3. Refactor app shell.
4. Split AutoQuant screen into smaller pieces.
5. Consolidate hooks and state ownership.
6. Remove duplicates and unused code.
7. Re-run tests and manual verification.

## 11. Risks and Mitigations
### Risk: Breaking behavior during cleanup
Mitigation: make small batches, verify each batch, and keep runtime behavior unchanged.

### Risk: Removing something still needed
Mitigation: confirm actual imports and usage before deleting files.

### Risk: Over-refactoring too early
Mitigation: first make architecture decisions, then split code incrementally.

### Risk: Inconsistent naming
Mitigation: standardize naming conventions before large-scale edits.

## 12. Final Outcome Expected
After the refactor, the frontend should have:
- fewer duplicate files and wrappers;
- cleaner tab structure;
- smaller, more readable components;
- more reliable API and state handling;
- easier testing and future feature work.
