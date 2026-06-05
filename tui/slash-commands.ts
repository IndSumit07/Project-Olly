// ─────────────────────────────────────────────────────────────────────────────
// Olly – Slash Commands System (tui/slash-commands.ts)
// Type "/" in any interactive mode to get command suggestions and change
// provider, model, auto-approve mode, and other settings on the fly.
// ─────────────────────────────────────────────────────────────────────────────

import { select, text, isCancel } from "@clack/prompts";
import chalk from "chalk";
import fs from "node:fs";
import { getEnvPath } from "./setup";
import { PROVIDERS } from "../ai/providers";
import { setAutoMode, isAutoMode } from "./approvals";

// ── Slash command definitions ─────────────────────────────────────────────────

export interface SlashCommand {
  name: string;         // e.g. "model"
  description: string;
  usage: string;        // e.g. "/model [model-id]"
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "model",    description: "Switch AI model on the fly",             usage: "/model [model-id]"    },
  { name: "provider", description: "Switch AI provider on the fly",          usage: "/provider [id]"       },
  { name: "config",   description: "View or edit current configuration",     usage: "/config"              },
  { name: "status",   description: "Show current provider, model & status",  usage: "/status"              },
  { name: "auto",     description: "Toggle auto-approve mode (no confirmations)", usage: "/auto [on|off]"  },
  { name: "approve",  description: "Set approval mode (always/ask/never)",   usage: "/approve [mode]"      },
  { name: "help",     description: "List all available slash commands",      usage: "/help"                },
];

// ── Check if input is a slash command ────────────────────────────────────────

export function isSlashCommand(input: string): boolean {
  return input.trimStart().startsWith("/");
}

// ── Print suggestions when user types "/" ────────────────────────────────────

