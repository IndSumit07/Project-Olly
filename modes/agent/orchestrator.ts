// ─────────────────────────────────────────────────────────────────────────────
// Olly – Autonomous Agent Orchestrator (modes/agent/orchestrator.ts)
// Full autonomous multi-step agent with live step logging, plan display,
// memory injection, skills, session persistence.
// ─────────────────────────────────────────────────────────────────────────────

import { isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import chalk from "chalk";
import os from "node:os";
import { getAgentModel } from "../../ai";
import { logger } from "../../tui/stepLogger";
import { setAutoMode } from "../../tui/approvals";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { loadMemoriesForPrompt } from "../../memory/store";
import { getActiveSkillsPrompt } from "../../skills/index";
import { createSession, saveSession } from "../session";
import { allTools } from "../../tools/index";
import { processSlashCommand, printSlashSuggestions } from "../../tui/slash-commands";

// ── Plan display ──────────────────────────────────────────────────────────────

export function displayPlan(steps: string[]) {
  const width = 50;
  const border = "═".repeat(width);
  console.log();
  console.log(chalk.bold.cyan(`╔${border}╗`));
  console.log(chalk.bold.cyan(`║  PLAN (${steps.length} steps)${" ".repeat(width - 10 - String(steps.length).length)}║`));
  console.log(chalk.bold.cyan(`╠${border}╣`));
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] ?? "";
    const truncated = step.length > width - 5 ? step.slice(0, width - 8) + "…" : step;
    console.log(chalk.cyan(`║`) + chalk.dim(`  ${i + 1}. `) + truncated.padEnd(width - 5) + chalk.cyan("║"));
  }
  console.log(chalk.bold.cyan(`╚${border}╝`));
  console.log();
}

// ── Build rich system prompt ──────────────────────────────────────────────────

async function buildSystemPrompt(goal: string): Promise<string> {
  const now = new Date();
  const cwd = process.cwd();
  const platform = `${os.platform()} ${os.release()}`;
  const nodeVersion = process.version;

  // Load memories
  const memoriesSection = await loadMemoriesForPrompt();
  if (memoriesSection) {
    logger.memory(`Loading memories...`);
  }

  // Load active skills
  const skillsSection = getActiveSkillsPrompt();

  const parts = [
    `# Olly – Autonomous Agent`,
    ``,
    `## Environment`,
    `- Date/Time: ${now.toLocaleString()}`,
    `- OS: ${platform}`,
    `- CWD: ${cwd}`,
    `- Node: ${nodeVersion}`,
    `- Bun: ${typeof Bun !== "undefined" ? Bun.version : "N/A"}`,
    ``,
    `## Current Goal`,
    goal,
    ``,
    `## Instructions`,
    `- Think step-by-step. Analyze the task, plan your approach, then execute.`,
    `- Use tools to read files and context BEFORE making changes.`,
    `- Log every significant action via the tools (they log automatically).`,
    `- After every tool call, evaluate the result and decide next action.`,
    `- On error, diagnose the root cause and try a different approach.`,
    `- Prefer surgical edits (edit_file) over full rewrites (write_file).`,
    `- ALWAYS run tests after code changes when tests exist.`,
    `- When done, summarize what was accomplished and what files were modified.`,
    `- Save important context to memory using memory_save.`,
    ``,
    `## Available Tool Categories`,
    `- Filesystem: read_file, write_file, edit_file, list_directory, search_files, create_directory, delete_file, move_file, copy_file, get_file_info, find_files`,
    `- Shell: exec_command, read_output, kill_process, list_processes`,
    `- Memory: memory_save, memory_get, memory_search, memory_list, memory_delete`,
    `- Web: web_fetch, web_search, download_file`,
    `- Code: read_codebase, find_definition, run_tests, lint_code, git_status, git_diff, git_commit, git_log`,
  ];

  if (memoriesSection) {
    parts.push("", memoriesSection);
  }

  if (skillsSection) {
    parts.push("", skillsSection);
  }

  return parts.join("\n");
}

// ── Thinking spinner ──────────────────────────────────────────────────────────

function makeThinkingSpinner() {
  let active = true;
  const frames = ["✧", "✦", "✧", "✦"];
  let i = 0;
  const timer = setInterval(() => {
    if (!active) return;
    const frame = frames[i % frames.length] ?? "✧";
    process.stdout.write(`\r${chalk.dim(frame)} ${chalk.dim.italic("Thinking...")}  `);
    i++;
  }, 300);

  return {
    stop() {
      active = false;
      clearInterval(timer);
      process.stdout.write("\r\x1b[K");
    },
  };
}

// ── Agent run options ─────────────────────────────────────────────────────────

export interface AgentRunOptions {
  goal: string;
  autoMode?: boolean;
  dryRun?: boolean;
  maxSteps?: number;
  showPlan?: boolean;
}

// ── Run the agent ─────────────────────────────────────────────────────────────

