// ─────────────────────────────────────────────────────────────────────────────
// Olly – Unified Tool Registry (tools/index.ts)
// Single export point for all agent tools
// ─────────────────────────────────────────────────────────────────────────────

export { filesystemTools } from "./filesystem";
export { shellTools } from "./shell";
export { memoryTools } from "./memory";
export { webTools } from "./web";
export { codeTools } from "./code";

import { filesystemTools } from "./filesystem";
import { shellTools } from "./shell";
import { memoryTools } from "./memory";
import { webTools } from "./web";
import { codeTools } from "./code";

/** All tools bundled for the full autonomous agent */
export const allTools = {
  ...filesystemTools,
  ...shellTools,
  ...memoryTools,
  ...webTools,
  ...codeTools,
};

/** Read-only tools (no shell, no writes) for Ask mode */
export const readOnlyTools = {
  read_file: filesystemTools.read_file,
  list_directory: filesystemTools.list_directory,
  search_files: filesystemTools.search_files,
  get_file_info: filesystemTools.get_file_info,
  find_files: filesystemTools.find_files,
  memory_get: memoryTools.memory_get,
  memory_list: memoryTools.memory_list,
  memory_search: memoryTools.memory_search,
  web_fetch: webTools.web_fetch,
  web_search: webTools.web_search,
  read_codebase: codeTools.read_codebase,
  find_definition: codeTools.find_definition,
  git_status: codeTools.git_status,
  git_log: codeTools.git_log,
};

/** Tools safe for plan mode (adds write + shell to read-only) */
export const planTools = {
  ...allTools,
};
