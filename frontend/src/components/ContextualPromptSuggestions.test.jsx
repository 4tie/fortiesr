import { render, screen, fireEvent } from "@testing-library/react";
import ContextualPromptSuggestions, {
  getContextualPrompts,
  formatContextStrip,
} from "./ContextualPromptSuggestions.jsx";

describe("ContextualPromptSuggestions", () => {
  describe("formatContextStrip", () => {
    it("formats AutoQuant running context with stage", () => {
      const context = {
        active_tab: "auto-quant",
        strategy_name: "AIStrategy",
        pipeline_status: "running",
        current_stage: 3,
      };
      const result = formatContextStrip(context);
      expect(result).toBe("AutoQuant · AIStrategy · Stage 3/6 · Running");
    });

    it("formats AutoQuant awaiting approval context", () => {
      const context = {
        active_tab: "auto-quant",
        strategy_name: "TestStrategy",
        pipeline_status: "awaiting_user_approval",
        current_stage: 4,
      };
      const result = formatContextStrip(context);
      expect(result).toBe("AutoQuant · TestStrategy · Awaiting approval");
    });

    it("formats AutoQuant completed context", () => {
      const context = {
        active_tab: "auto-quant",
        strategy_name: "MyStrategy",
        pipeline_status: "completed",
      };
      const result = formatContextStrip(context);
      expect(result).toBe("AutoQuant · MyStrategy · Completed");
    });

    it("formats Optimizer context with session", () => {
      const context = {
        active_tab: "optimizer",
        strategy_name: "AIStrategy",
        optimizer_session_id: "opt-123",
      };
      const result = formatContextStrip(context);
      expect(result).toBe("Optimizer · AIStrategy · Session active");
    });

    it("formats Results context with backtest", () => {
      const context = {
        active_tab: "results",
        strategy_name: "AIStrategy",
        backtest_run_id: "bt-abc",
      };
      const result = formatContextStrip(context);
      expect(result).toBe("Results · AIStrategy · Backtest loaded");
    });

    it("formats minimal context without strategy", () => {
      const context = {
        active_tab: "auto-quant",
      };
      const result = formatContextStrip(context);
      expect(result).toBe("AutoQuant");
    });

    it("handles unknown tab name", () => {
      const context = {
        active_tab: "unknown-tab",
      };
      const result = formatContextStrip(context);
      expect(result).toBe("unknown-tab");
    });
  });

  describe("getContextualPrompts - AutoQuant", () => {
    it("returns setup prompts when no run exists", () => {
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: null,
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(2);
      expect(prompts[0].title).toBe("Review my current AutoQuant setup");
      expect(prompts[0].prompt).toContain("Explain what the pipeline will do");
    });

    it("returns running prompts when pipeline is running", () => {
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: "running",
        current_stage: 3,
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Summarize the current workflow");
      expect(prompts[0].prompt).toContain("which stage it is in");
      expect(prompts[1].title).toBe("Explain the current findings");
      expect(prompts[2].title).toBe("Check for blockers");
    });

    it("returns awaiting approval prompts", () => {
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: "awaiting_user_approval",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Explain what needs approval");
      expect(prompts[0].prompt).toContain("waiting for me to review");
    });

    it("returns completed prompts when run is finished", () => {
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: "completed",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Summarize the completed run");
      expect(prompts[0].prompt).toContain("strongest findings");
    });

    it("returns failed prompts when run failed", () => {
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: "failed",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Summarize the completed run");
    });
  });

  describe("getContextualPrompts - Optimizer", () => {
    it("returns optimizer prompts with active session", () => {
      const context = {
        active_tab: "optimizer",
        optimizer_session_id: "opt-123",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(4);
      expect(prompts[0].title).toBe("Summarize optimizer progress");
      expect(prompts[1].title).toBe("Explain the current best trial");
      expect(prompts[2].title).toBe("Compare best trial with current strategy");
      expect(prompts[3].title).toBe("Investigate trial failures");
    });

    it("returns no prompts without session", () => {
      const context = {
        active_tab: "optimizer",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3); // falls back to default
    });
  });

  describe("getContextualPrompts - Backtest", () => {
    it("returns backtest prompts with active run", () => {
      const context = {
        active_tab: "backtest",
        backtest_run_id: "bt-123",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(4);
      expect(prompts[0].title).toBe("Run a backtest with current settings");
      expect(prompts[1].title).toBe("Analyze the latest backtest result");
      expect(prompts[2].title).toBe("Analyze pair performance");
      expect(prompts[3].title).toBe("Suggest next step based on evidence");
    });
  });

  describe("getContextualPrompts - Results", () => {
    it("returns results prompts with loaded backtest", () => {
      const context = {
        active_tab: "results",
        backtest_run_id: "bt-123",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(4);
      expect(prompts[0].title).toBe("Analyze this result");
      expect(prompts[1].title).toBe("Identify the biggest weakness");
      expect(prompts[2].title).toBe("Check for robustness");
      expect(prompts[3].title).toBe("Suggest next validation step");
    });
  });

  describe("getContextualPrompts - Strategy Editor", () => {
    it("returns strategy editor prompts", () => {
      const context = {
        active_tab: "strategy-editor",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(4);
      expect(prompts[0].title).toBe("Read and explain strategy");
      expect(prompts[1].title).toBe("Check for logical problems");
      expect(prompts[2].title).toBe("Explain optimizable parameters");
      expect(prompts[3].title).toBe("Explain market conditions");
    });
  });

  describe("getContextualPrompts - Performance", () => {
    it("returns performance prompts", () => {
      const context = {
        active_tab: "performance",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Summarize performance across runs");
      expect(prompts[1].title).toBe("Identify strengths and weaknesses");
      expect(prompts[2].title).toBe("Compare recent changes");
    });
  });

  describe("getContextualPrompts - Pair Explorer", () => {
    it("returns pair explorer prompts", () => {
      const context = {
        active_tab: "pair-explorer",
        strategy_name: "AIStrategy",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Find promising pairs");
      expect(prompts[1].title).toBe("Compare and rank pairs");
      expect(prompts[2].title).toBe("Compare specific pair");
    });
  });

  describe("getContextualPrompts - Fallback", () => {
    it("returns default prompts for unknown page", () => {
      const context = {
        active_tab: "unknown-page",
      };
      const prompts = getContextualPrompts(context);
      expect(prompts).toHaveLength(3);
      expect(prompts[0].title).toBe("Summarize the current page");
      expect(prompts[1].title).toBe("Explain the context");
      expect(prompts[2].title).toBe("Suggest next steps");
    });
  });

  describe("Component rendering and interaction", () => {
    it("renders context strip and suggestions", () => {
      const onSelectPrompt = jest.fn();
      const context = {
        active_tab: "auto-quant",
        strategy_name: "AIStrategy",
        pipeline_status: "running",
        current_stage: 3,
        auto_quant_run_id: "run-123",
      };

      render(
        <ContextualPromptSuggestions
          context={context}
          onSelectPrompt={onSelectPrompt}
        />
      );

      // Check context strip by testing the full formatted string
      expect(screen.getByText(/AutoQuant · AIStrategy · Stage 3\/6 · Running/)).toBeInTheDocument();

      // Check suggestions
      expect(screen.getByText("What can I help you with?")).toBeInTheDocument();
      expect(screen.getByText("Summarize the current workflow")).toBeInTheDocument();
      expect(screen.getByText("Explain the current findings")).toBeInTheDocument();
      expect(screen.getByText("Check for blockers")).toBeInTheDocument();
    });

    it("calls onSelectPrompt with full prompt when clicked", () => {
      const onSelectPrompt = jest.fn();
      const context = {
        active_tab: "auto-quant",
        auto_quant_run_id: "run-123",
        pipeline_status: "running",
      };

      render(
        <ContextualPromptSuggestions
          context={context}
          onSelectPrompt={onSelectPrompt}
        />
      );

      const firstSuggestion = screen.getByText("Summarize the current workflow");
      fireEvent.click(firstSuggestion);

      expect(onSelectPrompt).toHaveBeenCalledTimes(1);
      expect(onSelectPrompt).toHaveBeenCalledWith(
        expect.stringContaining("Review the current AutoQuant run")
      );
    });

    it("renders nothing when no prompts available", () => {
      const onSelectPrompt = jest.fn();
      const context = {
        active_tab: "unknown",
      };

      const { container } = render(
        <ContextualPromptSuggestions
          context={context}
          onSelectPrompt={onSelectPrompt}
        />
      );

      // Should render default prompts for unknown context
      expect(container).toBeInTheDocument();
    });
  });
});
