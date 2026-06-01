// ─────────────────────────────────────────────────────────────────────────────
// Olly – Unified Step Logger
// Every tool call, shell execution, memory op, and agent step logs through here.
// ─────────────────────────────────────────────────────────────────────────────

import chalk from "chalk";

// ── Spinner frames ────────────────────────────────────────────────────────────
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── Icons & prefixes ──────────────────────────────────────────────────────────
export const Icons = {
  spinner:  "●",
  success:  "✔",
  error:    "✖",
  warning:  "⚠",
  shell:    "✦",
  pipe:     "│",
  tool:     "◆",
  memory:   "◈",
  thinking: "✧",
  plan:     "╰─",
  info:     "ℹ",
  file:     "📄",
} as const;

// ── Log level type ────────────────────────────────────────────────────────────
export type LogLevel = "info" | "success" | "error" | "warning" | "shell" | "tool" | "memory" | "thinking" | "plan" | "pipe";

// ── Spinner handle ────────────────────────────────────────────────────────────
export interface SpinnerHandle {
  update(msg: string): void;
  succeed(msg: string): void;
  fail(msg: string): void;
  stop(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// StepLogger – the main class
// ─────────────────────────────────────────────────────────────────────────────

export class StepLogger {
  private _silent = false;
  private _activeSpinner: ReturnType<typeof setInterval> | null = null;
  private _spinnerLine = "";
  private _spinnerIdx = 0;
  private _spinnerStarted = 0;

  // ── Silence control ──────────────────────────────────────────────────────
  silence(on = true) { this._silent = on; }

  // ── Core raw print ───────────────────────────────────────────────────────
  private _print(line: string) {
    if (this._silent) return;
    // If a spinner is active, erase it first, print the line, then redraw spinner
    if (this._activeSpinner !== null) {
      process.stdout.write("\r\x1b[K");
      console.log(line);
      this._redrawSpinner();
    } else {
      console.log(line);
    }
  }

  // ── Spinner internals ────────────────────────────────────────────────────
  private _redrawSpinner() {
    if (this._activeSpinner === null) return;
    const frame = SPINNER_FRAMES[this._spinnerIdx % SPINNER_FRAMES.length] ?? "⠋";
    const elapsed = Math.floor((Date.now() - this._spinnerStarted) / 1000);
    const suffix = elapsed > 0 ? chalk.dim(` (${elapsed}s)`) : "";
    process.stdout.write(`\r${chalk.cyan(frame)} ${chalk.dim(this._spinnerLine)}${suffix}`);
  }

  // ── Spinner start/stop ───────────────────────────────────────────────────
  spin(message: string): SpinnerHandle {
    this._stopSpinnerTimer();
    this._spinnerLine = message;
    this._spinnerIdx = 0;
    this._spinnerStarted = Date.now();

    this._activeSpinner = setInterval(() => {
      this._spinnerIdx++;
      this._redrawSpinner();
    }, 80);

    this._redrawSpinner();

    const handle: SpinnerHandle = {
      update: (msg: string) => {
        this._spinnerLine = msg;
        this._redrawSpinner();
      },
      succeed: (msg: string) => {
        this._stopSpinnerTimer();
        process.stdout.write("\r\x1b[K");
        this.success(msg);
      },
      fail: (msg: string) => {
        this._stopSpinnerTimer();
        process.stdout.write("\r\x1b[K");
        this.error(msg);
      },
      stop: () => {
        this._stopSpinnerTimer();
        process.stdout.write("\r\x1b[K");
      },
    };

    return handle;
  }

  private _stopSpinnerTimer() {
    if (this._activeSpinner !== null) {
      clearInterval(this._activeSpinner);
      this._activeSpinner = null;
    }
  }

  // ── Typed log methods ────────────────────────────────────────────────────

  /** ● Reading file src/index.ts ... */
  pending(action: string) {
    this._print(`${chalk.cyan(Icons.spinner)} ${chalk.dim(action)}`);
  }

  /** ✔ Read 342 lines from src/index.ts */
  success(message: string) {
    this._print(`${chalk.green(Icons.success)} ${chalk.green(message)}`);
  }

  /** ✖ Error: permission denied */
  error(message: string) {
    this._print(`${chalk.red(Icons.error)} ${chalk.red(message)}`);
  }

  /** ⚠ Warning: package.json not found */
  warning(message: string) {
    this._print(`${chalk.yellow(Icons.warning)} ${chalk.yellow(message)}`);
  }

  /** ✦ Running: npm install express */
  shell(command: string) {
    this._print(`${chalk.blue(Icons.shell)} ${chalk.blue("Running:")} ${chalk.bold(command)}`);
  }

  /** │  > some stdout line */
  pipe(line: string) {
    this._print(`${chalk.dim(Icons.pipe)}  ${chalk.dim(line)}`);
  }

  /** ◆ Tool: read_file called with path=... */
  tool(name: string, args?: string) {
    const argStr = args ? chalk.dim(` → ${args}`) : "";
    this._print(`${chalk.cyan(Icons.tool)} ${chalk.cyan("Tool:")} ${chalk.bold(name)}${argStr}`);
  }

  /** ◈ Memory: Saved "prefers TypeScript" */
  memory(message: string) {
    this._print(`${chalk.magenta(Icons.memory)} ${chalk.magenta("Memory:")} ${message}`);
  }

  /** ✧ Thinking... */
  thinking(message = "Thinking...") {
    this._print(`${chalk.dim(Icons.thinking)} ${chalk.dim.italic(message)}`);
  }

  /** ╰─ Plan step 2/5: Install dependencies */
  plan(message: string) {
    this._print(`${chalk.dim(Icons.plan)} ${chalk.dim(message)}`);
  }

  /** ℹ generic info */
  info(message: string) {
    this._print(`${chalk.blue(Icons.info)} ${message}`);
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const logger = new StepLogger();