export async function runAgent(opts: AgentRunOptions): Promise<void> {
  const { goal, autoMode = false, dryRun = false, maxSteps = 20 } = opts;

  if (autoMode) setAutoMode(true);

  logger.thinking("Analyzing task...");

  // Show dry-run notice
  if (dryRun) {
    console.log(chalk.yellow("\n⚠  DRY RUN MODE — no files will be written\n"));
  }

  // Build system prompt with memories + skills
  const systemPrompt = await buildSystemPrompt(goal);

  // Create session
  const session = createSession(goal);

  // Build tool set (omit write tools for dry-run)
  const tools = dryRun
    ? {
        read_file: allTools.read_file,
        list_directory: allTools.list_directory,
        search_files: allTools.search_files,
        get_file_info: allTools.get_file_info,
        find_files: allTools.find_files,
        read_codebase: allTools.read_codebase,
        find_definition: allTools.find_definition,
        git_status: allTools.git_status,
        git_diff: allTools.git_diff,
        git_log: allTools.git_log,
        web_fetch: allTools.web_fetch,
        web_search: allTools.web_search,
        memory_get: allTools.memory_get,
        memory_list: allTools.memory_list,
        memory_search: allTools.memory_search,
      }
    : allTools;

  // Create agent
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(maxSteps),
    instructions: systemPrompt,
    tools,
  });

  // Step counter — use mutable ref so spinner can be swapped between steps
  let stepNum = 0;
  const spinnerRef = { current: makeThinkingSpinner() };

  const onStepFinish = ({ toolCalls }: { toolCalls: { toolName: string; input: unknown }[] }) => {
    spinnerRef.current.stop();
    stepNum++;

    for (const tc of toolCalls) {
      const inputStr = JSON.stringify(tc.input).slice(0, 120);
      logger.plan(`Step ${stepNum}: ${tc.toolName} ${chalk.dim(inputStr)}`);
      session.commandsRun.push(tc.toolName);
    }

    // Restart thinking spinner for the next LLM call
    if (stepNum < maxSteps) {
      setTimeout(() => { spinnerRef.current = makeThinkingSpinner(); }, 50);
    }
  };

  let result: { text?: string } | undefined;

  try {
    result = await agent.generate({
      prompt: goal,
      onStepFinish: onStepFinish as Parameters<typeof agent.generate>[0]["onStepFinish"],
    });
  } catch (err) {
    spinnerRef.current.stop();
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Agent failed: ${msg}`);
    logger.warning("Check your API key and model config with 'olly setup'");
    return;
  } finally {
    spinnerRef.current.stop();
  }

  // Save session
  session.messages.push({
    role: "user",
    content: goal,
    timestamp: new Date().toISOString(),
  });
  if (result?.text) {
    session.messages.push({
      role: "assistant",
      content: result.text,
      timestamp: new Date().toISOString(),
    });
  }
  await saveSession(session);

  // Show result
  console.log();
  console.log(chalk.bold.green("━".repeat(52)));
  console.log(chalk.bold.green(" ✔  Agent completed"));
  console.log(chalk.bold.green("━".repeat(52)));

  if (result?.text?.trim()) {
    try {
      console.log(renderTerminalMarkdown(result.text.trim()));
    } catch {
      console.log(result.text.trim());
    }
  }

  logger.info(`Session saved (${stepNum} steps)`);

  // Reset auto mode
  if (autoMode) setAutoMode(false);
}

// ── Interactive agent mode (wakeup flow) ──────────────────────────────────────

export async function runAgentMode(opts: { auto?: boolean; dryRun?: boolean } = {}): Promise<void> {
  console.log(chalk.bold.cyan("\n⚡ Olly Agent Mode\n"));
  console.log(chalk.dim("  Type '/' for slash commands (/model /provider /config /help /auto)"));
  console.log(chalk.dim("  Type 'exit' to leave Agent Mode.\n"));

  while (true) {
    const goal = await text({
      message: "Task:",
      placeholder: "e.g. 'Refactor index.ts' or '/' for commands",
    });

    if (isCancel(goal) || !goal?.trim()) {
      console.log(chalk.yellow("Leaving Agent Mode."));
      return;
    }

    const trimmedGoal = goal.trim();

    // Exit
    if (trimmedGoal.toLowerCase() === "exit") {
      console.log(chalk.yellow("Leaving Agent Mode."));
      return;
    }

    // Show suggestions when user just types "/"
    if (trimmedGoal === "/") {
      printSlashSuggestions();
      continue;
    }

    // Handle slash commands (/model, /provider, /config, /help, /auto, etc.)
    if (trimmedGoal.startsWith("/")) {
      await processSlashCommand(trimmedGoal);
      continue;
    }

    // Execute task immediately — no confirmation needed
    await runAgent({
      goal: trimmedGoal,
      autoMode: true, // Agent mode always auto-approves
      dryRun: opts.dryRun,
      maxSteps: 20,
    });

    console.log(chalk.dim("\n  Agent Mode active. Next task or '/' for commands."));
  }
}
