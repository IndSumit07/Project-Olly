// ─────────────────────────────────────────────────────────────────────────────
// Olly – Shell Execution Tools (tools/shell.ts)
// Uses Bun.spawn for streaming, logs everything via StepLogger
// ─────────────────────────────────────────────────────────────────────────────

import { tool } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "../tui/stepLogger";
import { gatedApproval } from "../tui/approvals";

// ── Config paths ──────────────────────────────────────────────────────────────
const OLLY_DIR = path.join(os.homedir(), ".olly");
const HISTORY_FILE = path.join(OLLY_DIR, "shell-history.log");
const POLICY_FILE = path.join(OLLY_DIR, "shell-policy.json");

// ── Dangerous command patterns ────────────────────────────────────────────────
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf/i,
  /\bformat\b/i,
  /\bsudo\b/i,
  /\bdd\s+if=/i,
  /\bmkfs/i,
  /\bfdisk/i,
  /\bshutdown/i,
  /\breboot/i,
  /\bpoweroff/i,
  /\bchmod\s+777/i,
  /\bchown\s+root/i,
  /:\s*\{\s*:\s*\|\s*:\s*&/,  // fork bomb
  />\s*\/dev\/sd/i,
];

const DENYLIST = [
  /:\{:\|:&\};:/,
  /rm\s+-rf\s+\//,
  />\s*\/dev\/(sda|sdb|hda|hdb)/i,
];

function isDangerous(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(cmd));
}

function isDenied(cmd: string): boolean {
  // Check runtime policy file
  if (fs.existsSync(POLICY_FILE)) {
    try {
      const policy = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8")) as {
        denylist?: string[];
      };
      const extra = policy.denylist ?? [];
      for (const pat of extra) {
        if (new RegExp(pat, "i").test(cmd)) return true;
      }
    } catch { /* ignore */ }
  }
  return DENYLIST.some(p => p.test(cmd));
}

// ── Background process registry ───────────────────────────────────────────────
interface BgProcess {
  pid: number;
  command: string;
  sessionId: string;
  startedAt: Date;
  output: string[];
  process: ReturnType<typeof spawn>;
}

const bgProcesses = new Map<string, BgProcess>();
let bgCounter = 0;

// ── History logger ────────────────────────────────────────────────────────────
async function logHistory(cmd: string, cwd: string, exitCode: number | null, durationMs: number) {
  try {
    if (!fs.existsSync(OLLY_DIR)) await fsp.mkdir(OLLY_DIR, { recursive: true });
    const entry = `[${new Date().toISOString()}] exit=${exitCode ?? "?"} (${(durationMs/1000).toFixed(1)}s) cwd=${cwd} cmd=${cmd}\n`;
    await fsp.appendFile(HISTORY_FILE, entry, "utf8");
  } catch { /* non-fatal */ }
}

// ── Tool: exec_command ────────────────────────────────────────────────────────

