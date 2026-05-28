import { isCancel, text } from "@clack/prompts";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai";
import chalk from "chalk";

export async function runAgentMode() {
  console.log("Starting Olly Orchestrator...");

  const goal = await text({
    message:
      "What you want Olly to do? Please provide a clear and concise goal for Olly to achieve.",
    placeholder:
      "Example: 'Help me debug my JavaScript code that is throwing an error.'",
  });

  if (isCancel(goal) || !goal?.trim()) {
    console.log(
      "No worries! You can wake up Olly anytime by running 'olly wakeup'.",
    );
    return;
  }

  const config = defaultAgentConfig();

  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);

  const tools = createAgentTools(executor);

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(40),
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
    ].join("\n"),
    tools,
  });

  const result = await agent.generate({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);

        console.log(
          chalk.green("✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );
      }
    },
  });

  if (result.text?.trim()) {
    console.log(chalk.blue.bold("Agent finished with result:"));
    console.log(result.text.trim());
  } else {
    console.log(chalk.blue.bold("Agent finished without a final result."));
  }
}
