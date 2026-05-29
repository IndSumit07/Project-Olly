# project-olly

## Overview
An AI assistant for code generation and debugging built using Bun v1.3.14.

## Commands
- `bun install` - Install dependencies
- `bun run index.ts` - Run the project
- `olly wakeup` - Start the assistant

## Dependencies
- commander@14.0.3
- @openrouter/ai-sdk-provider@2.9.0
- ai@6.0.191
- bun\>=1.3.14

## Configuration
- Compiler options target ESNext, use React JSX, allow JS imports
- Module resolution in bundler mode

## Key Files
- index.ts: CLI entry point using Commander
- ai/index.ts: AI model configuration exporting getAgentModel
- tui/wakeup.ts: UI wakeup functionality

## Tech Stack
- Bun runtime
- TypeScript (TSX syntax)
- Node.js v25+ (implied by dependencies)