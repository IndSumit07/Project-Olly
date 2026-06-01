// ─────────────────────────────────────────────────────────────────────────────
// Olly – Filesystem Tools (tools/filesystem.ts)
// All tools log via StepLogger before and after executing.
// ─────────────────────────────────────────────────────────────────────────────

import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { logger } from "../tui/stepLogger";
import { gatedApproval } from "../tui/approvals";
import { createTwoFilesPatch } from "diff";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

async function ensureDir(filePath: string) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

function getFileType(p: string): string {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TSX", ".js": "JavaScript", ".jsx": "JSX",
    ".json": "JSON", ".md": "Markdown", ".css": "CSS", ".html": "HTML",
    ".yml": "YAML", ".yaml": "YAML", ".toml": "TOML", ".txt": "Text",
    ".sh": "Shell", ".py": "Python", ".rs": "Rust", ".go": "Go",
  };
  return map[ext] ?? "File";
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo"]);

// ── Tool: read_file ───────────────────────────────────────────────────────────

export const read_file = tool({
  description: "Read a file's contents with optional line range. Logs what it reads.",
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative file path"),
    lines_from: z.number().int().optional().describe("Start line (1-indexed)"),
    lines_to: z.number().int().optional().describe("End line (inclusive)"),
  }),
  execute: async ({ path: filePath, lines_from, lines_to }) => {
    logger.tool("read_file", filePath);
    logger.pending(`Reading file ${filePath}...`);

    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      logger.error(`File not found: ${filePath}`);
      return `Error: File not found: ${filePath}`;
    }

    try {
      const stat = fs.statSync(abs);
      const rawText = await fsp.readFile(abs, "utf8");
      const lines = rawText.split(/\r?\n/);

      let result = rawText;
      let lineInfo = `${lines.length} lines`;

      if (lines_from !== undefined || lines_to !== undefined) {
        const from = (lines_from ?? 1) - 1;
        const to = lines_to ?? lines.length;
        result = lines.slice(from, to).join("\n");
        lineInfo = `lines ${from + 1}-${to}`;
      }

      const fileType = getFileType(filePath);
      logger.success(`Read ${lineInfo} from ${path.basename(filePath)} (${formatSize(stat.size)}, ${fileType})`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to read ${filePath}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: write_file ──────────────────────────────────────────────────────────

export const write_file = tool({
  description: "Write content to a file. Asks for approval if overwriting. Shows diff for existing files.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
    mode: z.enum(["overwrite", "append"]).optional().default("overwrite"),
  }),
  execute: async ({ path: filePath, content, mode }) => {
    logger.tool("write_file", `${filePath} (${mode})`);
    const abs = path.resolve(filePath);
    const exists = fs.existsSync(abs);

    if (exists && mode === "overwrite") {
      const oldContent = await fsp.readFile(abs, "utf8");
      const patch = createTwoFilesPatch(filePath, filePath, oldContent, content, "before", "after");
      const oldLines = oldContent.split("\n").length;
      const newLines = content.split("\n").length;
      logger.warning(`Overwriting ${filePath} (${oldLines} → ${newLines} lines)`);

      const approved = await gatedApproval({
        tool: "write_file",
        action: `Overwrite ${path.basename(filePath)}`,
        risk: "medium",
        detail: `${oldLines} → ${newLines} lines`,
      });

      if (!approved) {
        logger.warning("Write cancelled by user.");
        return "Cancelled: user denied write permission.";
      }

      // Show compact diff
      const diffLines = patch.split("\n").slice(0, 20);
      for (const l of diffLines) {
        if (l.startsWith("+")) process.stdout.write(`\n${l}`);
        else if (l.startsWith("-")) process.stdout.write(`\n${l}`);
      }
      if (patch.split("\n").length > 20) logger.info("... (diff truncated)");
      console.log();
    }

    try {
      await ensureDir(abs);
      if (mode === "append") {
        await fsp.appendFile(abs, content, "utf8");
        logger.success(`Appended to ${path.basename(filePath)}`);
      } else {
        await fsp.writeFile(abs, content, "utf8");
        const lines = content.split("\n").length;
        logger.success(`Wrote ${lines} lines to ${path.basename(filePath)}`);
      }
      return `Success: wrote to ${filePath}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to write ${filePath}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: edit_file ───────────────────────────────────────────────────────────

export const edit_file = tool({
  description: "Surgically find-and-replace a unique string in a file (like str_replace). Validates old_str exists exactly once.",
  inputSchema: z.object({
    path: z.string(),
    old_str: z.string().describe("Exact string to find (must appear exactly once)"),
    new_str: z.string().describe("Replacement string"),
  }),
  execute: async ({ path: filePath, old_str, new_str }) => {
    logger.tool("edit_file", filePath);
    logger.pending(`Editing ${filePath}...`);

    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      logger.error(`File not found: ${filePath}`);
      return `Error: File not found: ${filePath}`;
    }

    try {
      const content = await fsp.readFile(abs, "utf8");
      const count = content.split(old_str).length - 1;

      if (count === 0) {
        logger.error(`edit_file: old_str not found in ${filePath}`);
        return `Error: old_str not found in ${filePath}`;
      }
      if (count > 1) {
        logger.error(`edit_file: old_str appears ${count} times in ${filePath} — must be unique`);
        return `Error: old_str appears ${count} times — must be unique`;
      }

      const newContent = content.replace(old_str, new_str);
      const lineNum = content.slice(0, content.indexOf(old_str)).split("\n").length;

      const approved = await gatedApproval({
        tool: "edit_file",
        action: `Edit ${path.basename(filePath)} at line ~${lineNum}`,
        risk: "medium",
      });

      if (!approved) {
        logger.warning("Edit cancelled by user.");
        return "Cancelled: user denied edit permission.";
      }

      await fsp.writeFile(abs, newContent, "utf8");
      logger.success(`Applied edit to ${path.basename(filePath)} (line ${lineNum})`);
      return `Success: edited ${filePath} at line ${lineNum}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to edit ${filePath}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: list_directory ──────────────────────────────────────────────────────

export const list_directory = tool({
  description: "List directory contents with sizes, types, last modified. Tree format for recursive.",
  inputSchema: z.object({
    path: z.string().optional().default("."),
    recursive: z.boolean().optional().default(false),
    show_hidden: z.boolean().optional().default(false),
  }),
  execute: async ({ path: dirPath, recursive, show_hidden }) => {
    logger.tool("list_directory", dirPath);
    logger.pending(`Scanning ${dirPath}...`);

    const abs = path.resolve(dirPath);
    if (!fs.existsSync(abs)) {
      logger.error(`Directory not found: ${dirPath}`);
      return `Error: Not found: ${dirPath}`;
    }

    const lines: string[] = [];
    let fileCount = 0;

    function walk(dir: string, prefix: string, depth: number) {
      if (depth > 10) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const ent of entries) {
        if (!show_hidden && ent.name.startsWith(".")) continue;
        if (SKIP_DIRS.has(ent.name)) continue;

        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          lines.push(`${prefix}${ent.name}/`);
          if (recursive) walk(full, prefix + "  ", depth + 1);
        } else {
          try {
            const stat = fs.statSync(full);
            const size = formatSize(stat.size);
            const modified = formatDate(stat.mtime);
            lines.push(`${prefix}${ent.name}  ${size}  ${modified}`);
            fileCount++;
          } catch {
            lines.push(`${prefix}${ent.name}`);
          }
        }
      }
    }

    walk(abs, "", 0);
    logger.success(`Scanned ${dirPath} (${fileCount} files)`);
    return lines.join("\n") || "(empty)";
  },
});

// ── Tool: search_files ────────────────────────────────────────────────────────

export const search_files = tool({
  description: "Search files by glob pattern and/or content (grep-like). Returns file:line:content format.",
  inputSchema: z.object({
    pattern: z.string().describe("Glob pattern like **/*.ts or content search term"),
    path: z.string().optional().default("."),
    file_type: z.string().optional().describe("Filter by extension e.g. .ts .md"),
    content: z.string().optional().describe("Search for this text inside files"),
  }),
  execute: async ({ pattern, path: searchPath, file_type, content }) => {
    logger.tool("search_files", `${pattern} in ${searchPath}`);
    logger.pending(`Searching ${searchPath} for '${pattern}'...`);

    const abs = path.resolve(searchPath ?? ".");
    if (!fs.existsSync(abs)) {
      logger.error(`Path not found: ${searchPath}`);
      return `Error: Not found: ${searchPath}`;
    }

    const results: string[] = [];
    let scanned = 0;

    // Build glob regex from pattern
    const globToRegex = (glob: string) => {
      let re = "^";
      for (let i = 0; i < glob.length; i++) {
        const ch = glob[i] ?? "";
        if (ch === "*" && glob[i+1] === "*") { re += ".*"; i++; }
        else if (ch === "*") { re += "[^/]*"; }
        else if (ch === "?") { re += "[^/]"; }
        else if (/[.+^${}()|[\]\\]/.test(ch)) { re += `\\${ch}`; }
        else { re += ch; }
      }
      re += "$";
      return new RegExp(re, "i");
    };

    const matcher = globToRegex(pattern);

    function walk(dir: string) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (SKIP_DIRS.has(ent.name)) continue;

        if (ent.isDirectory()) {
          walk(full);
        } else {
          const relPath = path.relative(abs, full).split(path.sep).join("/");
          if (file_type && !ent.name.endsWith(file_type)) continue;

          const nameMatches = matcher.test(ent.name) || matcher.test(relPath);

          if (content) {
            // Content search
            try {
              const stat = fs.statSync(full);
              if (stat.size > 2 * 1024 * 1024) return;
              const text = fs.readFileSync(full, "utf8");
              const lines = text.split(/\r?\n/);
              scanned++;
              for (let i = 0; i < lines.length; i++) {
                if (lines[i]!.includes(content)) {
                  results.push(`${relPath}:${i+1}:${lines[i]!.trim()}`);
                }
              }
            } catch { /* skip binary */ }
          } else if (nameMatches) {
            results.push(relPath);
          }
        }
      }
    }

    walk(abs);
    const summary = content
      ? `Found ${results.length} matches in ${scanned} files`
      : `Found ${results.length} files matching '${pattern}'`;
    logger.success(summary);
    return results.slice(0, 200).join("\n") || "(no results)";
  },
});

