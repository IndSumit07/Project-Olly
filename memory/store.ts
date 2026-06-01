// ─────────────────────────────────────────────────────────────────────────────
// Olly – Memory Store (memory/store.ts)
// Stores memory as Markdown files with YAML frontmatter in ~/.olly/memory/
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const MEMORY_DIR = path.join(os.homedir(), ".olly", "memory");

export interface MemoryEntry {
  key: string;
  value: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function memoryPath(key: string): string {
  // Sanitize key for use as filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  return path.join(MEMORY_DIR, `${safe}.md`);
}

function serialize(entry: MemoryEntry): string {
  const tagStr = entry.tags.length > 0 ? `[${entry.tags.map(t => `"${t}"`).join(", ")}]` : "[]";
  return `---
key: ${entry.key}
tags: ${tagStr}
createdAt: ${entry.createdAt}
updatedAt: ${entry.updatedAt}
---

${entry.value}
`;
}

function deserialize(raw: string, filename: string): MemoryEntry | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) {
    // Plain value without frontmatter
    return {
      key: path.basename(filename, ".md"),
      value: raw.trim(),
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const frontmatter = match[1] ?? "";
  const value = (match[2] ?? "").trim();

  const keyMatch = frontmatter.match(/key:\s*(.+)/);
  const tagsMatch = frontmatter.match(/tags:\s*(\[.*\])/);
  const createdMatch = frontmatter.match(/createdAt:\s*(.+)/);
  const updatedMatch = frontmatter.match(/updatedAt:\s*(.+)/);

  let tags: string[] = [];
  if (tagsMatch?.[1]) {
    try {
      tags = JSON.parse(tagsMatch[1]) as string[];
    } catch { tags = []; }
  }

  return {
    key: keyMatch?.[1]?.trim() ?? path.basename(filename, ".md"),
    value,
    tags,
    createdAt: createdMatch?.[1]?.trim() ?? new Date().toISOString(),
    updatedAt: updatedMatch?.[1]?.trim() ?? new Date().toISOString(),
  };
}

async function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    await fsp.mkdir(MEMORY_DIR, { recursive: true });
  }
}

// ── CRUD operations ───────────────────────────────────────────────────────────

export async function memorySave(key: string, value: string, tags: string[] = []): Promise<void> {
  await ensureMemoryDir();
  const filePath = memoryPath(key);
  const now = new Date().toISOString();

  let createdAt = now;
  if (fs.existsSync(filePath)) {
    const existing = await memoryGet(key);
    if (existing) createdAt = existing.createdAt;
  }

  const entry: MemoryEntry = { key, value, tags, createdAt, updatedAt: now };
  await fsp.writeFile(filePath, serialize(entry), "utf8");
}

export async function memoryGet(key: string): Promise<MemoryEntry | null> {
  const filePath = memoryPath(key);
  if (!fs.existsSync(filePath)) return null;
  const raw = await fsp.readFile(filePath, "utf8");
  return deserialize(raw, path.basename(filePath));
}

export async function memoryGetValue(key: string): Promise<string | null> {
  const entry = await memoryGet(key);
  return entry?.value ?? null;
}

export async function memoryList(): Promise<MemoryEntry[]> {
  await ensureMemoryDir();
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith(".md"));
  const entries: MemoryEntry[] = [];
  for (const file of files) {
    const raw = await fsp.readFile(path.join(MEMORY_DIR, file), "utf8");
    const entry = deserialize(raw, file);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function memorySearch(query: string): Promise<MemoryEntry[]> {
  const all = await memoryList();
  const q = query.toLowerCase();
  return all.filter(e =>
    e.key.toLowerCase().includes(q) ||
    e.value.toLowerCase().includes(q) ||
    e.tags.some(t => t.toLowerCase().includes(q))
  );
}

export async function memoryDelete(key: string): Promise<boolean> {
  const filePath = memoryPath(key);
  if (!fs.existsSync(filePath)) return false;
  await fsp.unlink(filePath);
  return true;
}

export async function loadMemoriesForPrompt(): Promise<string> {
  try {
    const entries = await memoryList();
    if (entries.length === 0) return "";
    const lines = entries.map(e => `- **${e.key}**: ${e.value.replace(/\n/g, " ").slice(0, 120)}`);
    return `## Loaded Memories (${entries.length})\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

export { MEMORY_DIR };
