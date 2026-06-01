// ─────────────────────────────────────────────────────────────────────────────
// Olly – Interactive Setup Wizard
// Supports all major AI providers with guided model selection
// ─────────────────────────────────────────────────────────────────────────────

import {
  text,
  select,
  isCancel,
  intro,
  outro,
  spinner,
  note,
} from "@clack/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PROVIDERS } from "../ai/providers";

export const getConfigDir = () => path.join(os.homedir(), ".olly");
export const getEnvPath = () => path.join(getConfigDir(), ".env");

// ── Helper: read existing env value ─────────────────────────────────────────
function readExistingEnv(): Record<string, string> {
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// ── Setup wizard ─────────────────────────────────────────────────────────────

export async function runSetup() {
  intro(chalk.bgMagenta.white(" 🤖 Olly Setup Wizard "));

  const existing = readExistingEnv();

  // ── Step 1: Choose Provider ──────────────────────────────────────────────
  note(
    chalk.cyan(
      "Olly supports 13+ AI providers.\nChoose one as your default — you can change it anytime by running 'olly setup'."
    ),
    "Provider Selection"
  );

  const providerChoice = await select({
    message: "Which AI provider would you like to use?",
    options: PROVIDERS.map((p) => ({
      value: p.id,
      label: p.label,
    })),
  });

  if (isCancel(providerChoice)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const provider = PROVIDERS.find((p) => p.id === providerChoice)!;

  // ── Step 2: API Key / Base URL ───────────────────────────────────────────
  let apiKeyValue = existing[provider.envKey] ?? "";

  if (provider.id === "ollama") {
    // Ollama needs a base URL, not a key
    const ollamaUrl = await text({
      message: "Enter Ollama base URL:",
      placeholder: "http://localhost:11434",
      defaultValue: apiKeyValue || "http://localhost:11434",
    });
    if (isCancel(ollamaUrl)) {
      outro("Setup cancelled.");
      process.exit(0);
    }
    apiKeyValue = (ollamaUrl as string) || "http://localhost:11434";
  } else if (provider.id === "azure") {
    // Azure needs key + resource name
    const azureKey = await text({
      message: "Enter your Azure OpenAI API Key:",
      placeholder: "...",
      defaultValue: apiKeyValue,
    });
    if (isCancel(azureKey)) {
      outro("Setup cancelled.");
      process.exit(0);
    }
    apiKeyValue = (azureKey as string) || "";

    const azureResource = await text({
      message: "Enter your Azure Resource Name:",
      placeholder: "my-azure-openai-resource",
      defaultValue: existing["AZURE_RESOURCE_NAME"] ?? "",
    });
    if (isCancel(azureResource)) {
      outro("Setup cancelled.");
      process.exit(0);
    }
    existing["AZURE_RESOURCE_NAME"] = (azureResource as string) || "";
  } else {
    const keyPrompt = await text({
      message: `Enter your ${provider.label} API Key:`,
      placeholder: provider.apiKeyHint,
      defaultValue: apiKeyValue,
    });
    if (isCancel(keyPrompt)) {
      outro("Setup cancelled.");
      process.exit(0);
    }
    apiKeyValue = (keyPrompt as string) || "";
  }

  // ── Step 3: Choose Model ─────────────────────────────────────────────────
  const modelOptions = provider.models.map((m) => ({
    value: m.id,
    label:
      m.contextK
        ? `${m.label}  ${chalk.dim(`[${m.contextK}K ctx]`)}`
        : m.label,
  }));

  // Add "Enter custom model ID" option
  modelOptions.push({ value: "__custom__", label: "✏️  Enter a custom model ID" });

  const modelChoice = await select({
    message: `Select a model for ${provider.label}:`,
    options: modelOptions,
  });

  if (isCancel(modelChoice)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  let finalModelId = modelChoice as string;

  if (finalModelId === "__custom__" || finalModelId === "custom") {
    const customModel = await text({
      message: "Enter the exact model ID:",
      placeholder: "e.g. llama3.2:latest",
    });
    if (isCancel(customModel)) {
      outro("Setup cancelled.");
      process.exit(0);
    }
    finalModelId = (customModel as string) || "";
  }

  // ── Step 4: Optional integrations ───────────────────────────────────────
  note(
    chalk.dim("The following keys are optional — press Enter to skip any of them."),
    "Optional Integrations"
  );

  const firecrawlKey = await text({
    message: "Firecrawl API Key (web scraping — optional):",
    placeholder: "fc-...",
    defaultValue: existing["FIRECRAWL_API_KEY"] ?? "",
  });
  if (isCancel(firecrawlKey)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const telegramBotToken = await text({
    message: "Telegram Bot Token (optional):",
    placeholder: "1234567890:AAH...",
    defaultValue: existing["TELEGRAM_BOT_TOKEN"] ?? "",
  });
  if (isCancel(telegramBotToken)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  const telegramOwnerId = await text({
    message: "Telegram Owner ID (optional):",
    placeholder: "1234567890",
    defaultValue: existing["TELEGRAM_OWNER_ID"] ?? "",
  });
  if (isCancel(telegramOwnerId)) {
    outro("Setup cancelled.");
    process.exit(0);
  }

  // ── Step 5: Save config ──────────────────────────────────────────────────
  const s = spinner();
  s.start("Saving configuration…");

  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Merge all existing keys so we don't lose other provider keys
  const allKeys: Record<string, string> = { ...existing };

  // Olly core
  allKeys["OLLY_PROVIDER"] = provider.id;
  allKeys["OLLY_MODEL"] = finalModelId;

  // Provider-specific key
  if (provider.id === "ollama") {
    allKeys["OLLAMA_BASE_URL"] = apiKeyValue;
  } else {
    allKeys[provider.envKey] = apiKeyValue;
  }

  // Azure extra
  if (provider.id === "azure" && existing["AZURE_RESOURCE_NAME"]) {
    allKeys["AZURE_RESOURCE_NAME"] = existing["AZURE_RESOURCE_NAME"];
  }

  // Optional
  if (firecrawlKey) allKeys["FIRECRAWL_API_KEY"] = firecrawlKey as string;
  if (telegramBotToken) allKeys["TELEGRAM_BOT_TOKEN"] = telegramBotToken as string;
  if (telegramOwnerId) allKeys["TELEGRAM_OWNER_ID"] = telegramOwnerId as string;

  // Serialize
  const envLines = Object.entries(allKeys)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}='${v}'`)
    .join("\n");

  fs.writeFileSync(getEnvPath(), envLines + "\n", "utf8");

  s.stop("Configuration saved!");

  note(
    [
      `${chalk.bold("Provider:")} ${chalk.green(provider.label)}`,
      `${chalk.bold("Model:   ")} ${chalk.green(finalModelId)}`,
      `${chalk.bold("Config:  ")} ${chalk.dim(getEnvPath())}`,
    ].join("\n"),
    "✅ Active Configuration"
  );

  outro(
    chalk.green(
      "All done! Run " + chalk.bold("'olly wakeup'") + " to start using Olly."
    )
  );
}
