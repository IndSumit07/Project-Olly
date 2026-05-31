import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";

export async function runCliMode() {
  while (true) {
    const mode = await select({
      message: "Choose CLI sub-mode:",
      options: [
        { value: "agent", label: "Agent Mode" },
        { value: "plan", label: "Plan Mode" },
        { value: "ask", label: "Ask Mode" },
        { value: "back", label: "Back to main menu" },
      ],
    });

    if (isCancel(mode) || mode === "back") {
      return;
    }

    if (mode === "agent") {
      await runAgentMode();
    } else if (mode === "plan") {
      await runPlanMode();
    } else if (mode === "ask") {
      await runAskMode();
      // Here you would implement the logic for Ask Mode
    }

    if (mode !== "agent" && mode !== "plan" && mode !== "ask") {
      console.log(chalk.red("Invalid option, please try again."));
    }
  }
}
