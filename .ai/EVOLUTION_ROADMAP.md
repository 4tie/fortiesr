# 🎯 Ultimate Architectural Evolution: Intent-Driven UI

## The Vision

Strategy Lab is on a deliberate, phased path toward becoming a **pure conversational intelligence platform**. The ultimate state is a minimalist interface: an AI Chat panel on the left and an advanced analytical results dashboard on the right — nothing else.

Every form, button, toggle, and configuration panel visible today is a **temporary scaffold**. Each successive update systematically abstracts one more layer of manual interaction behind the AI, until the user's only job is to describe intent in natural language.

---

## The Definitive Target State

> **"A pure conversational interface (AI Chat Panel) paired with an advanced analytical dashboard (Results View). All coding, configuration, execution, tuning, and rollback workflows are fully handled by the AI behind the scenes based on conversational intent."**

The user says: *"Run the MultiMa strategy on SOL with a 6-month window, tighten the stoploss a bit, and check if adding ETH helps."*

The AI:
- Adjusts the stoploss parameter in the JSON
- Adds ETH/USDT to the active pair list
- Triggers the backtest
- Reads the results
- Surfaces the equity curve and key risk metrics
- Recommends next steps

No clicks. No forms. No dropdowns.

---

## Phased Execution Roadmap

### Phase 1 — Foundation (Current)
- [x] Backtest form with manual configuration
- [x] Strategy Editor with AI-proposed diffs
- [x] AI Chat Panel (Agent + Planner modes) with tool execution
- [x] Results view with equity curve
- [x] Multi-theme system (Cold Black / Neon Cyber / Nordic Light)
- [x] Viewport-locked layout

### Phase 2 — AI Delegation Layer
- [ ] AI can trigger backtests directly from chat (no Backtest form needed)
- [ ] AI can manage pairs via chat ("add SOL", "drop BNB")
- [ ] AI remembers and applies user preferences implicitly
- [ ] Inline results preview inside chat responses
- [ ] Voice-to-intent command parsing

### Phase 3 — Form Abstraction
- [ ] Backtest form collapsed to a single "Quick Run" bar (AI fills the rest)
- [ ] Strategy Editor becomes a diff-only read-only viewer
- [ ] Settings managed entirely via conversational commands
- [ ] Pair Sweeper triggered automatically by AI proactive suggestions

### Phase 4 — Pure Interface
- [ ] Remove sidebar navigation — AI surfaces the right view contextually
- [ ] Two-panel final layout: Chat (left) + Results Dashboard (right)
- [ ] All sub-tabs (Hyperopt, Stress Test, Pair Sweeper) become AI workflow modes
- [ ] The Results Dashboard updates in real-time as the AI executes jobs

---

## Data Architecture

All AI memory and persistent state lives in `/data` at the project root:

```
data/
  user_profile.json       # Long-term implicit memory (pairs, styles, favorites)
  app.log                 # Application log
  backups/                # Strategy snapshot backups
```

Freqtrade runtime data (candles, backtest outputs, config) remains in `user_data/` as managed by Freqtrade's own conventions.

---

## Design Principles

- **Intent > Configuration** — The user expresses what they want, not how to do it
- **Silence is not ignorance** — The AI proactively surfaces insights without being asked
- **Risk-first always** — Every metric is framed through the lens of drawdown and risk/reward
- **Colloquial fluency** — The AI speaks like an elite human teammate, not a corporate bot
- **Reversibility** — Every AI action is checkpointed and rollback-able
