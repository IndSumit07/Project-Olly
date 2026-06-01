# Project Summary — Olly (my-olly)

## Overview

- **Name:** my-olly
- **Version:** 1.0.3 (package.json)
- **Description:** Olly — Your AI coding assistant. Supports 13+ AI providers for code generation, debugging, and task planning.
- **Language:** TypeScript (ES module)
- **Runtime target:** Bun (shebangs present; project README and scripts reference Bun)
- **Module type:** module (package.json `type: "module"`)

## Quick Facts

- **Primary entrypoint:** `index.ts` (CLI bootstrap, loads environment files and Commander)
- **CLI executable:** `bin/olly.ts` (shim that imports `index.ts`)
- **Install:** `npm install -g my-olly` (README) or use the project with Bun via `bun install` + `bun run index.ts`
- **Key scripts:** `postinstall` → `node scripts/postinstall.cjs` (runs after install)
- **Config storage:** Global config saved to `~/.olly/.env` per README; runtime also loads `.env` from project and cwd.

## Purpose & Feature Summary

- Interactive terminal AI assistant for developers: generate code, explain code, find/debug bugs, and plan tasks.
- Supports multiple interfaces: interactive CLI and a Telegram bot integration.
- Provider-agnostic: built to work with many AI providers and models (13+ providers, 100+ models listed in README).
- Guided interactive setup (`olly setup`) to configure provider, model, and optional integrations (Firecrawl, Telegram).

## Project Structure (high-level)

- Root files:
  - `index.ts` — CLI entry and env loading.
  - `package.json` — metadata, dependencies, bin entry.
  - `tsconfig.json` — TypeScript configuration (project uses TS/TSX features).
  - `context.md`, `README.md` — project documentation and usage.
  - `scripts/postinstall.cjs` — postinstall bootstrap (auto-install Bun if needed).
- Folders:
  - `ai/` — AI configuration and provider wiring (exports like `getAgentModel`).
  - `bin/` — CLI launcher(s) (e.g., `olly.ts`).
  - `modes/` — CLI sub-modes for Agent, Plan, Ask flows (`cli.ts`, `agent/`, `plan/`, `ask/`).
  - `tui/` — terminal UI pieces (wakeup, setup flows, prompts).
  - `telegram/` — Telegram bot integration (handlers, auth, sessions).
  - `scripts/` — install helpers.

## Key Files & Responsibilities

- `index.ts` — Loads environment variables (global/project/cwd), wires `commander` CLI, defines `wakeup` and `setup` commands. It calls into UI modules to start interactive flows.
- `ai/index.ts` — Re-exports AI configuration (`ai.config.ts`) which centralizes model/provider setup.
- `bin/olly.ts` — Lightweight entry that imports the main `index.ts` so installing the package exposes the `olly` CLI.
- `modes/cli.ts` — Top-level CLI sub-mode selector (Agent, Plan, Ask) and orchestrates respective mode orchestrators.

## Notable Dependencies

- Multiple provider SDKs (via `@ai-sdk/*`, `@openrouter/ai-sdk-provider`, `ollama-ai-provider`) to support many backends.
- `ai` (core AI abstractions), `commander` (CLI), `@clack/prompts` (interactive prompts), `telegraf` (Telegram bot), `chalk`, `marked` / `marked-terminal` (cli formatting), and a variety of provider SDKs.

Key dependencies excerpt (from `package.json`): `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/groq`, `@openrouter/ai-sdk-provider`, `ollama-ai-provider`, `telegraf`, `commander`, `@clack/prompts`.

## Runtime & Installation Notes

- The project targets Bun as a first-class runtime (shebangs and README call out Bun installation). The `postinstall` script attempts to ensure Bun is available for the developer.
- To run locally (developer):

```bash
# install deps (npm or bun)
npm install
npx bun install    # optional when using Bun

# run CLI during development
bun run index.ts

# or use the installed global binary after publishing
olly wakeup
```

## Configuration & Environment

- Global configuration stored in `~/.olly/.env` by the interactive `setup` wizard.
- Important environment variables used by the app (examples from README):
  - `OLLY_PROVIDER` — provider id (openai, anthropic, google, groq, …)
  - `OLLY_MODEL` — model id for the chosen provider
- `index.ts` includes logic to load env from three places (global env path, cwd `.env`, project `.env`) and merges them into `process.env` when not already set.

## Interfaces & Modes

- CLI Modes (from `modes/cli.ts`): `Agent Mode`, `Plan Mode`, `Ask Mode` — each has its own orchestrator under `modes/*`.
- Telegram bot integration under `telegram/` — supports running Olly over Telegram (bot handlers, auth, sessions).

## Automation & Postinstall

- `scripts/postinstall.cjs` is invoked via `package.json` `postinstall` script; README indicates it will auto-install Bun if missing and perform necessary setup steps.

## Contribution & Development Tips

- TypeScript is required; `typescript` is listed as a peer dependency (`^5`).
- Use Bun where possible for parity with how the app is packaged, but Node.js (modern v18+/v20+/v25+) may still work since code uses standard Node APIs.
- The CLI is driven by `commander` and uses `@clack/prompts` for interactive flows — tests or automation should mock prompt flows.

## Suggested Next Steps for New Developers

1. Run `npm install` and `bun run index.ts` to verify the CLI starts.
2. Open `ai/ai.config.ts` to review provider wiring and how models are selected.
3. Inspect `modes/agent/orchestrator.ts` and `telegram/` to understand orchestration and bot flows.
4. Add a CONTRIBUTING.md with development workflow and local testing guidance.

## References

- See the main documentation in `README.md` for usage and provider lists.

---

Generated summary for maintainers and contributors.