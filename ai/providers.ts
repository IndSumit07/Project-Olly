// ─────────────────────────────────────────────────────────────────────────────
// Olly – Supported AI Providers & Models Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelEntry {
  id: string;          // model ID used in API calls
  label: string;       // display label
  contextK?: number;   // context window in K tokens (optional)
}

export interface ProviderEntry {
  id: string;
  label: string;
  envKey: string;       // env var name for the API key
  apiKeyHint: string;   // placeholder/hint for key prompt
  models: ModelEntry[];
  requiresKey: boolean; // false for Ollama (local)
}

export const PROVIDERS: ProviderEntry[] = [
  // ── OpenRouter (aggregator – free tier available) ───────────────────────
  {
    id: "openrouter",
    label: "OpenRouter (Free tier + 300+ models)",
    envKey: "OPENROUTER_API_KEY",
    apiKeyHint: "sk-or-...",
    requiresKey: true,
    models: [
      { id: "openrouter/free",                              label: "Auto (Free routing)" },
      { id: "openai/gpt-4o",                               label: "GPT-4o",             contextK: 128 },
      { id: "openai/gpt-4o-mini",                          label: "GPT-4o Mini",        contextK: 128 },
      { id: "anthropic/claude-3.5-sonnet",                 label: "Claude 3.5 Sonnet",  contextK: 200 },
      { id: "anthropic/claude-3.5-haiku",                  label: "Claude 3.5 Haiku",   contextK: 200 },
      { id: "anthropic/claude-3-opus",                     label: "Claude 3 Opus",      contextK: 200 },
      { id: "google/gemini-2.0-flash-exp",                 label: "Gemini 2.0 Flash",   contextK: 1000 },
      { id: "google/gemini-1.5-pro",                       label: "Gemini 1.5 Pro",     contextK: 1000 },
      { id: "meta-llama/llama-3.1-405b-instruct",          label: "Llama 3.1 405B",     contextK: 128 },
      { id: "meta-llama/llama-3.3-70b-instruct",           label: "Llama 3.3 70B",      contextK: 128 },
      { id: "mistralai/mistral-large",                     label: "Mistral Large",      contextK: 128 },
      { id: "mistralai/mistral-small",                     label: "Mistral Small",      contextK: 32  },
      { id: "deepseek/deepseek-chat",                      label: "DeepSeek Chat",      contextK: 64  },
      { id: "deepseek/deepseek-r1",                        label: "DeepSeek R1",        contextK: 64  },
      { id: "x-ai/grok-2-1212",                            label: "Grok-2",             contextK: 131 },
      { id: "qwen/qwen-2.5-72b-instruct",                  label: "Qwen 2.5 72B",       contextK: 128 },
      { id: "cohere/command-r-plus",                       label: "Cohere Command R+",  contextK: 128 },
      { id: "nvidia/llama-3.1-nemotron-70b-instruct",      label: "Nemotron 70B",       contextK: 128 },
    ],
  },

  // ── OpenAI ──────────────────────────────────────────────────────────────
  {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    apiKeyHint: "sk-...",
    requiresKey: true,
    models: [
      { id: "o3",                  label: "o3",                  contextK: 200  },
      { id: "o3-mini",             label: "o3-mini",             contextK: 200  },
      { id: "o1",                  label: "o1",                  contextK: 200  },
      { id: "o1-mini",             label: "o1-mini",             contextK: 128  },
      { id: "gpt-4o",              label: "GPT-4o",              contextK: 128  },
      { id: "gpt-4o-mini",         label: "GPT-4o Mini",         contextK: 128  },
      { id: "gpt-4-turbo",         label: "GPT-4 Turbo",         contextK: 128  },
      { id: "gpt-4",               label: "GPT-4",               contextK: 8    },
      { id: "gpt-3.5-turbo",       label: "GPT-3.5 Turbo",       contextK: 16   },
    ],
  },

  // ── Anthropic ───────────────────────────────────────────────────────────
  {
    id: "anthropic",
    label: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    apiKeyHint: "sk-ant-...",
    requiresKey: true,
    models: [
      { id: "claude-opus-4-5",          label: "Claude Opus 4.5",      contextK: 200 },
      { id: "claude-sonnet-4-5",        label: "Claude Sonnet 4.5",    contextK: 200 },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet",  contextK: 200 },
      { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku",   contextK: 200 },
      { id: "claude-3-opus-20240229",   label: "Claude 3 Opus",        contextK: 200 },
      { id: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet",      contextK: 200 },
      { id: "claude-3-haiku-20240307",  label: "Claude 3 Haiku",       contextK: 200 },
    ],
  },

  // ── Google Generative AI ────────────────────────────────────────────────
  {
    id: "google",
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    apiKeyHint: "AIza...",
    requiresKey: true,
    models: [
      { id: "gemini-2.5-pro-preview-05-06",  label: "Gemini 2.5 Pro Preview", contextK: 1000 },
      { id: "gemini-2.0-flash",              label: "Gemini 2.0 Flash",        contextK: 1000 },
      { id: "gemini-2.0-flash-lite",         label: "Gemini 2.0 Flash Lite",   contextK: 1000 },
      { id: "gemini-1.5-pro",               label: "Gemini 1.5 Pro",           contextK: 2000 },
      { id: "gemini-1.5-flash",             label: "Gemini 1.5 Flash",         contextK: 1000 },
      { id: "gemini-1.5-flash-8b",          label: "Gemini 1.5 Flash 8B",      contextK: 1000 },
    ],
  },

  // ── Groq (ultra-fast inference) ─────────────────────────────────────────
  {
    id: "groq",
    label: "Groq (Ultra-fast inference)",
    envKey: "GROQ_API_KEY",
    apiKeyHint: "gsk_...",
    requiresKey: true,
    models: [
      { id: "llama-3.3-70b-versatile",   label: "Llama 3.3 70B Versatile",  contextK: 128 },
      { id: "llama-3.1-8b-instant",      label: "Llama 3.1 8B Instant",     contextK: 128 },
      { id: "llama3-70b-8192",           label: "Llama 3 70B",               contextK: 8   },
      { id: "llama3-8b-8192",            label: "Llama 3 8B",                contextK: 8   },
      { id: "mixtral-8x7b-32768",        label: "Mixtral 8x7B",              contextK: 32  },
      { id: "gemma2-9b-it",              label: "Gemma 2 9B",                contextK: 8   },
      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B", contextK: 128 },
    ],
  },

  // ── Mistral AI ──────────────────────────────────────────────────────────
  {
    id: "mistral",
    label: "Mistral AI",
    envKey: "MISTRAL_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "mistral-large-latest",    label: "Mistral Large Latest",  contextK: 128 },
      { id: "mistral-medium-latest",   label: "Mistral Medium Latest", contextK: 32  },
      { id: "mistral-small-latest",    label: "Mistral Small Latest",  contextK: 32  },
      { id: "codestral-latest",        label: "Codestral (coding)",    contextK: 256 },
      { id: "open-mistral-nemo",       label: "Open Mistral Nemo",     contextK: 128 },
      { id: "open-mistral-7b",         label: "Open Mistral 7B",       contextK: 32  },
    ],
  },

  // ── xAI (Grok) ──────────────────────────────────────────────────────────
  {
    id: "xai",
    label: "xAI (Grok)",
    envKey: "XAI_API_KEY",
    apiKeyHint: "xai-...",
    requiresKey: true,
    models: [
      { id: "grok-3",              label: "Grok-3",          contextK: 131 },
      { id: "grok-3-mini",         label: "Grok-3 Mini",     contextK: 131 },
      { id: "grok-2-1212",         label: "Grok-2",          contextK: 131 },
      { id: "grok-2-vision-1212",  label: "Grok-2 Vision",   contextK: 32  },
      { id: "grok-beta",           label: "Grok Beta",       contextK: 131 },
    ],
  },

  // ── DeepSeek ────────────────────────────────────────────────────────────
  {
    id: "deepseek",
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    apiKeyHint: "sk-...",
    requiresKey: true,
    models: [
      { id: "deepseek-chat",         label: "DeepSeek Chat (V3)", contextK: 64  },
      { id: "deepseek-reasoner",     label: "DeepSeek R1",        contextK: 64  },
    ],
  },

  // ── Cohere ──────────────────────────────────────────────────────────────
  {
    id: "cohere",
    label: "Cohere",
    envKey: "COHERE_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "command-r-plus-08-2024", label: "Command R+ (08-2024)", contextK: 128 },
      { id: "command-r-08-2024",      label: "Command R (08-2024)",  contextK: 128 },
      { id: "command-r-plus",         label: "Command R+",           contextK: 128 },
      { id: "command-r",              label: "Command R",            contextK: 128 },
      { id: "command",                label: "Command",              contextK: 4   },
      { id: "command-light",          label: "Command Light",        contextK: 4   },
    ],
  },

  // ── Perplexity ──────────────────────────────────────────────────────────
  {
    id: "perplexity",
    label: "Perplexity",
    envKey: "PERPLEXITY_API_KEY",
    apiKeyHint: "pplx-...",
    requiresKey: true,
    models: [
      { id: "sonar-pro",             label: "Sonar Pro",          contextK: 200 },
      { id: "sonar",                 label: "Sonar",              contextK: 127 },
      { id: "sonar-reasoning-pro",   label: "Sonar Reasoning Pro",contextK: 127 },
      { id: "sonar-reasoning",       label: "Sonar Reasoning",    contextK: 127 },
      { id: "r1-1776",               label: "R1-1776",            contextK: 128 },
    ],
  },

  // ── Cerebras (ultra-fast) ───────────────────────────────────────────────
  {
    id: "cerebras",
    label: "Cerebras (Ultra-fast inference)",
    envKey: "CEREBRAS_API_KEY",
    apiKeyHint: "csk-...",
    requiresKey: true,
    models: [
      { id: "llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B", contextK: 128 },
      { id: "llama-3.3-70b",                  label: "Llama 3.3 70B",     contextK: 128 },
      { id: "llama3.1-8b",                    label: "Llama 3.1 8B",      contextK: 8   },
    ],
  },

  // ── Azure OpenAI ────────────────────────────────────────────────────────
  {
    id: "azure",
    label: "Azure OpenAI",
    envKey: "AZURE_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "gpt-4o",         label: "GPT-4o",        contextK: 128 },
      { id: "gpt-4o-mini",    label: "GPT-4o Mini",   contextK: 128 },
      { id: "gpt-4-turbo",    label: "GPT-4 Turbo",   contextK: 128 },
      { id: "gpt-4",          label: "GPT-4",         contextK: 8   },
      { id: "gpt-35-turbo",   label: "GPT-3.5 Turbo", contextK: 16  },
    ],
  },

  // ── Ollama (local / offline) ─────────────────────────────────────────────
  {
    id: "ollama",
    label: "Ollama (Local / Offline)",
    envKey: "OLLAMA_BASE_URL",
    apiKeyHint: "http://localhost:11434",
    requiresKey: false,
    models: [
      { id: "llama3.2",          label: "Llama 3.2 (3B)",       contextK: 128 },
      { id: "llama3.1",          label: "Llama 3.1 (8B)",       contextK: 128 },
      { id: "llama3.1:70b",      label: "Llama 3.1 (70B)",      contextK: 128 },
      { id: "mistral",           label: "Mistral 7B",           contextK: 32  },
      { id: "codellama",         label: "Code Llama",           contextK: 16  },
      { id: "deepseek-r1",       label: "DeepSeek R1 (1.5B)",   contextK: 64  },
      { id: "deepseek-r1:7b",    label: "DeepSeek R1 (7B)",     contextK: 64  },
      { id: "qwen2.5-coder",     label: "Qwen 2.5 Coder",       contextK: 32  },
      { id: "gemma2",            label: "Gemma 2 (9B)",         contextK: 8   },
      { id: "phi4",              label: "Phi-4 (14B)",          contextK: 16  },
      { id: "custom",            label: "Custom model name…" },
    ],
  },
];

export function getProvider(id: string): ProviderEntry | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
