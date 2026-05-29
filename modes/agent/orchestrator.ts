import { isCancel, select, text } from "@clack/prompts";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { runApprovalFlow } from "./approval";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import chalk from "chalk";
import type { ActionLog } from "./types";

function isModelRoutingError(message: string): boolean {
  return /no endpoints found|model not found/i.test(message);
}

function summarizeAction(action: ActionLog): string {
  if (action.type === "tool_execute") {
    return `${action.type}: ${action.details.command ?? action.path}`;
  }
  return `${action.type}: ${action.path}`;
}

function summarizeDiffPreview(action: ActionLog): string {
  if (action.type === "tool_execute") {
    return action.details.command ? `cmd: ${action.details.command}` : "shell";
  }

  const before = action.details.before ?? "";
  const after = action.details.after ?? "";
  if (!before && after) {
    return `new file (${after.length} chars)`;
  }
  if (before && !after) {
    return `delete file (${before.length} chars)`;
  }

  const beforeLines = before ? before.split(/\r?\n/).length : 0;
  const afterLines = after ? after.split(/\r?\n/).length : 0;
  return `lines ${beforeLines} -> ${afterLines}, chars ${before.length} -> ${after.length}`;
}

function startTerminalLoader(message: string) {
  const frames = ["|", "/", "-", "\\"];
  let index = 0;
  const startedAt = Date.now();

  const timer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const frame = frames[index % frames.length] ?? "|";
    process.stdout.write(
      `\r${chalk.cyan(frame)} ${chalk.dim(message)} ${chalk.dim(`(${elapsedSec}s)`)}`,
    );
    index += 1;
  }, 120);

  return {
    stop(finalMessage?: string) {
      clearInterval(timer);
      process.stdout.write("\r\x1b[K");
      if (finalMessage) {
        console.log(finalMessage);
      }
    },
  };
}

async function resolvePendingMutations(
  tracker: ActionTracker,
  executor: ToolExecutor,
) {
  const pending = tracker.getPendingMutations();
  if (pending.length === 0) return;

  // Delegate the interactive review flow to runApprovalFlow
  const approved = await runApprovalFlow(tracker);
  if (!approved) {
    console.log(chalk.yellow("No approved changes to apply."));
    return;
  }

  const { errors, appliedCount } = executor.applyApprovedFromTracker();
  if (errors.length > 0) {
    console.log(chalk.red("Some approved changes failed to apply:"));
    for (const err of errors) console.log(chalk.red(`- ${err}`));
  } else {
    console.log(chalk.green(`Applied ${appliedCount} approved change(s).`));
  }
}

export async function runAgentMode() {
  console.log("Starting Olly Orchestrator...");

  while (true) {
    const goal = await text({
      message: "What do you want Olly to do? (type 'exit' to leave Agent Mode)",
      placeholder:
        "Example: 'Help me debug my JavaScript code that is throwing an error.'",
    });

    if (
      isCancel(goal) ||
      !goal?.trim() ||
      goal.trim().toLowerCase() === "exit"
    ) {
      console.log(
        chalk.yellow(
          "Leaving Agent Mode and returning to CLI sub-mode selection.",
        ),
      );
      return;
    }

    const config = defaultAgentConfig();

    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);

    const tools = createAgentTools(executor);

    const sharedInstructions = [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
      "First inspect context, then propose an execution plan, then execute tools.",
      "Prefer minimal safe edits and include verification steps before concluding.",
      "When using write tools, prefer replace_in_file or append_file for surgical changes before full-file modify_file.",
    ].join("\n");

    const onStepFinish = ({
      toolCalls,
    }: {
      toolCalls: { toolName: string; input: unknown }[];
    }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);

        process.stdout.write("\r\x1b[K");
        console.log(
          chalk.green("✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );
      }
    };

    const runWithModel = () => {
      const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(40),
        instructions: sharedInstructions,
        tools,
      });

      return agent.generate({
        prompt: goal.trim(),
        onStepFinish,
      });
    };

    const loader = startTerminalLoader("Olly is working on your task...");
    let result: { text?: string } | undefined;
    let runFailed = false;

    try {
      result = await runWithModel();
    } catch (error) {
      process.stdout.write("\r\x1b[K");
      const message = error instanceof Error ? error.message : String(error);
      runFailed = true;
      console.log(chalk.red("Agent run failed."));
      console.log(
        chalk.red(
          `Reason: ${message}. Check OPENROUTER_DEFAULT_MODEL (must be openrouter/free) and provider access, then try again.`,
        ),
      );
    } finally {
      loader.stop(chalk.green("Olly completed the task."));
    }

    if (runFailed) {
      console.log(
        chalk.dim(
          "Agent Mode is still active. Enter another instruction or type 'exit'.",
        ),
      );
      continue;
    }

    if (!result) {
      console.log(
        chalk.dim("No response received. Agent Mode is still active."),
      );
      continue;
    }

    if (result.text?.trim()) {
      console.log(chalk.blue.bold("Agent finished with result:"));
      try {
        console.log(renderTerminalMarkdown(result.text.trim()));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(
          chalk.yellow(
            `Markdown render failed (${message}). Falling back to plain text output.`,
          ),
        );
        console.log(result.text.trim());
      }
    } else {
      console.log(chalk.blue.bold("Agent finished without a final result."));
    }

    await resolvePendingMutations(tracker, executor);
    console.log(
      chalk.dim(
        "Agent Mode is still active. Enter another instruction or type 'exit'.",
      ),
    );
  }
}
