// ─────────────────────────────────────────────────────────────────────────────
// Olly – Session Manager (modes/session.ts)
// Saves/loads conversation history to ~/.olly/sessions/
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "../tui/stepLogger";

const SESSIONS_DIR = path.join(os.homedir(), ".olly", "sessions");

export interface SessionMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  goal?: string;
  messages: SessionMessage[];
  filesModified: string[];
  commandsRun: string[];
}

async function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    await fsp.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

// ── Create a new session ──────────────────────────────────────────────────────
export function createSession(goal?: string): Session {
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    id,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    goal,
    messages: [],
    filesModified: [],
    commandsRun: [],
  };
}

// ── Save session to disk ──────────────────────────────────────────────────────
export async function saveSession(session: Session): Promise<void> {
  await ensureSessionsDir();
  session.lastActiveAt = new Date().toISOString();
  await fsp.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), "utf8");
}

// ── Load a specific session ───────────────────────────────────────────────────
export async function loadSession(id: string): Promise<Session | null> {
  const filePath = sessionPath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

// ── Load the most recent session ──────────────────────────────────────────────
export async function loadLastSession(): Promise<Session | null> {
  await ensureSessionsDir();
  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return loadSession(files[0]!.replace(".json", ""));
}

// ── List all sessions ─────────────────────────────────────────────────────────
export async function listSessions(): Promise<Session[]> {
  await ensureSessionsDir();
  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse();

  const sessions: Session[] = [];
  for (const file of files.slice(0, 20)) {
    try {
      const raw = await fsp.readFile(path.join(SESSIONS_DIR, file), "utf8");
      const s = JSON.parse(raw) as Session;
      sessions.push(s);
    } catch { /* skip */ }
  }
  return sessions;
}

// ── Format time ago ───────────────────────────────────────────────────────────
export function timeAgo(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Show last session context at startup ──────────────────────────────────────
export async function announceLastSession(): Promise<string | null> {
  const last = await loadLastSession();
  if (!last) return null;

  const ago = timeAgo(last.lastActiveAt);
  const msgCount = last.messages.length;
  logger.info(`Continuing session from ${ago} (${msgCount} messages${last.goal ? `: "${last.goal.slice(0, 50)}"` : ""})`);
  return last.id;
}
