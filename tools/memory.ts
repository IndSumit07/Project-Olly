// ─────────────────────────────────────────────────────────────────────────────
// Olly – Memory Tools (tools/memory.ts)
// AI SDK tool wrappers around memory/store.ts
// ─────────────────────────────────────────────────────────────────────────────

import { tool } from "ai";
import { z } from "zod";
import { logger } from "../tui/stepLogger";
import {
  memorySave,
  memoryGetValue,
  memoryList,
  memorySearch,
  memoryDelete,
} from "../memory/store";

// ── Tool: memory_save ─────────────────────────────────────────────────────────

export const memory_save = tool({
  description: "Save a value to persistent memory with an optional list of tags.",
  inputSchema: z.object({
    key: z.string().describe("Memory key (used as filename)"),
    value: z.string().describe("Value to store"),
    tags: z.array(z.string()).optional().default([]),
  }),
  execute: async ({ key, value, tags }) => {
    logger.tool("memory_save", key);
    await memorySave(key, value, tags);
    logger.memory(`Saved "${key}"`);
    return `Saved memory: ${key}`;
  },
});

// ── Tool: memory_get ──────────────────────────────────────────────────────────

export const memory_get = tool({
  description: "Retrieve a value from memory by key.",
  inputSchema: z.object({
    key: z.string(),
  }),
  execute: async ({ key }) => {
    logger.tool("memory_get", key);
    const value = await memoryGetValue(key);
    if (value === null) {
      logger.warning(`Memory key not found: ${key}`);
      return `(no memory for key: ${key})`;
    }
    logger.memory(`Retrieved "${key}"`);
    return value;
  },
});

// ── Tool: memory_search ───────────────────────────────────────────────────────

export const memory_search = tool({
  description: "Fuzzy search across all memory files for a query.",
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    logger.tool("memory_search", query);
    const results = await memorySearch(query);
    if (results.length === 0) {
      return `(no memories found for query: ${query})`;
    }
    logger.memory(`Found ${results.length} matching memories`);
    return results.map(e => `**${e.key}** [${e.tags.join(", ")}]\n${e.value}`).join("\n\n---\n\n");
  },
});

// ── Tool: memory_list ─────────────────────────────────────────────────────────

export const memory_list = tool({
  description: "List all memory keys with tags and snippet.",
  inputSchema: z.object({}),
  execute: async () => {
    logger.tool("memory_list");
    const entries = await memoryList();
    if (entries.length === 0) return "(no memories stored)";
    logger.memory(`Listing ${entries.length} memories`);
    return entries.map(e => {
      const tagStr = e.tags.length > 0 ? ` [${e.tags.join(", ")}]` : "";
      const snippet = e.value.replace(/\n/g, " ").slice(0, 80);
      return `- **${e.key}**${tagStr}: ${snippet}`;
    }).join("\n");
  },
});

// ── Tool: memory_delete ───────────────────────────────────────────────────────

export const memory_delete = tool({
  description: "Delete a memory entry by key.",
  inputSchema: z.object({ key: z.string() }),
  execute: async ({ key }) => {
    logger.tool("memory_delete", key);
    const deleted = await memoryDelete(key);
    if (!deleted) {
      logger.warning(`Memory key not found: ${key}`);
      return `(no memory for key: ${key})`;
    }
    logger.memory(`Deleted "${key}"`);
    return `Deleted memory: ${key}`;
  },
});

// ── Export all ────────────────────────────────────────────────────────────────

export const memoryTools = {
  memory_save,
  memory_get,
  memory_search,
  memory_list,
  memory_delete,
};
