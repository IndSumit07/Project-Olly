# Olly – Your Autonomous AI Coding Assistant 🤖

Olly is a powerful autonomous AI agent built to help you with code generation, debugging, task planning, and more. Access it interactively from your terminal with **15+ AI providers** including the new **TokenLB** provider.

## ✨ Features

- **15+ AI Providers** — TokenLB, OpenRouter, OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI (Grok), DeepSeek, Cohere, Perplexity, Cerebras, Azure OpenAI, and Ollama (local/offline)
- **100+ Models** — Pick the exact model you want, with context window info
- **TokenLB Support** — OpenAI-compatible proxy supporting `claude-opus-4-6`, GPT-4o, and more
- **⚡ Slash Commands** — Type `/` in any interactive mode for live config changes
- **No-Confirm Agent Mode** — Agent mode executes tasks immediately, no "proceed?" prompts
- **Free Tier Support** — OpenRouter's free routing, Groq, Cerebras, and Google free tiers
- **Interactive CLI Setup** — Guided wizard or one-liner `olly set` commands
- **Multiple Interfaces** — Terminal CLI or Telegram Bot
- **Smart Code Generation** — Build features, find bugs, plan tasks, and explain code

---

## 📦 Installation

Install Olly globally via npm:

```bash
npm install -g my-olly
```

> **Bun is installed automatically** if not already present. You may need to restart your terminal afterwards on Windows.

---

## 🛠️ Setup

After installation, run the setup wizard:

```bash
olly setup
```

Or use quick one-liner commands:

```bash
olly set provider tokenlb
olly set model claude-opus-4-6
olly set apikey sk-hUEBQXvY5zgRhgT3GYBgsYnZbEfRnLGBrAw3ImHrv0GdFelT
```

---

## ⚡ Slash Commands (in any mode)

When using `olly agent`, `olly ask`, or `olly plan`, type **`/`** to see available commands:

| Command | Description |
|---|---|
| `/model` | Switch AI model interactively |
| `/model gpt-4o` | Switch to a specific model instantly |
| `/provider` | Switch AI provider interactively |
| `/provider tokenlb` | Switch to TokenLB instantly |
| `/config` | View and edit full configuration |
| `/status` | Show current provider, model & auto mode |
| `/auto` | Toggle auto-approve mode |
| `/auto on` | Enable auto-approve (no confirmations) |
| `/auto off` | Disable auto-approve |
| `/approve` | Set approval mode (always/ask) |
| `/help` | List all slash commands |

---

## 💻 Usage

```bash
# Wake up Olly (main interface)
olly wakeup

# Agent mode (executes immediately, no confirmations)
olly agent
olly agent "Refactor index.ts to use async/await"

# Ask mode (read-only Q&A)
olly ask
olly ask "What packages are in my project?"

# Plan mode (generate & execute step-by-step plans)
olly plan

# Quick config without re-running setup
olly set provider tokenlb
olly set model claude-opus-4-6
olly set auto on
olly config       # interactive config editor
olly status       # show current configuration

# Other commands
olly setup        # full interactive setup wizard
olly doctor       # check config and AI connection
olly version      # show version and current config
```

---

## 🔌 Supported Providers

| Provider | Key env var | Notes |
|---|---|---|
| **TokenLB** | `TOKENLB_API_KEY` | OpenAI-compatible, Claude Opus 4.6 |
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ Free tier (`openrouter/free`) |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4.1, o3, o4-mini |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude Opus/Sonnet/Haiku |
| **Google Gemini** | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ Free tier |
| **Groq** | `GROQ_API_KEY` | ✅ Free tier, ultra-fast |
| **Mistral** | `MISTRAL_API_KEY` | Mistral Large, Medium |
| **xAI (Grok)** | `XAI_API_KEY` | Grok-4, Grok-3 |
| **DeepSeek** | `DEEPSEEK_API_KEY` | DeepSeek V3, R1 |
| **Cohere** | `COHERE_API_KEY` | ✅ Trial credits |
| **Perplexity** | `PERPLEXITY_API_KEY` | Sonar models |
| **Cerebras** | `CEREBRAS_API_KEY` | ✅ Free tier, ultra-fast |
| **Azure OpenAI** | `AZURE_API_KEY` | Your own deployment |
| **Ollama** | *(no key, local)* | ✅ 100% free, offline |

---

## 📁 Configuration

All keys are stored in `~/.olly/.env`. Core variables:

```env
OLLY_PROVIDER='tokenlb'                # provider id
OLLY_MODEL='claude-opus-4-6'           # model id
TOKENLB_API_KEY='sk-hU...'            # provider API key
OLLY_AUTO='1'                         # auto-approve all (optional)
```

---

## 🔗 Links

- [OpenRouter](https://openrouter.ai/) — aggregator with free tier
- [Groq Console](https://console.groq.com/) — fastest free inference
- [Google AI Studio](https://aistudio.google.com/) — free Gemini API keys
- [Cerebras](https://cloud.cerebras.ai/) — ultra-fast free inference
- [Ollama](https://ollama.com/) — run models locally for free
- [TokenLB](https://tokenlb.net/) — OpenAI-compatible proxy