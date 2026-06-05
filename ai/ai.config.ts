// ─────────────────────────────────────────────────────────────────────────────
// Olly – Dynamic AI Provider Factory
// Supports: TokenLB, OpenRouter, OpenAI, Anthropic, Google, Groq, Mistral,
//           xAI, DeepSeek, Cohere, Perplexity, Cerebras, Azure OpenAI, Ollama
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEnvPath } from "../tui/setup";
import type { LanguageModel } from "ai";

// ── Provider imports ─────────────────────────────────────────────────────────
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createCohere } from "@ai-sdk/cohere";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createCerebras } from "@ai-sdk/cerebras";
import { createAzure } from "@ai-sdk/azure";
import { createOllama } from "ollama-ai-provider";

// ── Env loader ───────────────────────────────────────────────────────────────

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
  const globalEnvPath = getEnvPath();

  loadEnvFile(globalEnvPath);
  if (cwdEnvPath !== globalEnvPath) loadEnvFile(cwdEnvPath);
  if (projectEnvPath !== cwdEnvPath && projectEnvPath !== globalEnvPath)
    loadEnvFile(projectEnvPath);
}

// ── Resolve model instance ────────────────────────────────────────────────────
// We cast via `unknown` because some older provider SDKs return LanguageModelV1
// while the `ai` package's LanguageModel union only covers V2/V3.
// At runtime all provider models are fully compatible; the cast is type-only.
function asLanguageModel(m: unknown): LanguageModel {
  return m as LanguageModel;
}

// ── Provider factory ─────────────────────────────────────────────────────────

export function getAgentModel(): LanguageModel {
  ensureEnvLoaded();

  const provider = (process.env.OLLY_PROVIDER ?? "openrouter").toLowerCase();
  const modelId = process.env.OLLY_MODEL ?? "";

  switch (provider) {
    // ── TokenLB (OpenAI-compatible) ────────────────────────────────────────
    case "tokenlb": {
      const tokenlb = createOpenAI({
        apiKey: process.env.TOKENLB_API_KEY,
        baseURL: "https://tokenlb.net/v1",
      });
      return asLanguageModel(tokenlb(modelId || "claude-opus-4-6"));
    }

    // ── OpenRouter ──────────────────────────────────────────────────────────
    case "openrouter": {
      const router = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      return asLanguageModel(router(modelId || "openrouter/free"));
    }

    // ── OpenAI ──────────────────────────────────────────────────────────────
    case "openai": {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return asLanguageModel(openai(modelId || "gpt-4o"));
    }

    // ── Anthropic ───────────────────────────────────────────────────────────
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      return asLanguageModel(anthropic(modelId || "claude-sonnet-4-5"));
    }

    // ── Google Gemini ───────────────────────────────────────────────────────
    case "google": {
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return asLanguageModel(google(modelId || "gemini-2.5-flash"));
    }

    // ── Groq ────────────────────────────────────────────────────────────────
    case "groq": {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
      return asLanguageModel(groq(modelId || "meta-llama/llama-4-scout-17b-16e-instruct"));
    }

    // ── Mistral ─────────────────────────────────────────────────────────────
    case "mistral": {
      const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
      return asLanguageModel(mistral(modelId || "mistral-large-latest"));
    }

    // ── xAI (Grok) ──────────────────────────────────────────────────────────
    case "xai": {
      const xai = createXai({ apiKey: process.env.XAI_API_KEY });
      return asLanguageModel(xai(modelId || "grok-4"));
    }

    // ── DeepSeek ────────────────────────────────────────────────────────────
    case "deepseek": {
      const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
      return asLanguageModel(deepseek(modelId || "deepseek-chat"));
    }

    // ── Cohere ──────────────────────────────────────────────────────────────
    case "cohere": {
      const cohere = createCohere({ apiKey: process.env.COHERE_API_KEY });
      return asLanguageModel(cohere(modelId || "command-a-03-2025"));
    }

    // ── Perplexity ──────────────────────────────────────────────────────────
    case "perplexity": {
      const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
      return asLanguageModel(perplexity(modelId || "sonar-pro"));
    }

    // ── Cerebras ────────────────────────────────────────────────────────────
    case "cerebras": {
      const cerebras = createCerebras({ apiKey: process.env.CEREBRAS_API_KEY });
      return asLanguageModel(cerebras(modelId || "qwen-3-235b-a22b-instruct-2507"));
    }

    // ── Azure OpenAI ────────────────────────────────────────────────────────
    case "azure": {
      const azure = createAzure({
        apiKey: process.env.AZURE_API_KEY,
        resourceName: process.env.AZURE_RESOURCE_NAME,
      });
      return asLanguageModel(azure(modelId || "gpt-4o"));
    }

    // ── Ollama (local) ──────────────────────────────────────────────────────
    case "ollama": {
      const ollama = createOllama({
        baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
      });
      return asLanguageModel(ollama(modelId || "llama3.2"));
    }

    // ── Fallback: OpenRouter free ───────────────────────────────────────────
    default: {
      console.warn(
        `[Olly] Unknown provider "${provider}", falling back to OpenRouter/free`
      );
      const router = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      return asLanguageModel(router("openrouter/free"));
    }
  }
}
