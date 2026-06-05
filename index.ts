#!/usr/bin/env bun
import { Command } from "commander";
import { runWakeup } from "./tui/wakeup";
import { runSetup, getEnvPath } from "./tui/setup";
import { processSlashCommand, printSlashSuggestions } from "./tui/slash-commands";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";

// ── Env loader ────────────────────────────────────────────────────────────────

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (!key) continue;
    let value = rawValue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadEnv() {
  const cwdEnvPath = resolve(process.cwd(), ".env");
  const projectEnvPath = resolve(import.meta.dir, ".env");
  const globalEnvPath = getEnvPath();
  loadEnvFile(globalEnvPath);
  if (cwdEnvPath !== globalEnvPath) loadEnvFile(cwdEnvPath);
  if (projectEnvPath !== cwdEnvPath && projectEnvPath !== globalEnvPath) loadEnvFile(projectEnvPath);
}

loadEnv();

// ── Commander setup ───────────────────────────────────────────────────────────

const program = new Command();

program
  .name("olly")
  .description("Meet Olly, your autonomous AI coding assistant.")
  .version("2.1.0");

// ── olly wakeup ───────────────────────────────────────────────────────────────
program
  .command("wakeup")
  .description("Wake up Olly — shows startup dashboard and enters interactive mode.")
  .action(async () => {
    await runWakeup();
  });

// ── olly setup ────────────────────────────────────────────────────────────────
program
  .command("setup")
  .description("Setup Olly configuration and API keys interactively.")
  .action(async () => {
    await runSetup();
  });

// ── olly agent "<task>" ───────────────────────────────────────────────────────
program
  .command("agent [task]")
  .description("Run agent mode with an optional task directly.")
  .option("--auto", "Auto-approve non-destructive operations")
  .option("--dry-run", "Show what would happen without doing it")
  .option("--steps <n>", "Max agent iterations (default: 20)", "20")
  .action(async (task?: string, opts?: { auto?: boolean; dryRun?: boolean; steps?: string }) => {
    const { runAgent, runAgentMode } = await import("./modes/agent/orchestrator");
    if (task) {
      await runAgent({
        goal: task,
        autoMode: opts?.auto,
        dryRun: opts?.dryRun,
        maxSteps: parseInt(opts?.steps ?? "20", 10),
      });
    } else {
      await runAgentMode({ auto: opts?.auto, dryRun: opts?.dryRun });
    }
  });

// ── olly config ───────────────────────────────────────────────────────────────
program
  .command("config")
  .description("Interactively view and change provider, model, and settings.")
  .action(async () => {
    await processSlashCommand("/config");
  });

// ── olly set — quick one-liner config ─────────────────────────────────────────
program
  .command("set <key> [value]")
  .description("Quickly set a config value. Keys: provider, model, auto, apikey")
  .addHelpText("after", `
  Examples:
    olly set provider tokenlb
    olly set model claude-opus-4-6
    olly set auto on
    olly set apikey sk-hU...  (sets key for current provider)
  `)
  .action(async (key: string, value?: string) => {
    const k = key.toLowerCase();
    if (k === "provider")  { await processSlashCommand(`/provider ${value ?? ""}`); return; }
    if (k === "model")     { await processSlashCommand(`/model ${value ?? ""}`);    return; }
    if (k === "auto")      { await processSlashCommand(`/auto ${value ?? ""}`);     return; }
    if (k === "approve")   { await processSlashCommand(`/approve ${value ?? ""}`); return; }
    if (k === "apikey" || k === "key") {
      // Write to current provider's key
      const provider = process.env.OLLY_PROVIDER ?? "openrouter";
      const { PROVIDERS } = await import("./ai/providers");
      const p = PROVIDERS.find((x: { id: string }) => x.id === provider);
      if (!p) { console.log(chalk.red(`Unknown provider: ${provider}`)); return; }
      if (!value) { console.log(chalk.red("Provide a value: olly set apikey <your-key>")); return; }
      const { writeFileSync, readFileSync, existsSync, mkdirSync } = await import("node:fs");
      const envPath = getEnvPath();
      const dir = envPath.split(/[\/\\]/).slice(0, -1).join("/");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
      const re = new RegExp(`^${p.envKey}=.*$`, "m");
      const newLine = `${p.envKey}='${value}'`;
      content = re.test(content) ? content.replace(re, newLine) : content + "\n" + newLine;
      writeFileSync(envPath, content, "utf8");
      process.env[p.envKey] = value;
      console.log(chalk.green(`✔ ${p.envKey} updated.`));
      return;
    }
    console.log(chalk.yellow(`Unknown key: ${key}`));
    console.log(chalk.dim("Valid keys: provider, model, auto, apikey"));
  });

// ── olly status ───────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show current provider, model and configuration status.")
  .action(async () => {
    await processSlashCommand("/status");
  });

