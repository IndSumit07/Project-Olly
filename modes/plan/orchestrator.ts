import chalk from "chalk";
import { isCancel, select, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { createAgentTools } from "../agent/agent-tools.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { generatePlan } from "./planner.ts";
import { printPlan } from "./selection.ts";
import type { PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";

const COMPLEXITY_ICON: Record<NonNullable<PlanStep["complexity"]>, string> = {
  low: chalk.green("◆ low"),
  medium: chalk.yellow("◆ medium"),
  high: chalk.red("◆ high"),
};

function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join("\n");
}

async function executeStep(
  goal: string,
  step: PlanStep,
  tools: Record<string, unknown>,
): Promise<void> {
  console.log(chalk.bold.cyan(`\n⚙  Executing: ${step.title}\n`));

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(30),
    tools,
  });

  const r = await agent.generate({ prompt: stepPrompt(goal, step) });

  if (r.text) {
    console.log(renderTerminalMarkdown(r.text));
  }

  console.log(chalk.green(`✓ "${step.title}" complete.\n`));
}

export async function runPlanMode(): Promise<void> {
  console.log(chalk.bold("\n🧭 Plan Mode\n"));

  const goal = await text({ message: "What is your goal?" });
  if (isCancel(goal) || !goal.trim()) return;

  // --- Generate & display plan ---
  const plan = await generatePlan(goal);
  printPlan(plan);

  // --- Shared executor for all steps ---
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = {
    ...createAgentTools(executor),
    ...createWebTools(tracker),
  };

  const executed = new Set<string>();

  // --- Interactive step-by-step execution loop ---
  while (true) {
    const remaining = plan.steps.filter((s) => !executed.has(s.id));

    if (remaining.length === 0) {
      console.log(chalk.green("\n✅ All steps completed.\n"));
      break;
    }

    const stepOptions = remaining.map((s) => ({
      value: s.id,
      label: `${chalk.bold(s.title)}${s.complexity ? "  " + COMPLEXITY_ICON[s.complexity] : ""}`,
      hint:
        s.description.length > 72
          ? s.description.slice(0, 72) + "…"
          : s.description,
    }));

    const doneCount = executed.size;
    const totalCount = plan.steps.length;

    const choice = await select({
      message: `Which step to execute next? (${doneCount}/${totalCount} done)`,
      options: [
        ...stepOptions,
        {
          value: "__all__",
          label: chalk.cyan("▶  Execute all remaining steps"),
        },
        { value: "__done__", label: chalk.dim("✗  Stop — I'm done") },
      ],
    });

    if (isCancel(choice) || choice === "__done__") {
      console.log(chalk.yellow("\nStopped plan execution.\n"));
      break;
    }

    if (choice === "__all__") {
      for (const step of remaining) {
        await executeStep(plan.goal, step, tools);
        executed.add(step.id);
      }
      console.log(chalk.green("\n✅ All remaining steps executed.\n"));
      break;
    }

    const step = plan.steps.find((s) => s.id === choice);
    if (step) {
      await executeStep(plan.goal, step, tools);
      executed.add(step.id);
    }
  }

  // --- Auto-apply all staged changes ---
  const pending = tracker.getPendingMutations();
  if (pending.length === 0) {
    console.log(chalk.dim("No file changes were staged.\n"));
    return;
  }

  console.log(
    chalk.bold(`\n📝 Applying ${pending.length} staged change(s)…\n`),
  );

  for (const a of pending) tracker.updateStatus(a.id, "approved", true);

  const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red("\nSome changes failed to apply:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green("✓ All changes applied.\n"));
  }
}