export const exec_command = tool({
  description: "Execute a shell command. Streams output live. Asks confirmation for dangerous commands.",
  inputSchema: z.object({
    command: z.string().describe("Shell command to run"),
    cwd: z.string().optional().describe("Working directory"),
    timeout_ms: z.number().optional().default(30000).describe("Timeout in ms (default 30s)"),
    background: z.boolean().optional().default(false).describe("Run in background, return PID"),
  }),
  execute: async ({ command, cwd, timeout_ms, background }) => {
    logger.tool("exec_command", command);

    // Check denylist first
    if (isDenied(command)) {
      logger.error(`Blocked command: ${command}`);
      logger.warning("This command is in the security denylist.");
      return `Error: Command blocked by security policy: ${command}`;
    }

    const risk = isDangerous(command) ? "high" : "medium";
    const approved = await gatedApproval({
      tool: "exec_command",
      action: command,
      risk,
      detail: risk === "high" ? "⚠ Potentially destructive!" : undefined,
    });

    if (!approved) {
      logger.warning("Command execution cancelled by user.");
      return "Cancelled: user denied command execution.";
    }

    const workDir = cwd ? path.resolve(cwd) : process.cwd();
    logger.shell(command);

    if (background) {
      bgCounter++;
      const sessionId = `bg-${bgCounter}`;
      const proc = spawn(command, { shell: true, cwd: workDir, stdio: ["ignore", "pipe", "pipe"] });
      const pid = proc.pid ?? 0;
      const outputBuf: string[] = [];

      proc.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (line.trim()) { outputBuf.push(line); logger.pipe(line); }
        }
      });
      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (line.trim()) { outputBuf.push(`[err] ${line}`); }
        }
      });

      bgProcesses.set(sessionId, {
        pid, command, sessionId, startedAt: new Date(), output: outputBuf, process: proc,
      });

      logger.info(`⟳ Running in background (PID ${pid}, session: ${sessionId})`);
      return `Background process started (PID ${pid}, session: ${sessionId}). Use read_output('${sessionId}') to check output.`;
    }

    // Foreground execution
    return new Promise<string>((resolve) => {
      const startedAt = Date.now();
      const output: string[] = [];
      let timedOut = false;

      const proc = spawn(command, { shell: true, cwd: workDir, stdio: ["ignore", "pipe", "pipe"] });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        logger.error(`Command timed out after ${(timeout_ms ?? 30000) / 1000}s: ${command}`);
      }, timeout_ms ?? 30000);

      proc.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (line.trim()) { output.push(line); logger.pipe(line); }
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        for (const line of text.split("\n")) {
          if (line.trim()) { output.push(`[err] ${line}`); logger.pipe(`[err] ${line}`); }
        }
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startedAt;
        const exitCode = timedOut ? -1 : (code ?? -1);

        void logHistory(command, workDir, exitCode, duration);

        if (exitCode === 0) {
          logger.success(`Exit 0 (${(duration/1000).toFixed(1)}s)`);
        } else {
          logger.error(`Exit ${exitCode} (${(duration/1000).toFixed(1)}s)`);
        }

        resolve(output.join("\n") || `Exit code: ${exitCode}`);
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        logger.error(`Command failed: ${err.message}`);
        resolve(`Error: ${err.message}`);
      });
    });
  },
});

// ── Tool: read_output ─────────────────────────────────────────────────────────

export const read_output = tool({
  description: "Read buffered stdout of a background process by session ID.",
  inputSchema: z.object({
    session_id: z.string(),
  }),
  execute: async ({ session_id }) => {
    logger.tool("read_output", session_id);
    const proc = bgProcesses.get(session_id);
    if (!proc) {
      return `Error: No background process with session_id '${session_id}'`;
    }
    const out = proc.output.join("\n");
    logger.success(`Read output from ${session_id} (${proc.output.length} lines)`);
    return out || "(no output yet)";
  },
});

// ── Tool: kill_process ────────────────────────────────────────────────────────

export const kill_process = tool({
  description: "Kill a background process by PID.",
  inputSchema: z.object({ pid: z.number().int() }),
  execute: async ({ pid }) => {
    logger.tool("kill_process", String(pid));
    try {
      process.kill(pid, "SIGTERM");
      // Remove from registry
      for (const [id, p] of bgProcesses) {
        if (p.pid === pid) bgProcesses.delete(id);
      }
      logger.success(`Sent SIGTERM to PID ${pid}`);
      return `Sent SIGTERM to PID ${pid}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to kill PID ${pid}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: list_processes ──────────────────────────────────────────────────────

export const list_processes = tool({
  description: "List all background processes started by Olly in this session.",
  inputSchema: z.object({}),
  execute: async () => {
    logger.tool("list_processes");
    if (bgProcesses.size === 0) {
      return "(no background processes)";
    }
    const lines: string[] = ["SESSION     PID    COMMAND              STARTED"];
    for (const [, p] of bgProcesses) {
      lines.push(
        `${p.sessionId.padEnd(12)}${String(p.pid).padEnd(7)}${p.command.slice(0, 20).padEnd(21)}${p.startedAt.toISOString().slice(11, 19)}`
      );
    }
    return lines.join("\n");
  },
});

// ── Export all ────────────────────────────────────────────────────────────────

export const shellTools = {
  exec_command,
  read_output,
  kill_process,
  list_processes,
};