// ── olly ask "<question>" ─────────────────────────────────────────────────────
program
  .command("ask [question]")
  .description("Quick single question — read-only, no tools that modify files.")
  .action(async (question?: string) => {
    const { runAskMode } = await import("./modes/ask/orchestrator");
    if (question) {
      // Inject question and run once
      console.log(chalk.cyan(`\nAsking: ${question}\n`));
    }
    await runAskMode();
  });

// ── olly plan "<goal>" ────────────────────────────────────────────────────────
program
  .command("plan [goal]")
  .description("Generate and execute a step-by-step plan for a goal.")
  .action(async (goal?: string) => {
    const { runPlanMode } = await import("./modes/plan/orchestrator");
    if (goal) console.log(chalk.cyan(`\nPlanning: ${goal}\n`));
    await runPlanMode();
  });

// ── olly run "<command>" ──────────────────────────────────────────────────────
program
  .command("run <command>")
  .description("Execute a shell command through Olly (logged, confirmed, with security checks).")
  .action(async (command: string) => {
    const { exec_command } = await import("./tools/shell");
    if (exec_command.execute) {
      const result = await exec_command.execute({ command, timeout_ms: 60000, background: false }, { messages: [], toolCallId: "cli-run" });
      if (result) console.log(result);
    }
  });

// ── olly memory ───────────────────────────────────────────────────────────────
const memoryCmd = program.command("memory").description("Manage Olly's persistent memory.");

memoryCmd
  .command("list")
  .description("List all memories.")
  .action(async () => {
    const { memoryList } = await import("./memory/store");
    const entries = await memoryList();
    if (entries.length === 0) {
      console.log(chalk.dim("(no memories stored)"));
      return;
    }
    console.log(chalk.bold.magenta(`\n◈ Memories (${entries.length})\n`));
    for (const e of entries) {
      const tags = e.tags.length > 0 ? chalk.dim(` [${e.tags.join(", ")}]`) : "";
      const snippet = e.value.replace(/\n/g, " ").slice(0, 80);
      console.log(`  ${chalk.bold(e.key)}${tags}`);
      console.log(chalk.dim(`  ${snippet}`));
      console.log();
    }
  });

memoryCmd
  .command("get <key>")
  .description("Retrieve a memory by key.")
  .action(async (key: string) => {
    const { memoryGetValue } = await import("./memory/store");
    const val = await memoryGetValue(key);
    if (val === null) {
      console.log(chalk.yellow(`No memory found for key: ${key}`));
    } else {
      console.log(chalk.bold(`\n${key}:\n`));
      console.log(val);
    }
  });

memoryCmd
  .command("forget <key>")
  .description("Delete a memory entry.")
  .action(async (key: string) => {
    const { memoryDelete } = await import("./memory/store");
    const deleted = await memoryDelete(key);
    if (deleted) {
      console.log(chalk.green(`✔ Deleted memory: ${key}`));
    } else {
      console.log(chalk.yellow(`No memory found for key: ${key}`));
    }
  });

// ── olly skills ───────────────────────────────────────────────────────────────
const skillsCmd = program.command("skills").description("Manage Olly's active skills.");

skillsCmd
  .command("list")
  .description("List all available skills with their status.")
  .action(async () => {
    const { listSkills } = await import("./skills/index");
    const skills = listSkills();
    console.log(chalk.bold.cyan(`\n◆ Skills (${skills.length})\n`));
    for (const s of skills) {
      const status = s.enabled ? chalk.green("● enabled") : chalk.dim("○ disabled");
      const src = chalk.dim(`[${s.source}]`);
      console.log(`  ${status}  ${chalk.bold(s.name)}  ${src}`);
      if (s.description) console.log(chalk.dim(`         ${s.description}`));
    }
    console.log();
  });

skillsCmd
  .command("enable <name>")
  .description("Enable a skill.")
  .action(async (name: string) => {
    const { enableSkill } = await import("./skills/index");
    const ok = await enableSkill(name);
    if (!ok) console.log(chalk.yellow(`Skill not found: ${name}`));
  });

skillsCmd
  .command("disable <name>")
  .description("Disable a skill.")
  .action(async (name: string) => {
    const { disableSkill } = await import("./skills/index");
    const ok = await disableSkill(name);
    if (!ok) console.log(chalk.yellow(`Skill not found or already disabled: ${name}`));
  });

skillsCmd
  .command("show <name>")
  .description("Show the content of a skill file.")
  .action(async (name: string) => {
    const { listSkills } = await import("./skills/index");
    const skills = listSkills();
    const skill = skills.find(s => s.name === name);
    if (!skill) {
      console.log(chalk.yellow(`Skill not found: ${name}`));
      return;
    }
    console.log(chalk.bold(`\n◆ Skill: ${skill.name}\n`));
    console.log(skill.content);
  });

