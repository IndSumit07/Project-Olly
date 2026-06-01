// ─────────────────────────────────────────────────────────────────────────────
// Olly – Skills System (skills/index.ts)
// Markdown files with YAML frontmatter that inject instructions into the agent
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "../tui/stepLogger";

const USER_SKILLS_DIR = path.join(os.homedir(), ".olly", "skills");
const BUILTIN_SKILLS_DIR = path.join(import.meta.dir, "..", "skills");
const ENABLED_FILE = path.join(os.homedir(), ".olly", "skills-enabled.json");

export interface Skill {
  name: string;
  description: string;
  content: string;
  source: "builtin" | "user";
  enabled: boolean;
}

// ── Load enabled skills list ──────────────────────────────────────────────────
function loadEnabledSkills(): Set<string> {
  if (!fs.existsSync(ENABLED_FILE)) {
    // Default enabled: coding
    return new Set(["coding"]);
  }
  try {
    const raw = fs.readFileSync(ENABLED_FILE, "utf8");
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(["coding"]);
  }
}

async function saveEnabledSkills(enabled: Set<string>): Promise<void> {
  await fsp.mkdir(path.dirname(ENABLED_FILE), { recursive: true });
  await fsp.writeFile(ENABLED_FILE, JSON.stringify([...enabled], null, 2), "utf8");
}

// ── Parse skill markdown file ─────────────────────────────────────────────────
function parseSkillFile(filePath: string, source: "builtin" | "user", enabled: boolean): Skill | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const name = path.basename(filePath, ".md");

    // Extract description from frontmatter
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    let description = "";
    let content = raw;

    if (fmMatch) {
      const fm = fmMatch[1] ?? "";
      content = fmMatch[2]?.trim() ?? raw;
      const descMatch = fm.match(/description:\s*(.+)/);
      description = descMatch?.[1]?.trim() ?? "";
    }

    return { name, description, content, source, enabled };
  } catch {
    return null;
  }
}

// ── List all available skills ─────────────────────────────────────────────────
export function listSkills(): Skill[] {
  const enabled = loadEnabledSkills();
  const skills: Skill[] = [];
  const seen = new Set<string>();

  // Built-in skills
  if (fs.existsSync(BUILTIN_SKILLS_DIR)) {
    for (const file of fs.readdirSync(BUILTIN_SKILLS_DIR)) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(".md", "");
      const skill = parseSkillFile(path.join(BUILTIN_SKILLS_DIR, file), "builtin", enabled.has(name));
      if (skill) { skills.push(skill); seen.add(name); }
    }
  }

  // User skills (override builtins with same name)
  if (fs.existsSync(USER_SKILLS_DIR)) {
    for (const file of fs.readdirSync(USER_SKILLS_DIR)) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(".md", "");
      const skill = parseSkillFile(path.join(USER_SKILLS_DIR, file), "user", enabled.has(name));
      if (skill) {
        // Replace builtin if exists
        const idx = skills.findIndex(s => s.name === name);
        if (idx >= 0) skills[idx] = skill;
        else skills.push(skill);
        seen.add(name);
      }
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Get active skill content for system prompt ────────────────────────────────
export function getActiveSkillsPrompt(): string {
  const skills = listSkills().filter(s => s.enabled);
  if (skills.length === 0) return "";

  const names = skills.map(s => s.name).join(", ");
  logger.info(`◆ Active skills: ${names}`);

  const sections = skills.map(s => `### Skill: ${s.name}\n${s.content}`);
  return `## Active Skills\n\n${sections.join("\n\n---\n\n")}`;
}

// ── Enable/disable a skill ────────────────────────────────────────────────────
export async function enableSkill(name: string): Promise<boolean> {
  const skills = listSkills();
  const skill = skills.find(s => s.name === name);
  if (!skill) return false;

  const enabled = loadEnabledSkills();
  enabled.add(name);
  await saveEnabledSkills(enabled);
  logger.success(`Skill enabled: ${name}`);
  return true;
}

export async function disableSkill(name: string): Promise<boolean> {
  const enabled = loadEnabledSkills();
  if (!enabled.has(name)) return false;

  enabled.delete(name);
  await saveEnabledSkills(enabled);
  logger.success(`Skill disabled: ${name}`);
  return true;
}
