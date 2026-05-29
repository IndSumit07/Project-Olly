import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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

function ensureEnvLoaded() {
  const cwdEnvPath = resolve(process.cwd(), ".env");
  const projectEnvPath = resolve(import.meta.dir, "..", ".env");

  loadEnvFile(cwdEnvPath);
  if (projectEnvPath !== cwdEnvPath) {
    loadEnvFile(projectEnvPath);
  }
}

export function getAgentModel() {
  ensureEnvLoaded();

  const router = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  // Force usage of the openrouter/free routing alias only
  const modelId = "openrouter/free";
  return router(modelId);
}
