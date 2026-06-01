// ─────────────────────────────────────────────────────────────────────────────
// Olly – Code Intelligence Tools (tools/code.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { logger } from "../tui/stepLogger";
import { gatedApproval } from "../tui/approvals";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "coverage"]);
const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".html", ".yml", ".yaml", ".toml", ".txt", ".sh", ".py", ".rs", ".go", ".java", ".cpp", ".c", ".h"]);

// ── Helper: run command and collect output ────────────────────────────────────
function runCmd(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, { shell: true, cwd: cwd ?? process.cwd() });
    const stdout: string[] = [];
    const stderr: string[] = [];

    proc.stdout?.on("data", (d: Buffer) => { stdout.push(d.toString()); logger.pipe(d.toString().trim()); });
    proc.stderr?.on("data", (d: Buffer) => { stderr.push(d.toString()); logger.pipe(`[err] ${d.toString().trim()}`); });
    proc.on("close", (code) => resolve({ stdout: stdout.join(""), stderr: stderr.join(""), code: code ?? -1 }));
    proc.on("error", () => resolve({ stdout: "", stderr: "spawn error", code: -1 }));
  });
}

// ── Tool: read_codebase ───────────────────────────────────────────────────────

export const read_codebase = tool({
  description: "Recursively scan a project directory and return a file tree + summary. Respects .gitignore patterns.",
  inputSchema: z.object({
    path: z.string().optional().default("."),
  }),
  execute: async ({ path: rootPath }) => {
    logger.tool("read_codebase", rootPath);
    const spinner = logger.spin(`Indexing codebase at ${rootPath}...`);

    const abs = path.resolve(rootPath);
    if (!fs.existsSync(abs)) {
      spinner.fail(`Not found: ${rootPath}`);
      return `Error: Not found: ${rootPath}`;
    }

    // Load .gitignore patterns
    const ignoredPatterns: string[] = [];
    const gitignorePath = path.join(abs, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const lines = fs.readFileSync(gitignorePath, "utf8").split(/\r?\n/);
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed && !trimmed.startsWith("#")) ignoredPatterns.push(trimmed);
      }
    }

    function isIgnored(name: string): boolean {
      return SKIP_DIRS.has(name) || ignoredPatterns.some(p => {
        if (p.endsWith("/")) return name === p.slice(0, -1);
        if (p.startsWith("*")) return name.endsWith(p.slice(1));
        return name === p;
      });
    }

    const treeLines: string[] = [];
    let totalFiles = 0;
    let totalLines = 0;
    const extCounts: Record<string, number> = {};

    function walk(dir: string, prefix: string, depth: number) {
      if (depth > 8) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const ent of entries) {
        if (ent.name.startsWith(".") && ent.name !== ".env.example") continue;
        if (isIgnored(ent.name)) continue;

        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          treeLines.push(`${prefix}${ent.name}/`);
          walk(full, prefix + "  ", depth + 1);
        } else {
          const ext = path.extname(ent.name).toLowerCase();
          extCounts[ext] = (extCounts[ext] ?? 0) + 1;
          totalFiles++;

          if (TEXT_EXTS.has(ext) && depth < 4) {
            try {
              const stat = fs.statSync(full);
              if (stat.size < 500 * 1024) {
                const text = fs.readFileSync(full, "utf8");
                totalLines += text.split(/\r?\n/).length;
              }
            } catch { /* skip */ }
          }
          treeLines.push(`${prefix}${ent.name}`);
        }
      }
    }

    walk(abs, "", 0);

    const topExts = Object.entries(extCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ext, cnt]) => `${ext}: ${cnt}`)
      .join(", ");

    const summary = [
      `## Codebase: ${path.basename(abs)}`,
      `Files: ${totalFiles} | Lines: ~${totalLines}`,
      `Top types: ${topExts}`,
      ``,
      `## File Tree`,
      ...treeLines.slice(0, 300),
      treeLines.length > 300 ? `... (${treeLines.length - 300} more entries)` : "",
    ].join("\n");

    spinner.succeed(`Indexed codebase: ${totalFiles} files, ~${totalLines} lines`);
    return summary;
  },
});

// ── Tool: find_definition ─────────────────────────────────────────────────────

