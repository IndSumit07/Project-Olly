# Olly – Your AI Coding Assistant 🤖

Olly is a powerful AI assistant built to help you with code generation, debugging, and task planning. Access it interactively from your terminal or directly via a Telegram bot.

## ✨ Features

- **13+ AI Providers** — OpenRouter, OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI (Grok), DeepSeek, Cohere, Perplexity, Cerebras, Azure OpenAI, and Ollama (local/offline)
- **100+ Models** — Pick the exact model you want, with context window info shown during setup
- **Free Tier Support** — OpenRouter's free routing works out of the box with no credit card
- **Auto-installs Bun** — No need to install Bun manually; it is installed automatically on `npm install`
- **Interactive CLI Setup** — Guided wizard to configure your provider and API keys globally
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

The wizard will guide you through:

1. **Choose your AI provider** — select from 13+ providers
2. **Enter your API key** — provider-specific (or Ollama base URL for local use)
3. **Choose a model** — with context window info shown
4. **Optional integrations** — Firecrawl (web search) and Telegram bot

Your configuration is saved globally to `~/.olly/.env` so Olly works in any folder.

### Supported Providers

| Provider | Key env var | Free tier? |
|---|---|---|
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ Yes (`openrouter/free`) |
| **OpenAI** | `OPENAI_API_KEY` | ❌ |
| **Anthropic** | `ANTHROPIC_API_KEY` | ❌ |
| **Google Gemini** | `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ Free tier |
| **Groq** | `GROQ_API_KEY` | ✅ Free tier |
| **Mistral** | `MISTRAL_API_KEY` | ❌ |
| **xAI (Grok)** | `XAI_API_KEY` | ❌ |
| **DeepSeek** | `DEEPSEEK_API_KEY` | ❌ |
| **Cohere** | `COHERE_API_KEY` | ✅ Trial credits |
| **Perplexity** | `PERPLEXITY_API_KEY` | ❌ |
| **Cerebras** | `CEREBRAS_API_KEY` | ✅ Free tier |
| **Azure OpenAI** | `AZURE_API_KEY` | ❌ |
| **Ollama** | *(no key, local)* | ✅ 100% free |

You can run `olly setup` at any time to switch providers or update keys.

---

## 💻 Usage

```bash
# Wake up Olly (main interface)
olly wakeup

# Re-run setup to change provider/model/keys
olly setup
```

After waking up, choose your mode:
- **CLI** → Agent Mode, Plan Mode, or Ask Mode
- **Telegram** → Chat with Olly via your Telegram bot

---

## 📁 Configuration

All keys are stored in `~/.olly/.env`. The two core variables Olly uses:

```env
OLLY_PROVIDER='openai'         # provider id (openai, anthropic, google, groq, …)
OLLY_MODEL='gpt-4o'            # model id for the chosen provider
```

---

## 🔗 Links

- [OpenRouter](https://openrouter.ai/) — aggregator with free tier
- [Groq Console](https://console.groq.com/) — fastest free inference
- [Google AI Studio](https://aistudio.google.com/) — free Gemini API keys
- [Cerebras](https://cloud.cerebras.ai/) — ultra-fast free inference
- [Ollama](https://ollama.com/) — run models locally for free