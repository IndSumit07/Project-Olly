// ─────────────────────────────────────────────────────────────────────────────
// Olly – Approval System (tui/approvals.ts)
// Permission required before ANY destructive or sensitive operation
// ─────────────────────────────────────────────────────────────────────────────

import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import { logger } from "./stepLogger";

// ── Risk levels ───────────────────────────────────────────────────────────────
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ApprovalRequest {
  tool: string;
  action: string;
  risk: RiskLevel;
  detail?: string;
}

export type ApprovalResult = "allow_once" | "allow_session" | "deny" | "explain";

// ── Session-wide allowances ────────────────────────────────────────────────────
const sessionAllowed = new Set<string>();

function sessionKey(tool: string, action: string): string {
  return `${tool}::${action}`;
}

// ── Risk color map ────────────────────────────────────────────────────────────
const riskColor: Record<RiskLevel, (s: string) => string> = {
  low:      chalk.green,
  medium:   chalk.yellow,
  high:     chalk.red,
  critical: chalk.bgRed.white,
};

const riskLabel: Record<RiskLevel, string> = {
  low:      "LOW – Read-only / info",
  medium:   "MEDIUM – Modifies state",
  high:     "HIGH – Destructive",
  critical: "CRITICAL – Blocked",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main approval gate
// ─────────────────────────────────────────────────────────────────────────────

export async function requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
  // LOW risk → auto-allow (just log)
  if (req.risk === "low") {
    logger.tool(req.tool, req.action);
    return "allow_once";
  }

  // CRITICAL → always block
  if (req.risk === "critical") {
    logger.error(`Blocked: ${req.tool} — ${req.action}`);
    logger.warning("This operation is in the shell denylist and cannot be executed.");
    return "deny";
  }

  // Check session cache (only for medium risk)
  if (req.risk === "medium" && sessionAllowed.has(sessionKey(req.tool, req.action))) {
    logger.tool(req.tool, req.action + " (session-allowed)");
    return "allow_session";
  }

  // Show the approval box
  const riskStr = riskColor[req.risk](riskLabel[req.risk]);
  console.log();
  console.log(chalk.bold.yellow("┌─────────────────────────────────────────────────────┐"));
  console.log(chalk.bold.yellow("│  ⚠  Permission Required                              │"));
  console.log(chalk.bold.yellow("│                                                       │"));
  console.log(`${chalk.bold.yellow("│")}  Tool:   ${chalk.cyan(req.tool.padEnd(45))}${chalk.bold.yellow("│")}`);
  console.log(`${chalk.bold.yellow("│")}  Action: ${chalk.white(req.action.slice(0, 45).padEnd(45))}${chalk.bold.yellow("│")}`);
  console.log(`${chalk.bold.yellow("│")}  Risk:   ${riskStr.padEnd(50)}${chalk.bold.yellow("│")}`);
  if (req.detail) {
    console.log(`${chalk.bold.yellow("│")}  Note:   ${chalk.dim(req.detail.slice(0, 45).padEnd(45))}${chalk.bold.yellow("│")}`);
  }
  console.log(chalk.bold.yellow("│                                                       │"));
  console.log(chalk.bold.yellow("└─────────────────────────────────────────────────────┘"));

  const choice = await select({
    message: "How do you want to proceed?",
    options: [
      { value: "allow_once", label: "✅ Allow once" },
      { value: "allow_session", label: "🔓 Allow always for this session" },
      { value: "deny", label: "🚫 Deny" },
    ],
  });

  if (isCancel(choice)) return "deny";

  const result = choice as ApprovalResult;

  if (result === "allow_session") {
    sessionAllowed.add(sessionKey(req.tool, req.action));
  }

  return result;
}

// ── Auto-approve policy ───────────────────────────────────────────────────────
let _autoMode = false;

export function setAutoMode(on: boolean) { _autoMode = on; }
export function isAutoMode() { return _autoMode; }

/** Auto-approve non-destructive ops when --auto flag is set */
export async function gatedApproval(req: ApprovalRequest): Promise<boolean> {
  if (_autoMode && req.risk !== "high" && req.risk !== "critical") {
    logger.tool(req.tool, req.action + " (auto-approved)");
    return true;
  }
  const result = await requestApproval(req);
  return result === "allow_once" || result === "allow_session";
}
