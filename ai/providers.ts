// ─────────────────────────────────────────────────────────────────────────────
// Olly – AI Providers & Models Registry
// Models sourced directly from each SDK's type definitions (verified available)
// Package versions: ai@6.0.193, all @ai-sdk/* pinned to latest
// Providers: TokenLB, OpenRouter, OpenAI, Anthropic, Google, Groq, Mistral,
//            xAI, DeepSeek, Cohere, Perplexity, Cerebras, Azure OpenAI, Ollama
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelEntry {
  id: string;
  label: string;
  contextK?: number;
}

export interface ProviderEntry {
  id: string;
  label: string;
  envKey: string;
  apiKeyHint: string;
  models: ModelEntry[];
  requiresKey: boolean;
}

export const PROVIDERS: ProviderEntry[] = [

  // ── TokenLB ─────────────────────────────────────────────────────────────────
  // OpenAI-compatible proxy — access Claude, GPT, and more via one key
  {
    id: "tokenlb",
    label: "TokenLB  (OpenAI-compatible proxy)",
    envKey: "TOKENLB_API_KEY",
    apiKeyHint: "sk-hU...",
    requiresKey: true,
    models: [
      { id: "claude-opus-4-6",   label: "Claude Opus 4.6",    contextK: 200 },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5",  contextK: 200 },
      { id: "gpt-4o",            label: "GPT-4o",             contextK: 128 },
      { id: "gpt-4o-mini",       label: "GPT-4o Mini",        contextK: 128 },
      { id: "gpt-4.1",           label: "GPT-4.1",            contextK: 1000},
    ],
  },

  // ── OpenRouter ──────────────────────────────────────────────────────────────
  // Free tier available — routes to hundreds of models
  {
    id: "openrouter",
    label: "OpenRouter  (free tier + 300+ models)",
    envKey: "OPENROUTER_API_KEY",
    apiKeyHint: "sk-or-...",
    requiresKey: true,
    models: [
      { id: "openrouter/auto",                              label: "Auto (best free model)"  },
      { id: "openai/gpt-4.1",                              label: "GPT-4.1",                contextK: 1000 },
      { id: "openai/gpt-4o",                               label: "GPT-4o",                 contextK: 128  },
      { id: "openai/gpt-4o-mini",                          label: "GPT-4o Mini",            contextK: 128  },
      { id: "anthropic/claude-sonnet-4-5",                 label: "Claude Sonnet 4.5",      contextK: 200  },
      { id: "anthropic/claude-opus-4-5",                   label: "Claude Opus 4.5",        contextK: 200  },
      { id: "anthropic/claude-sonnet-4-0",                 label: "Claude Sonnet 4.0",      contextK: 200  },
      { id: "google/gemini-2.5-pro",                       label: "Gemini 2.5 Pro",         contextK: 1000 },
      { id: "google/gemini-2.5-flash",                     label: "Gemini 2.5 Flash",       contextK: 1000 },
      { id: "google/gemini-2.0-flash",                     label: "Gemini 2.0 Flash",       contextK: 1000 },
      { id: "x-ai/grok-4",                                 label: "Grok-4",                 contextK: 256  },
      { id: "x-ai/grok-3",                                 label: "Grok-3",                 contextK: 131  },
      { id: "meta-llama/llama-4-maverick",                 label: "Llama 4 Maverick",       contextK: 1000 },
      { id: "meta-llama/llama-4-scout",                    label: "Llama 4 Scout",          contextK: 512  },
      { id: "deepseek/deepseek-chat-v3-0324",              label: "DeepSeek V3",            contextK: 64   },
      { id: "deepseek/deepseek-r1",                        label: "DeepSeek R1",            contextK: 64   },
      { id: "mistralai/mistral-large-2512",                label: "Mistral Large 2512",     contextK: 128  },
      { id: "mistralai/mistral-medium-3",                  label: "Mistral Medium 3",       contextK: 128  },
      { id: "qwen/qwen3-235b-a22b",                        label: "Qwen3 235B",             contextK: 32   },
    ],
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  // Source: OpenAIChatModelId in @ai-sdk/openai@3.0.67
  {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    apiKeyHint: "sk-...",
    requiresKey: true,
    models: [
      { id: "gpt-4.1",         label: "GPT-4.1",          contextK: 1000 },
      { id: "gpt-4.1-mini",    label: "GPT-4.1 Mini",     contextK: 1000 },
      { id: "gpt-4.1-nano",    label: "GPT-4.1 Nano",     contextK: 1000 },
      { id: "gpt-4o",          label: "GPT-4o",            contextK: 128  },
      { id: "gpt-4o-mini",     label: "GPT-4o Mini",       contextK: 128  },
      { id: "o4-mini",         label: "o4-mini",           contextK: 200  },
      { id: "o3",              label: "o3",                contextK: 200  },
      { id: "o3-mini",         label: "o3-mini",           contextK: 200  },
      { id: "o1",              label: "o1",                contextK: 200  },
      { id: "gpt-3.5-turbo",   label: "GPT-3.5 Turbo",    contextK: 16   },
    ],
  },

  // ── Anthropic ───────────────────────────────────────────────────────────────
  // Source: AnthropicMessagesModelId in @ai-sdk/anthropic@3.0.81
  {
    id: "anthropic",
    label: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    apiKeyHint: "sk-ant-...",
    requiresKey: true,
    models: [
      { id: "claude-opus-4-5",            label: "Claude Opus 4.5",   contextK: 200 },
      { id: "claude-sonnet-4-5",          label: "Claude Sonnet 4.5", contextK: 200 },
      { id: "claude-opus-4-1",            label: "Claude Opus 4.1",   contextK: 200 },
      { id: "claude-sonnet-4-0",          label: "Claude Sonnet 4.0", contextK: 200 },
      { id: "claude-opus-4-0",            label: "Claude Opus 4.0",   contextK: 200 },
      { id: "claude-haiku-4-5",           label: "Claude Haiku 4.5",  contextK: 200 },
      { id: "claude-3-haiku-20240307",    label: "Claude 3 Haiku",    contextK: 200 },
    ],
  },

  // ── Google Gemini ───────────────────────────────────────────────────────────
  // Source: GoogleGenerativeAIModelId in @ai-sdk/google@3.0.80
  {
    id: "google",
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    apiKeyHint: "AIza...",
    requiresKey: true,
    models: [
      { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro",        contextK: 1000 },
      { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      contextK: 1000 },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", contextK: 1000 },
      { id: "gemini-2.0-flash",      label: "Gemini 2.0 Flash",      contextK: 1000 },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", contextK: 1000 },
      { id: "gemma-3-27b-it",        label: "Gemma 3 27B",           contextK: 128  },
      { id: "gemma-3-12b-it",        label: "Gemma 3 12B",           contextK: 128  },
    ],
  },

  // ── Groq ────────────────────────────────────────────────────────────────────
  // Source: GroqChatModelId in @ai-sdk/groq@3.0.39
  {
    id: "groq",
    label: "Groq  (ultra-fast inference)",
    envKey: "GROQ_API_KEY",
    apiKeyHint: "gsk_...",
    requiresKey: true,
    models: [
      { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick 17B",    contextK: 128 },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct",     label: "Llama 4 Scout 17B",       contextK: 128 },
      { id: "llama-3.3-70b-versatile",                       label: "Llama 3.3 70B Versatile", contextK: 128 },
      { id: "llama-3.1-8b-instant",                          label: "Llama 3.1 8B Instant",    contextK: 128 },
      { id: "llama3-70b-8192",                               label: "Llama 3 70B",              contextK: 8   },
      { id: "llama3-8b-8192",                                label: "Llama 3 8B",               contextK: 8   },
      { id: "deepseek-r1-distill-llama-70b",                 label: "DeepSeek R1 Distill 70B", contextK: 128 },
      { id: "deepseek-r1-distill-qwen-32b",                  label: "DeepSeek R1 Distill 32B", contextK: 128 },
      { id: "qwen-qwq-32b",                                  label: "Qwen QwQ 32B",             contextK: 128 },
      { id: "qwen/qwen3-32b",                                label: "Qwen3 32B",                contextK: 32  },
      { id: "moonshotai/kimi-k2-instruct-0905",              label: "Kimi K2",                  contextK: 128 },
      { id: "mixtral-8x7b-32768",                            label: "Mixtral 8x7B",             contextK: 32  },
      { id: "gemma2-9b-it",                                  label: "Gemma 2 9B",               contextK: 8   },
    ],
  },

  // ── Mistral AI ──────────────────────────────────────────────────────────────
  // Source: MistralChatModelId in @ai-sdk/mistral@3.0.37
  {
    id: "mistral",
    label: "Mistral AI",
    envKey: "MISTRAL_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "mistral-large-latest",    label: "Mistral Large (latest)",    contextK: 128 },
      { id: "mistral-medium-3",        label: "Mistral Medium 3",          contextK: 128 },
      { id: "mistral-medium-latest",   label: "Mistral Medium (latest)",   contextK: 128 },
      { id: "mistral-small-latest",    label: "Mistral Small (latest)",    contextK: 32  },
      { id: "magistral-medium-latest", label: "Magistral Medium (latest)", contextK: 128 },
      { id: "magistral-small-latest",  label: "Magistral Small (latest)",  contextK: 128 },
      { id: "ministral-8b-latest",     label: "Ministral 8B",              contextK: 128 },
      { id: "ministral-3b-latest",     label: "Ministral 3B",              contextK: 128 },
      { id: "pixtral-large-latest",    label: "Pixtral Large (vision)",    contextK: 128 },
    ],
  },

  // ── xAI (Grok) ──────────────────────────────────────────────────────────────
  // Source: XaiChatModelId in @ai-sdk/xai@3.0.93
  {
    id: "xai",
    label: "xAI (Grok)",
    envKey: "XAI_API_KEY",
    apiKeyHint: "xai-...",
    requiresKey: true,
    models: [
      { id: "grok-4",          label: "Grok-4",          contextK: 256 },
      { id: "grok-4-latest",   label: "Grok-4 (latest)", contextK: 256 },
      { id: "grok-3",          label: "Grok-3",          contextK: 131 },
      { id: "grok-3-latest",   label: "Grok-3 (latest)", contextK: 131 },
      { id: "grok-3-mini",     label: "Grok-3 Mini",     contextK: 131 },
    ],
  },

  // ── DeepSeek ────────────────────────────────────────────────────────────────
  // Source: DeepSeekChatModelId in @ai-sdk/deepseek@2.0.35
  {
    id: "deepseek",
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    apiKeyHint: "sk-...",
    requiresKey: true,
    models: [
      { id: "deepseek-chat",     label: "DeepSeek Chat (V3)", contextK: 64 },
      { id: "deepseek-reasoner", label: "DeepSeek R1",        contextK: 64 },
    ],
  },

  // ── Cohere ──────────────────────────────────────────────────────────────────
  // Source: CohereChatModelId in @ai-sdk/cohere@3.0.36
  {
    id: "cohere",
    label: "Cohere",
    envKey: "COHERE_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "command-a-03-2025",          label: "Command A (Mar 2025)",      contextK: 256 },
      { id: "command-a-reasoning-08-2025",label: "Command A Reasoning",       contextK: 256 },
      { id: "command-r-plus-04-2024",     label: "Command R+ (Apr 2024)",     contextK: 128 },
      { id: "command-r-plus",             label: "Command R+",                contextK: 128 },
      { id: "command-r-08-2024",          label: "Command R (Aug 2024)",      contextK: 128 },
      { id: "command-r7b-12-2024",        label: "Command R7B (Dec 2024)",    contextK: 128 },
      { id: "command-r",                  label: "Command R",                 contextK: 128 },
      { id: "command",                    label: "Command",                   contextK: 4   },
      { id: "command-light",              label: "Command Light",             contextK: 4   },
    ],
  },

  // ── Perplexity ──────────────────────────────────────────────────────────────
  // Source: PerplexityLanguageModelId in @ai-sdk/perplexity@3.0.33
  {
    id: "perplexity",
    label: "Perplexity",
    envKey: "PERPLEXITY_API_KEY",
    apiKeyHint: "pplx-...",
    requiresKey: true,
    models: [
      { id: "sonar-pro",            label: "Sonar Pro",           contextK: 200 },
      { id: "sonar",                label: "Sonar",               contextK: 127 },
      { id: "sonar-reasoning-pro",  label: "Sonar Reasoning Pro", contextK: 127 },
      { id: "sonar-reasoning",      label: "Sonar Reasoning",     contextK: 127 },
      { id: "sonar-deep-research",  label: "Sonar Deep Research", contextK: 127 },
    ],
  },

  // ── Cerebras ────────────────────────────────────────────────────────────────
  // Source: CerebrasChatModelId in @ai-sdk/cerebras@2.0.54
  {
    id: "cerebras",
    label: "Cerebras  (ultra-fast inference)",
    envKey: "CEREBRAS_API_KEY",
    apiKeyHint: "csk-...",
    requiresKey: true,
    models: [
      { id: "qwen-3-235b-a22b-instruct-2507", label: "Qwen3 235B Instruct",  contextK: 128 },
      { id: "qwen-3-235b-a22b-thinking-2507", label: "Qwen3 235B Thinking",  contextK: 128 },
      { id: "gpt-oss-120b",                   label: "GPT OSS 120B",         contextK: 128 },
      { id: "llama3.1-8b",                    label: "Llama 3.1 8B",         contextK: 8   },
    ],
  },

  // ── Azure OpenAI ────────────────────────────────────────────────────────────
  // Azure uses your own deployment names — enter any name you deployed
  {
    id: "azure",
    label: "Azure OpenAI",
    envKey: "AZURE_API_KEY",
    apiKeyHint: "...",
    requiresKey: true,
    models: [
      { id: "gpt-4o",        label: "GPT-4o  (use your deployment name)",        contextK: 128 },
      { id: "gpt-4o-mini",   label: "GPT-4o Mini  (use your deployment name)",   contextK: 128 },
      { id: "gpt-4.1",       label: "GPT-4.1  (use your deployment name)",       contextK: 1000},
      { id: "o3-mini",       label: "o3-mini  (use your deployment name)",       contextK: 200 },
      { id: "o4-mini",       label: "o4-mini  (use your deployment name)",       contextK: 200 },
    ],
  },

  // ── Ollama (local / offline) ─────────────────────────────────────────────────
  {
    id: "ollama",
    label: "Ollama  (local / offline — no API key needed)",
    envKey: "OLLAMA_BASE_URL",
    apiKeyHint: "http://localhost:11434",
    requiresKey: false,
    models: [
      { id: "llama4",             label: "Llama 4 Scout",      contextK: 512  },
      { id: "llama3.3",           label: "Llama 3.3 70B",      contextK: 128  },
      { id: "llama3.2",           label: "Llama 3.2 3B",       contextK: 128  },
      { id: "llama3.1",           label: "Llama 3.1 8B",       contextK: 128  },
      { id: "mistral",            label: "Mistral 7B",         contextK: 32   },
      { id: "mistral-nemo",       label: "Mistral Nemo 12B",   contextK: 128  },
      { id: "deepseek-r1",        label: "DeepSeek R1 7B",     contextK: 64   },
      { id: "deepseek-r1:14b",    label: "DeepSeek R1 14B",    contextK: 64   },
      { id: "deepseek-r1:32b",    label: "DeepSeek R1 32B",    contextK: 64   },
      { id: "qwen3",              label: "Qwen3 8B",           contextK: 32   },
      { id: "qwen3:14b",          label: "Qwen3 14B",          contextK: 32   },
      { id: "qwen3:32b",          label: "Qwen3 32B",          contextK: 32   },
      { id: "qwen2.5-coder",      label: "Qwen 2.5 Coder 7B",  contextK: 32  },
      { id: "qwen2.5-coder:32b",  label: "Qwen 2.5 Coder 32B", contextK: 32  },
      { id: "gemma3",             label: "Gemma 3 4B",         contextK: 128  },
      { id: "gemma3:12b",         label: "Gemma 3 12B",        contextK: 128  },
      { id: "phi4",               label: "Phi-4 14B",          contextK: 16   },
      { id: "codellama",          label: "Code Llama 7B",      contextK: 16   },
      { id: "custom",             label: "Custom model name…" },
    ],
  },
];

export function getProvider(id: string): ProviderEntry | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
