import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";

let ready = false;

function ensureMarked(): void {
  if (ready) return;

  const w = Math.max(40, Math.min(process.stdout.columns || 80, 120));
  marked.use(
    markedTerminal({
      width: w,
      reflowText: true,
      showSectionPrefix: false,
      tab: 2,
      emoji: true,
      heading: (s: string) => `\n${chalk.hex("#7dd3fc").bold(s)}\n`,
      firstHeading: (s: string) =>
        `\n${chalk.bgHex("#0f172a").hex("#f8fafc").bold(`  ${s}  `)}\n`,
      paragraph: (s: string) => chalk.hex("#e5e7eb")(s),
      strong: (s: string) => chalk.hex("#fde68a").bold(s),
      em: (s: string) => chalk.hex("#93c5fd").italic(s),
      code: (s: string) => chalk.hex("#fbbf24")(s),
      codespan: (s: string) => chalk.bgHex("#1f2937").hex("#fcd34d")(` ${s} `),
      blockquote: (s: string) => chalk.hex("#94a3b8")(`▌ ${s}`),
      listitem: (s: string) => chalk.hex("#d1d5db")(s),
      list: (body: string, ordered?: boolean) => {
        if (ordered) return body;
        return body
          .split("\n")
          .map((line) =>
            line.trim().startsWith("*") ? line.replace("*", "•") : line,
          )
          .join("\n");
      },
      link: (s: string) => chalk.hex("#60a5fa").underline(s),
      href: (s: string) => chalk.hex("#93c5fd")(s),
      table: (s: string) => chalk.hex("#cbd5e1")(s),
      hr: () => chalk.hex("#334155")("-".repeat(Math.max(20, w - 8))),
      html: (s: string) => chalk.hex("#9ca3af")(s),
      text: (s: string) => chalk.hex("#e5e7eb")(s),
    }) as any,
  );
  ready = true;
}

export function renderTerminalMarkdown(source: string) {
  ensureMarked();
  return marked.parse(source.trimEnd(), { async: false });
}
