#!/usr/bin/env bun
import { Command } from "commander";
import { runWakeup } from "./tui/wakeup";
import { runSetup, getEnvPath } from "./tui/setup";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    if (!key) {
      continue;
    }

    let value = rawValue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  const cwdEnvPath = resolve(process.cwd(), ".env");
  const projectEnvPath = resolve(import.meta.dir, ".env");
  const globalEnvPath = getEnvPath();

  loadEnvFile(globalEnvPath);
  if (cwdEnvPath !== globalEnvPath) {
    loadEnvFile(cwdEnvPath);
  }
  if (projectEnvPath !== cwdEnvPath && projectEnvPath !== globalEnvPath) {
    loadEnvFile(projectEnvPath);
  }
}

loadEnv();

const program = new Command();

program
  .name("olly")
  .description(
    "Meet Olly, your AI assistant for code generation and debugging.",
  )
  .version("1.0.0");

program
  .command("wakeup")
  .description("Wake up Olly and start the assistant.")
  .action(async () => {
    await runWakeup();
  });

program
  .command("setup")
  .description("Setup Olly configuration and API keys interactively.")
  .action(async () => {
    await runSetup();
  });

await program.parseAsync(process.argv);