// ── olly history ──────────────────────────────────────────────────────────────
program
  .command("history")
  .description("Show recent shell command history or past sessions.")
  .option("--sessions", "Show session history instead of shell history")
  .action(async (opts?: { sessions?: boolean }) => {
    if (opts?.sessions) {
      const { listSessions } = await import("./modes/session");
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim("(no sessions found)"));
        return;
      }
      console.log(chalk.bold.cyan(`\n◆ Past Sessions\n`));
      for (const s of sessions) {
        const ago = new Date(s.lastActiveAt).toLocaleString();
        const goal = s.goal ? `: "${s.goal.slice(0, 60)}"` : "";
        console.log(`  ${chalk.dim(s.id)}  ${chalk.dim(ago)}  ${chalk.bold(String(s.messages.length))} msgs${goal}`);
      }
      console.log();
    } else {
      const { readFileSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { homedir } = await import("node:os");
      const historyFile = join(homedir(), ".olly", "shell-history.log");
      if (!existsSync(historyFile)) {
        console.log(chalk.dim("(no shell history yet)"));
        return;
      }
      const lines = readFileSync(historyFile, "utf8").split("\n").filter(Boolean).slice(-30);
      console.log(chalk.bold.cyan(`\n◆ Shell History (last ${lines.length})\n`));
      for (const line of lines) console.log(chalk.dim(line));
      console.log();
    }
  });

// ── olly doctor ───────────────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Check config, test AI connection, verify tools, show status.")
  .action(async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");

    console.log(chalk.bold.cyan("\n🩺 Olly Doctor\n"));

    const ollyDir = join(homedir(), ".olly");
    const envFile = join(ollyDir, ".env");

    const checks: Array<{ name: string; ok: boolean; info?: string }> = [];

    // Check config dir
    checks.push({ name: "Config dir (~/.olly/)", ok: existsSync(ollyDir) });

    // Check env file
    checks.push({ name: "Config file (~/.olly/.env)", ok: existsSync(envFile) });

    // Check provider
    const provider = process.env.OLLY_PROVIDER ?? "(not set)";
    const model = process.env.OLLY_MODEL ?? "(not set)";
    checks.push({ name: `Provider: ${provider}`, ok: provider !== "(not set)", info: `Model: ${model}` });

    // Check API key
    const apiKeyMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_GENERATIVE_AI_API_KEY",
      groq: "GROQ_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
    };
    const keyEnv = apiKeyMap[provider.toLowerCase()];
    if (keyEnv) {
      const hasKey = !!(process.env[keyEnv]);
      checks.push({ name: `API Key (${keyEnv})`, ok: hasKey, info: hasKey ? "Set ✓" : "Missing!" });
    }

    // Check memory dir
    const memDir = join(ollyDir, "memory");
    const memCount = existsSync(memDir)
      ? (await import("node:fs")).readdirSync(memDir).filter((f: string) => f.endsWith(".md")).length
      : 0;
    checks.push({ name: "Memory system", ok: true, info: `${memCount} memories` });

    // Check skills
    const { listSkills } = await import("./skills/index");
    const skills = listSkills();
    const enabledCount = skills.filter(s => s.enabled).length;
    checks.push({ name: "Skills", ok: true, info: `${enabledCount}/${skills.length} enabled` });

    // Test AI connection
    process.stdout.write(chalk.dim("Testing AI connection... "));
    try {
      const { getAgentModel } = await import("./ai");
      const { generateText } = await import("ai");
      await generateText({ model: getAgentModel(), prompt: "Reply with just: ok", maxOutputTokens: 5 });
      process.stdout.write(chalk.green("✔ Connected\n"));
      checks.push({ name: "AI connection", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 60) : String(err);
      process.stdout.write(chalk.red(`✖ Failed: ${msg}\n`));
      checks.push({ name: "AI connection", ok: false, info: msg });
    }

    // Display results
    console.log();
    for (const c of checks) {
      const icon = c.ok ? chalk.green("✔") : chalk.red("✖");
      const info = c.info ? chalk.dim(` (${c.info})`) : "";
      console.log(`  ${icon} ${c.name}${info}`);
    }

    const allOk = checks.every(c => c.ok);
    console.log();
    if (allOk) {
      console.log(chalk.green.bold("  All checks passed! Olly is ready."));
    } else {
      console.log(chalk.yellow("  Some checks failed. Run 'olly setup' to fix configuration."));
    }
    console.log();
  });

// ── olly version ──────────────────────────────────────────────────────────────
program
  .command("version")
  .description("Show version, provider, and model info.")
  .action(() => {
    const provider = process.env.OLLY_PROVIDER ?? "openrouter";
    const model = process.env.OLLY_MODEL ?? "(default)";
    console.log(chalk.bold.cyan("\n⚡ Olly v2.1.0\n"));
    console.log(`  Provider: ${chalk.green(provider)}`);
    console.log(`  Model:    ${chalk.green(model)}`);
    console.log(`  Bun:      ${chalk.dim(typeof Bun !== "undefined" ? Bun.version : "N/A")}`);
    console.log();
    console.log(chalk.dim("  Quick config:"));
    console.log(chalk.dim("    olly set provider tokenlb"));
    console.log(chalk.dim("    olly set model claude-opus-4-6"));
    console.log(chalk.dim("    olly config"));
    console.log();
  });

// ── Parse ─────────────────────────────────────────────────────────────────────
await program.parseAsync(process.argv);
