#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Olly – Post-install: Auto-install Bun if not present
// ─────────────────────────────────────────────────────────────────────────────

const { execSync, spawnSync } = require("child_process");
const os = require("os");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function log(msg) {
  process.stdout.write(`${CYAN}[Olly]${RESET} ${msg}\n`);
}

function warn(msg) {
  process.stdout.write(`${YELLOW}[Olly]${RESET} ${msg}\n`);
}

function success(msg) {
  process.stdout.write(`${GREEN}[Olly]${RESET} ${msg}\n`);
}

// Check if bun is already installed
function isBunInstalled() {
  try {
    const result = spawnSync("bun", ["--version"], {
      stdio: "pipe",
      shell: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

async function installBun() {
  const platform = os.platform();

  log("Bun is required to run Olly. Installing Bun globally...\n");

  try {
    if (platform === "win32") {
      // Windows: use PowerShell
      log("Detected Windows — installing via PowerShell...");
      execSync(
        `powershell -ExecutionPolicy Bypass -Command "irm https://bun.sh/install.ps1 | iex"`,
        { stdio: "inherit", shell: true }
      );
    } else if (platform === "darwin" || platform === "linux") {
      // macOS / Linux: use curl pipe
      log(`Detected ${platform === "darwin" ? "macOS" : "Linux"} — installing via curl...`);
      execSync(`curl -fsSL https://bun.sh/install | bash`, {
        stdio: "inherit",
        shell: true,
      });
    } else {
      warn(`Unsupported platform: ${platform}`);
      warn("Please install Bun manually: https://bun.sh/docs/installation");
      return;
    }

    success(`${BOLD}Bun installed successfully!${RESET}`);
    success("You may need to restart your terminal or add Bun to your PATH.");
    success("Windows users: close and reopen your terminal, or run: refreshenv");
  } catch (err) {
    warn("Automatic Bun installation failed.");
    warn("Please install Bun manually: https://bun.sh/docs/installation");
    warn("  macOS/Linux: curl -fsSL https://bun.sh/install | bash");
    warn('  Windows:     powershell -c "irm https://bun.sh/install.ps1 | iex"');
    // Don't throw — npm install should still succeed
  }
}

async function main() {
  if (isBunInstalled()) {
    try {
      const ver = execSync("bun --version", {
        encoding: "utf8",
        shell: true,
      }).trim();
      success(`Bun v${ver} is already installed. ✓`);
    } catch {
      success("Bun is already installed. ✓");
    }
  } else {
    await installBun();
  }

  log(
    `\n  ${GREEN}${BOLD}Olly is ready!${RESET} Run ${BOLD}olly setup${RESET} to configure your AI provider.`
  );
  log(`  Then run ${BOLD}olly wakeup${RESET} to start.\n`);
}

main().catch(() => {
  // Silently fail — never break npm install
});