export function printSlashSuggestions(partial = ""): void {
  const filter = partial.toLowerCase().replace(/^\//, "");
  const matches = SLASH_COMMANDS.filter(
    (c) => c.name.startsWith(filter) || filter === ""
  );

  if (matches.length === 0) {
    console.log(chalk.dim("  No matching commands."));
    return;
  }

  console.log();
  console.log(chalk.bold.cyan("  ⚡ Slash Commands"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  for (const cmd of matches) {
    console.log(
      `  ${chalk.cyan(cmd.usage.padEnd(28))} ${chalk.dim(cmd.description)}`
    );
  }
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  console.log();
}

// ── Read / write env config ───────────────────────────────────────────────────

function readEnvConfig(): Record<string, string> {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (!key) continue;
    let value = rawValue;
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function writeEnvConfig(config: Record<string, string>): void {
  const envPath = getEnvPath();
  const dir = envPath.split(/[/\\]/).slice(0, -1).join("/");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const envLines = Object.entries(config)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}='${v}'`)
    .join("\n");
  fs.writeFileSync(envPath, envLines + "\n", "utf8");
}

function applyEnvValue(key: string, value: string): void {
  process.env[key] = value;
  const config = readEnvConfig();
  config[key] = value;
  writeEnvConfig(config);
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleModel(args: string[]): Promise<void> {
  const currentProvider = process.env.OLLY_PROVIDER ?? "openrouter";
  const provider = PROVIDERS.find((p) => p.id === currentProvider);

  if (args.length > 0 && args[0]) {
    // Direct set: /model gpt-4o
    const modelId = args[0];
    applyEnvValue("OLLY_MODEL", modelId);
    console.log(chalk.green(`✔ Model set to: ${chalk.bold(modelId)}`));
    console.log(chalk.dim("  (saved to ~/.olly/.env)"));
    return;
  }

  // Interactive model picker
  if (!provider) {
    console.log(chalk.yellow(`Unknown provider: ${currentProvider}. Run /provider first.`));
    return;
  }

  const modelOptions = provider.models.map((m) => ({
    value: m.id,
    label: m.contextK ? `${m.label}  ${chalk.dim(`[${m.contextK}K ctx]`)}` : m.label,
  }));
  modelOptions.push({ value: "__custom__", label: "✏️  Enter a custom model ID" });

  console.log(chalk.bold.cyan(`\n  Selecting model for ${chalk.bold(provider.label)}...\n`));

  const choice = await select({
    message: `Select model (current: ${chalk.green(process.env.OLLY_MODEL ?? "default")}):`,
    options: modelOptions,
  });

  if (isCancel(choice)) {
    console.log(chalk.dim("  Cancelled."));
    return;
  }

  let modelId = choice as string;

  if (modelId === "__custom__" || modelId === "custom") {
    const customInput = await text({
      message: "Enter the exact model ID:",
      placeholder: "e.g. claude-opus-4-6",
    });
    if (isCancel(customInput)) { console.log(chalk.dim("  Cancelled.")); return; }
    modelId = (customInput as string) || modelId;
  }

  applyEnvValue("OLLY_MODEL", modelId);
  console.log(chalk.green(`\n✔ Model switched to: ${chalk.bold(modelId)}`));
  console.log(chalk.dim("  (saved to ~/.olly/.env — takes effect on next message)\n"));
}

async function handleProvider(args: string[]): Promise<void> {
  if (args.length > 0 && args[0]) {
    const providerId = args[0].toLowerCase();
    const p = PROVIDERS.find((x) => x.id === providerId);
    if (!p) {
      console.log(chalk.red(`Unknown provider: ${providerId}`));
      console.log(chalk.dim("  Valid: " + PROVIDERS.map((x) => x.id).join(", ")));
      return;
    }
    applyEnvValue("OLLY_PROVIDER", providerId);
    console.log(chalk.green(`✔ Provider set to: ${chalk.bold(p.label)}`));
    console.log(chalk.dim("  Run /model to pick a model for this provider."));
    return;
  }

  // Interactive provider picker
  const choice = await select({
    message: `Select provider (current: ${chalk.green(process.env.OLLY_PROVIDER ?? "openrouter")}):`,
    options: PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
  });

  if (isCancel(choice)) { console.log(chalk.dim("  Cancelled.")); return; }

  const providerId = choice as string;
  applyEnvValue("OLLY_PROVIDER", providerId);
  const p = PROVIDERS.find((x) => x.id === providerId)!;
  console.log(chalk.green(`\n✔ Provider switched to: ${chalk.bold(p.label)}`));
  console.log(chalk.dim("  Run /model to pick a model for this provider.\n"));
}

async function handleConfig(): Promise<void> {
  const config = readEnvConfig();
  const provider = process.env.OLLY_PROVIDER ?? config["OLLY_PROVIDER"] ?? "openrouter";
  const model = process.env.OLLY_MODEL ?? config["OLLY_MODEL"] ?? "(default)";
  const providerObj = PROVIDERS.find((p) => p.id === provider);

  console.log();
  console.log(chalk.bold.cyan("  ⚙  Olly Configuration"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
  console.log(`  ${chalk.bold("Provider")}  ${chalk.green(providerObj?.label ?? provider)}`);
  console.log(`  ${chalk.bold("Model    ")}  ${chalk.green(model)}`);
  console.log(`  ${chalk.bold("Auto     ")}  ${isAutoMode() ? chalk.green("ON  (no confirmations)") : chalk.yellow("OFF (asks before executing)")}`);
  console.log(`  ${chalk.bold("Config   ")}  ${chalk.dim(getEnvPath())}`);

  // Show which API keys are set
  const relevantKey = providerObj?.envKey;
  if (relevantKey) {
    const val = process.env[relevantKey] ?? config[relevantKey] ?? "";
    const masked = val ? chalk.green("✔ set") : chalk.red("✖ missing");
    console.log(`  ${chalk.bold("API Key  ")}  ${masked} (${relevantKey})`);
  }

  console.log(chalk.dim("  ─────────────────────────────────────────────────────"));
  console.log(chalk.dim("  Use /provider, /model, or /auto to change settings."));
  console.log();

  // Offer to edit
  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "provider", label: "Change provider" },
      { value: "model",    label: "Change model" },
      { value: "auto",     label: "Toggle auto-approve" },
      { value: "apikey",   label: "Update API key" },
      { value: "back",     label: "Back" },
    ],
  });

  if (isCancel(action) || action === "back") return;
  if (action === "provider") await handleProvider([]);
  if (action === "model")    await handleModel([]);
  if (action === "auto")     await handleAuto([]);
  if (action === "apikey")   await handleApiKey(provider);
}

async function handleApiKey(providerId: string): Promise<void> {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p) { console.log(chalk.red("Unknown provider.")); return; }

  const current = process.env[p.envKey] ?? "";
  const masked = current ? `${current.slice(0, 6)}...` : "(not set)";

  const newKey = await text({
    message: `Enter new API key for ${p.label} (current: ${chalk.dim(masked)}):`,
    placeholder: p.apiKeyHint,
  });

  if (isCancel(newKey) || !newKey?.trim()) { console.log(chalk.dim("  Cancelled.")); return; }
  applyEnvValue(p.envKey, newKey as string);
  console.log(chalk.green(`✔ API key for ${p.label} updated.`));
}

async function handleStatus(): Promise<void> {
  const provider = process.env.OLLY_PROVIDER ?? "openrouter";
  const model = process.env.OLLY_MODEL ?? "(default)";
  const providerObj = PROVIDERS.find((p) => p.id === provider);
  const autoMode = isAutoMode();

  console.log();
  console.log(chalk.bold.cyan("  ⚡ Olly Status"));
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  console.log(`  Provider  ${chalk.green(providerObj?.label ?? provider)}`);
  console.log(`  Model     ${chalk.green(model)}`);
  console.log(`  Auto      ${autoMode ? chalk.green("ON") : chalk.yellow("OFF")}`);
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  console.log();
}

async function handleAuto(args: string[]): Promise<void> {
  const arg = args[0]?.toLowerCase();

  if (arg === "on") {
    setAutoMode(true);
    console.log(chalk.green("✔ Auto-approve mode: ON — commands will execute without confirmation."));
    return;
  }
  if (arg === "off") {
    setAutoMode(false);
    console.log(chalk.yellow("✔ Auto-approve mode: OFF — you will be asked before executing commands."));
    return;
  }

  // Toggle
  const current = isAutoMode();
  setAutoMode(!current);
  if (!current) {
    console.log(chalk.green("✔ Auto-approve mode: ON — commands will execute without confirmation."));
  } else {
    console.log(chalk.yellow("✔ Auto-approve mode: OFF — you will be asked before executing commands."));
  }
}

async function handleApprove(args: string[]): Promise<void> {
  const mode = args[0]?.toLowerCase();

  if (mode === "always") {
    setAutoMode(true);
    console.log(chalk.green("✔ Approval mode: ALWAYS — all operations auto-approved."));
  } else if (mode === "never") {
    setAutoMode(true);
    console.log(chalk.green("✔ Approval mode: NEVER ASK — all operations auto-approved."));
  } else if (mode === "ask") {
    setAutoMode(false);
    console.log(chalk.yellow("✔ Approval mode: ASK — you will be prompted for confirmations."));
  } else {
    const choice = await select({
      message: "Select approval mode:",
      options: [
        { value: "always", label: "✅ Always approve — never ask (auto mode)" },
        { value: "ask",    label: "❓ Ask — confirm before executing (default)" },
      ],
    });
    if (isCancel(choice)) { console.log(chalk.dim("  Cancelled.")); return; }
    if (choice === "always") {
      setAutoMode(true);
      console.log(chalk.green("✔ Approval mode: ALWAYS — auto-approved."));
    } else {
      setAutoMode(false);
      console.log(chalk.yellow("✔ Approval mode: ASK — will prompt for confirmations."));
    }
  }
}

function handleHelp(): void {
  printSlashSuggestions();
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Process a slash command string like "/model gpt-4o" or "/provider openai".
 * Returns true if the input was handled as a slash command, false otherwise.
 */
export async function processSlashCommand(input: string): Promise<boolean> {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return false;

  const parts = trimmed.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);

  // Show suggestions if just "/"
  if (!cmd) {
    printSlashSuggestions();
    return true;
  }

  switch (cmd) {
    case "model":
      await handleModel(args);
      break;
    case "provider":
      await handleProvider(args);
      break;
    case "config":
      await handleConfig();
      break;
    case "status":
      await handleStatus();
      break;
    case "auto":
      await handleAuto(args);
      break;
    case "approve":
      await handleApprove(args);
      break;
    case "help":
      handleHelp();
      break;
    default:
      console.log(chalk.yellow(`  Unknown command: /${cmd}`));
      console.log(chalk.dim("  Type /help to see available commands."));
  }

  return true;
}