export const find_definition = tool({
  description: "Search for a function, class, or variable definition across the codebase.",
  inputSchema: z.object({
    symbol: z.string().describe("Function/class/variable name to find"),
    path: z.string().optional().default("."),
  }),
  execute: async ({ symbol, path: searchPath }) => {
    logger.tool("find_definition", symbol);
    logger.pending(`Searching for definition of '${symbol}'...`);

    const abs = path.resolve(searchPath ?? ".");
    const results: string[] = [];

    const defPatterns = [
      new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${symbol}\\b`),
      new RegExp(`^\\s*(export\\s+)?class\\s+${symbol}\\b`),
      new RegExp(`^\\s*(export\\s+)?(const|let|var)\\s+${symbol}\\s*=`),
      new RegExp(`^\\s*(export\\s+)?type\\s+${symbol}\\s*=`),
      new RegExp(`^\\s*(export\\s+)?interface\\s+${symbol}\\b`),
      new RegExp(`\\bdef\\s+${symbol}\\b`),
      new RegExp(`^\\s*${symbol}\\s*\\(`),
    ];

    function walk(dir: string) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }
      for (const ent of entries) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full);
        } else {
          const ext = path.extname(ent.name).toLowerCase();
          if (!TEXT_EXTS.has(ext)) continue;
          try {
            const stat = fs.statSync(full);
            if (stat.size > 1024 * 1024) return;
            const text = fs.readFileSync(full, "utf8");
            const lines = text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i] ?? "";
              if (defPatterns.some(p => p.test(line))) {
                const relPath = path.relative(abs, full).split(path.sep).join("/");
                results.push(`${relPath}:${i + 1}:${line.trim()}`);
              }
            }
          } catch { /* skip */ }
        }
      }
    }

    walk(abs);
    logger.success(`Found ${results.length} definition(s) of '${symbol}'`);
    return results.slice(0, 50).join("\n") || `(no definition found for: ${symbol})`;
  },
});

// ── Tool: run_tests ───────────────────────────────────────────────────────────

export const run_tests = tool({
  description: "Auto-detect and run tests (jest/vitest/bun test). Streams output live.",
  inputSchema: z.object({
    path: z.string().optional().default("."),
    framework: z.enum(["jest", "vitest", "bun"]).optional(),
  }),
  execute: async ({ path: testPath, framework }) => {
    logger.tool("run_tests", testPath);

    const abs = path.resolve(testPath ?? ".");
    let cmd = "";

    if (framework) {
      cmd = framework === "bun" ? "bun test" : `npx ${framework} run`;
    } else {
      // Auto-detect
      const pkgPath = path.join(abs, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
            scripts?: Record<string, string>;
            devDependencies?: Record<string, string>;
            dependencies?: Record<string, string>;
          };
          const deps = { ...pkg.devDependencies, ...pkg.dependencies };
          if (deps["vitest"]) cmd = "npx vitest run";
          else if (deps["jest"]) cmd = "npx jest";
          else if (pkg.scripts?.["test"]) cmd = "bun run test";
          else cmd = "bun test";
        } catch {
          cmd = "bun test";
        }
      } else {
        cmd = "bun test";
      }
    }

    logger.shell(cmd);
    const { stdout, stderr, code } = await runCmd(cmd, abs);
    const out = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

    // Parse test summary
    const passMatch = out.match(/(\d+)\s+pass/i);
    const failMatch = out.match(/(\d+)\s+fail/i);
    const passed = passMatch?.[1] ?? "?";
    const failed = failMatch?.[1] ?? "0";

    if (code === 0) {
      logger.success(`Tests passed: ${passed} passed, ${failed} failed`);
    } else {
      logger.error(`Tests failed: ${passed} passed, ${failed} failed (exit ${code})`);
    }

    return out || `Exit code: ${code}`;
  },
});

// ── Tool: lint_code ───────────────────────────────────────────────────────────

export const lint_code = tool({
  description: "Run ESLint or Biome on a file/directory. With fix=true, applies auto-fixes after confirmation.",
  inputSchema: z.object({
    path: z.string(),
    fix: z.boolean().optional().default(false),
  }),
  execute: async ({ path: lintPath, fix }) => {
    logger.tool("lint_code", `${lintPath}${fix ? " (fix)" : ""}`);

    const abs = path.resolve(lintPath);
    const root = abs.includes("node_modules") ? process.cwd() : abs;

    // Detect linter
    let cmd = "";
    const biomeConfig = path.join(root, "biome.json");
    const eslintConfig = ["eslint.config.js", ".eslintrc.js", ".eslintrc.json", ".eslintrc"]
      .map(f => path.join(root, f))
      .find(f => fs.existsSync(f));

    if (fs.existsSync(biomeConfig)) {
      cmd = `npx biome check${fix ? " --write" : ""} ${lintPath}`;
    } else if (eslintConfig) {
      cmd = `npx eslint${fix ? " --fix" : ""} ${lintPath}`;
    } else {
      logger.warning("No ESLint or Biome config found. Trying ESLint...");
      cmd = `npx eslint${fix ? " --fix" : ""} ${lintPath}`;
    }

    if (fix) {
      const approved = await gatedApproval({
        tool: "lint_code",
        action: `Auto-fix ${path.basename(lintPath)}`,
        risk: "medium",
        detail: "Will modify files to fix lint issues",
      });
      if (!approved) {
        logger.warning("Lint fix cancelled by user.");
        return "Cancelled: user denied lint fix.";
      }
    }

    logger.shell(cmd);
    const { stdout, stderr, code } = await runCmd(cmd, root);

    if (code === 0) {
      logger.success(`Lint passed for ${path.basename(lintPath)}`);
    } else {
      logger.warning(`Lint found issues in ${path.basename(lintPath)} (exit ${code})`);
    }

    return stdout || stderr || `Exit code: ${code}`;
  },
});

// ── Git tools ────────────────────────────────────────────────────────────────

export const git_status = tool({
  description: "Show git status of the current working directory.",
  inputSchema: z.object({}),
  execute: async () => {
    logger.tool("git_status");
    const { stdout, code } = await runCmd("git status --short");
    if (code !== 0) {
      logger.error("git status failed (not a git repo?)");
      return "Error: not a git repository or git not installed";
    }
    logger.success("Got git status");
    return stdout.trim() || "(clean working tree)";
  },
});

export const git_diff = tool({
  description: "Show git diff for the repo or a specific file.",
  inputSchema: z.object({
    path: z.string().optional(),
  }),
  execute: async ({ path: diffPath }) => {
    logger.tool("git_diff", diffPath ?? ".");
    const cmd = diffPath ? `git diff ${diffPath}` : "git diff";
    const { stdout, code } = await runCmd(cmd);
    if (code !== 0) {
      logger.warning("git diff returned non-zero exit code");
    }
    logger.success("Got git diff");
    return stdout.trim() || "(no changes)";
  },
});

export const git_commit = tool({
  description: "Stage files and create a git commit. Always asks confirmation.",
  inputSchema: z.object({
    message: z.string().describe("Commit message"),
    files: z.array(z.string()).optional().describe("Files to stage (omit to stage all)"),
  }),
  execute: async ({ message, files }) => {
    logger.tool("git_commit", message);

    const approved = await gatedApproval({
      tool: "git_commit",
      action: `commit: "${message}"`,
      risk: "medium",
      detail: files ? `Files: ${files.join(", ")}` : "All staged changes",
    });

    if (!approved) {
      logger.warning("Commit cancelled by user.");
      return "Cancelled: user denied git commit.";
    }

    const stageCmd = files ? `git add ${files.join(" ")}` : "git add -A";
    logger.shell(stageCmd);
    const { code: stageCode } = await runCmd(stageCmd);
    if (stageCode !== 0) {
      logger.error("git add failed");
      return "Error: git add failed";
    }

    const commitCmd = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    logger.shell(commitCmd);
    const { stdout, code } = await runCmd(commitCmd);

    if (code === 0) {
      logger.success(`Committed: "${message}"`);
    } else {
      logger.error(`git commit failed (exit ${code})`);
    }

    return stdout.trim() || `Exit code: ${code}`;
  },
});

export const git_log = tool({
  description: "Show recent git commits.",
  inputSchema: z.object({
    n: z.number().int().optional().default(10),
  }),
  execute: async ({ n }) => {
    logger.tool("git_log", `last ${n ?? 10}`);
    const cmd = `git log --oneline -n ${n ?? 10}`;
    const { stdout, code } = await runCmd(cmd);
    if (code !== 0) {
      logger.error("git log failed");
      return "Error: not a git repository or git not installed";
    }
    logger.success(`Got last ${n ?? 10} commits`);
    return stdout.trim() || "(no commits)";
  },
});

// ── Export all ────────────────────────────────────────────────────────────────

export const codeTools = {
  read_codebase,
  find_definition,
  run_tests,
  lint_code,
  git_status,
  git_diff,
  git_commit,
  git_log,
};
