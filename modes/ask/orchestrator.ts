import { isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import chalk from "chalk";
import { z } from "zod";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { ActionTracker } from "../agent/action-tracker";
import { createAgentTools } from "../agent/agent-tools";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import { createWebTools } from "../plan/web-tools";
import { processSlashCommand, printSlashSuggestions } from "../../tui/slash-commands";

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

function createAskTools(executor: ToolExecutor, tracker: ActionTracker) {
  const base = createAgentTools(executor);
  const hasWeb = !!process.env.FIRECRAWL_API_KEY;

  return {
    list_drives: base.list_drives,
    read_file: base.read_file,
    list_files: base.list_files,
    search_files: base.search_files,
    analyze_codebase: base.analyze_codebase,
    list_skills: base.list_skills,
    read_skill: base.read_skill,
    read_package_json: tool({
      description:
        "Read the workspace package.json and summarize dependencies and scripts.",
      inputSchema: z.object({}),
      execute: async () => executor.readFile("package.json"),
    }),
    check_package: tool({
      description:
        "Check whether a package name exists in package.json dependencies, devDependencies, peerDependencies, or optionalDependencies.",
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        const packageJson = executor.readFile("package.json");
        const parsed = JSON.parse(packageJson) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
          optionalDependencies?: Record<string, string>;
        };

        const buckets: Array<[string, Record<string, string>]> = [
          ["dependencies", parsed.dependencies ?? {}],
          ["devDependencies", parsed.devDependencies ?? {}],
          ["peerDependencies", parsed.peerDependencies ?? {}],
          ["optionalDependencies", parsed.optionalDependencies ?? {}],
        ];

        const found = buckets
          .filter(([, entries]) =>
            Object.prototype.hasOwnProperty.call(entries, name),
          )
          .map(([bucketName]) => bucketName);

        return found.length > 0
          ? `${name} found in: ${found.join(", ")}`
          : `${name} was not found in package.json`;
      },
    }),
    ...(hasWeb ? createWebTools(tracker) : {}),
  };
}

export async function runAskMode() {
  console.log(chalk.cyan("Starting Olly Ask Mode..."));
  console.log(chalk.dim("  Type '/' for slash commands (/model /provider /config /help)\n"));

  while (true) {
    const question = await text({
      message:
        "Question: (type 'exit' to leave, '/' for commands)",
      placeholder:
        "Example: 'Which packages are in package.json?' or '/' for commands",
    });

    if (
      isCancel(question) ||
      !question?.trim() ||
      question.trim().toLowerCase() === "exit"
    ) {
      console.log(
        chalk.yellow(
          "Leaving Ask Mode and returning to CLI sub-mode selection.",
        ),
      );
      return;
    }

    const trimmedQ = question.trim();

    // Handle slash commands
    if (trimmedQ === "/") { printSlashSuggestions(); continue; }
    if (trimmedQ.startsWith("/")) { await processSlashCommand(trimmedQ); continue; }
    const config = defaultAgentConfig();
    config.tools.allowShellExecution = false;
    config.tools.allowFileCreation = false;
    config.tools.allowFileModification = false;
    config.tools.allowFolderCreation = false;

    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);

    const hasWeb = !!process.env.FIRECRAWL_API_KEY;
    const tools = createAskTools(executor, tracker);

    const agent = new ToolLoopAgent({
      model: getAgentModel(),
      stopWhen: stepCountIs(20),
      instructions: [
        `Workspace root: ${config.codebasePath}`,
        "You are in Ask Mode. Read-only only: never modify files, create files, run shell commands, or stage changes.",
        "Use read-only tools to inspect the workspace and answer the user's question clearly.",
        "For package questions, inspect package.json and report exact presence/absence.",
        hasWeb
          ? "Web tools are available (web_search, web_crawl, fetch_url). Use them when the question requires up-to-date information, documentation, or anything not in the codebase."
          : "Web tools are unavailable (no FIRECRAWL_API_KEY set).",
        "Prefer concise markdown formatting when helpful.",
      ].join("\n"),
      tools,
    });

    const loader = startTerminalLoader("Olly is thinking...");
    let result: { text?: string } | undefined;

    try {
      result = await agent.generate({
        prompt: trimmedQ,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write("\r\x1b[K");
      console.log(chalk.red("Ask Mode failed."));
      console.log(chalk.red(`Reason: ${message}`));
      console.log(
        chalk.dim(
          "Ask Mode is still active. Enter another question or type 'exit'.",
        ),
      );
      continue;
    } finally {
      loader.stop(chalk.green("Olly completed the answer."));
    }

    if (result?.text?.trim()) {
      console.log(chalk.blue.bold("Answer:"));
      try {
        console.log(renderTerminalMarkdown(result.text.trim()));
      } catch {
        console.log(result.text.trim());
      }
    } else {
      console.log(chalk.yellow("No answer was returned."));
    }

    console.log(
      chalk.dim(
        "Ask Mode is still active. Enter another question or type 'exit'.",
      ),
    );
  }
}