// ── Tool: create_directory ────────────────────────────────────────────────────

export const create_directory = tool({
  description: "Create a directory (and parents) if it doesn't exist.",
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path: dirPath }) => {
    logger.tool("create_directory", dirPath);
    try {
      await fsp.mkdir(path.resolve(dirPath), { recursive: true });
      logger.success(`Created directory: ${dirPath}`);
      return `Success: created ${dirPath}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to create directory: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: delete_file ─────────────────────────────────────────────────────────

export const delete_file = tool({
  description: "Delete a file. ALWAYS asks for user confirmation first.",
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path: filePath }) => {
    logger.tool("delete_file", filePath);
    logger.warning(`About to delete: ${filePath}`);

    const approved = await gatedApproval({
      tool: "delete_file",
      action: `Delete ${filePath}`,
      risk: "high",
      detail: "This action cannot be undone!",
    });

    if (!approved) {
      logger.info("Delete cancelled by user.");
      return "Cancelled: user denied delete permission.";
    }

    try {
      await fsp.unlink(path.resolve(filePath));
      logger.success(`Deleted: ${filePath}`);
      return `Success: deleted ${filePath}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to delete ${filePath}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: move_file ───────────────────────────────────────────────────────────

export const move_file = tool({
  description: "Move or rename a file.",
  inputSchema: z.object({
    src: z.string(),
    dest: z.string(),
  }),
  execute: async ({ src, dest }) => {
    logger.tool("move_file", `${src} → ${dest}`);
    try {
      const absDest = path.resolve(dest);
      await ensureDir(absDest);
      await fsp.rename(path.resolve(src), absDest);
      logger.success(`Moved: ${src} → ${dest}`);
      return `Success: moved ${src} to ${dest}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to move ${src}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: copy_file ───────────────────────────────────────────────────────────

export const copy_file = tool({
  description: "Copy a file to a new location.",
  inputSchema: z.object({
    src: z.string(),
    dest: z.string(),
  }),
  execute: async ({ src, dest }) => {
    logger.tool("copy_file", `${src} → ${dest}`);
    try {
      const absDest = path.resolve(dest);
      await ensureDir(absDest);
      await fsp.copyFile(path.resolve(src), absDest);
      logger.success(`Copied: ${src} → ${dest}`);
      return `Success: copied ${src} to ${dest}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to copy ${src}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: get_file_info ───────────────────────────────────────────────────────

export const get_file_info = tool({
  description: "Get detailed info about a file: size, permissions, type, line count.",
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path: filePath }) => {
    logger.tool("get_file_info", filePath);
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      logger.error(`Not found: ${filePath}`);
      return `Error: Not found: ${filePath}`;
    }
    try {
      const stat = fs.statSync(abs);
      const isDir = stat.isDirectory();
      let lineCount = "N/A";
      if (!isDir && stat.size < 2 * 1024 * 1024) {
        const text = await fsp.readFile(abs, "utf8");
        lineCount = String(text.split(/\r?\n/).length);
      }
      const info = [
        `Path:        ${filePath}`,
        `Type:        ${isDir ? "Directory" : getFileType(filePath)}`,
        `Size:        ${formatSize(stat.size)}`,
        `Lines:       ${lineCount}`,
        `Modified:    ${formatDate(stat.mtime)}`,
        `Created:     ${formatDate(stat.birthtime)}`,
      ].join("\n");
      logger.success(`Got info for ${path.basename(filePath)}`);
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to get info for ${filePath}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: find_files ──────────────────────────────────────────────────────────

export const find_files = tool({
  description: "Find files by name pattern recursively from a start path.",
  inputSchema: z.object({
    name_pattern: z.string().describe("Name pattern, can use * wildcard"),
    start_path: z.string().optional().default("."),
  }),
  execute: async ({ name_pattern, start_path }) => {
    logger.tool("find_files", `${name_pattern} from ${start_path}`);
    logger.pending(`Finding files matching '${name_pattern}'...`);

    const abs = path.resolve(start_path ?? ".");
    const pat = new RegExp("^" + name_pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$", "i");
    const results: string[] = [];

    function walk(dir: string) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }
      for (const ent of entries) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (pat.test(ent.name)) {
          results.push(path.relative(abs, full).split(path.sep).join("/"));
        }
      }
    }

    walk(abs);
    logger.success(`Found ${results.length} files matching '${name_pattern}'`);
    return results.slice(0, 200).join("\n") || "(no results)";
  },
});

// ── Export all ────────────────────────────────────────────────────────────────

export const filesystemTools = {
  read_file,
  write_file,
  edit_file,
  list_directory,
  search_files,
  create_directory,
  delete_file,
  move_file,
  copy_file,
  get_file_info,
  find_files,
};
