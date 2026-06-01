import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import os from "node:os";
import { runCliMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram/index";
import { memoryList } from "../memory/store";
import { listSkills } from "../skills/index";
import { announceLastSession } from "../modes/session";
import { logger } from "./stepLogger";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#ff0000");
const FACE = chalk.hex("#e8dcf8");

function printBannerWithShadow(ascii: string) {
  const bannerLines = ascii.replace(/\s+$/, "").split("\n");
  const maxLen = Math.max(...bannerLines.map((line) => line.length), 0);
  const rowWidth = maxLen + 2;

  for (const line of bannerLines) {
    console.log(SHADOW(("  " + line).padEnd(rowWidth)));
  }

  process.stdout.write(`\x1b[${bannerLines.length}A`);

  for (const line of bannerLines) {
    console.log(FACE(line.padEnd(rowWidth)));
  }

  console.log();
}

async function printStartupDashboard() {
  const provider = process.env.OLLY_PROVIDER ?? "openrouter";
  const model = process.env.OLLY_MODEL ?? "(default)";
  const platform = `${os.platform()} ${os.release()}`;
  const cwd = process.cwd();

  // Load memory count
  let memCount = 0;
  try {
    const memories = await memoryList();
    memCount = memories.length;
    if (memCount > 0) logger.memory(`Loading ${memCount} memories...`);
  } catch { /* ignore */ }

  // Load active skills
  let activeSkills: string[] = [];
  try {
    const skills = listSkills();
    activeSkills = skills.filter(s => s.enabled).map(s => s.name);
    if (activeSkills.length > 0) {
      logger.info(`◆ Active skills: ${activeSkills.join(", ")}`);
    }
  } catch { /* ignore */ }

  // Show last session
  try {
    await announceLastSession();
  } catch { /* ignore */ }

  // Dashboard box
  console.log();
  console.log(chalk.dim("┌─────────────────────────────────────────┐"));
  console.log(`${chalk.dim("│")} ${chalk.bold("Provider")}  ${chalk.green(provider.padEnd(30))} ${chalk.dim("│")}`);
  console.log(`${chalk.dim("│")} ${chalk.bold("Model    ")}  ${chalk.green(model.slice(0, 30).padEnd(30))} ${chalk.dim("│")}`);
  console.log(`${chalk.dim("│")} ${chalk.bold("OS       ")}  ${chalk.dim(platform.slice(0, 30).padEnd(30))} ${chalk.dim("│")}`);
  console.log(`${chalk.dim("│")} ${chalk.bold("CWD      ")}  ${chalk.dim(cwd.slice(-30).padEnd(30))} ${chalk.dim("│")}`);
  console.log(`${chalk.dim("│")} ${chalk.bold("Memories ")}  ${chalk.magenta(String(memCount).padEnd(30))} ${chalk.dim("│")}`);
  console.log(`${chalk.dim("│")} ${chalk.bold("Skills   ")}  ${chalk.cyan((activeSkills.join(", ") || "none").slice(0, 30).padEnd(30))} ${chalk.dim("│")}`);
  console.log(chalk.dim("└─────────────────────────────────────────┘"));
  console.log();
}

export async function runWakeup() {
  let ascii: string;
  try {
    ascii = figlet.textSync("Olly", { font: BANNER_FONT });
  } catch {
    ascii = figlet.textSync("Olly", { font: "Standard" });
  }
  printBannerWithShadow(ascii);

  await printStartupDashboard();

  while (true) {
    const mode = await select({
      message: "How would you like to interact with Olly?",
      options: [
        { value: "cli", label: "⚡ CLI — Agent / Plan / Ask modes" },
        { value: "telegram", label: "📱 Telegram" },
        { value: "exit", label: "👋 Exit" },
      ],
    });

    if (isCancel(mode) || mode === "exit") {
      console.log(chalk.yellow("\n No worries! You can wake up Olly anytime by running 'olly wakeup'."));
      return;
    }

    if (mode === "cli") {
      await runCliMode();
      continue;
    }

    if (mode === "telegram") {
      console.log(chalk.dim("Awesome! Starting Olly in Telegram mode..."));
      await runTelegramMode();
      continue;
    }
  }
}