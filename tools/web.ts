// ─────────────────────────────────────────────────────────────────────────────
// Olly – Web & Network Tools (tools/web.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { tool } from "ai";
import { z } from "zod";
import fsp from "node:fs/promises";
import path from "node:path";
import { logger } from "../tui/stepLogger";

// ── Simple HTML-to-text stripper ──────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clip(s: string, n = 12000): string {
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

// ── Firecrawl client (lazy) ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firecrawlClient: any = null;

async function getFirecrawl() {
  if (firecrawlClient) return firecrawlClient;
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    firecrawlClient = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    return firecrawlClient;
  } catch {
    return null;
  }
}

// ── DuckDuckGo fallback search ────────────────────────────────────────────────
async function duckDuckGoSearch(query: string, numResults: number): Promise<string> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OllyBot/1.0)" },
    });
    const html = await resp.text();

    // Extract result snippets from DDG HTML
    const results: string[] = [];
    const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const hrefs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = resultRegex.exec(html)) !== null) {
      hrefs.push(m[1] ?? "");
    }

    const snippets: string[] = [];
    let s: RegExpExecArray | null;
    while ((s = snippetRegex.exec(html)) !== null) {
      snippets.push(htmlToText(s[1] ?? ""));
    }

    for (let i = 0; i < Math.min(numResults, hrefs.length); i++) {
      results.push(`${i + 1}. ${hrefs[i] ?? ""}\n   ${snippets[i] ?? ""}`);
    }

    return results.join("\n\n") || "(no results)";
  } catch (err) {
    return `(search failed: ${err instanceof Error ? err.message : String(err)})`;
  }
}

// ── Tool: web_fetch ───────────────────────────────────────────────────────────

export const web_fetch = tool({
  description: "Fetch a URL and extract its content as text, links, html, or json.",
  inputSchema: z.object({
    url: z.string().url(),
    extract: z.enum(["text", "links", "html", "json"]).optional().default("text"),
  }),
  execute: async ({ url, extract }) => {
    logger.tool("web_fetch", url);
    logger.pending(`Fetching ${url}...`);

    // Try Firecrawl first for text extraction
    if (extract === "text") {
      const fc = await getFirecrawl();
      if (fc) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const doc = await fc.scrape(url, { formats: ["markdown"] }) as { markdown?: string };
          const md = doc.markdown ?? "";
          logger.success(`Fetched ${url} via Firecrawl (${md.length} chars)`);
          return clip(md);
        } catch { /* fall through to fetch */ }
      }
    }

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OllyBot/1.0)" },
        redirect: "follow",
      });
      const body = await resp.text();

      logger.success(`Fetched ${url} (HTTP ${resp.status}, ${body.length} chars)`);

      switch (extract) {
        case "json": {
          try {
            return JSON.stringify(JSON.parse(body), null, 2);
          } catch {
            return `HTTP ${resp.status}\n\n${clip(body)}`;
          }
        }
        case "html":
          return clip(`HTTP ${resp.status}\n\n${body}`);
        case "links": {
          const links: string[] = [];
          const linkRe = /href="([^"]+)"/g;
          let lm: RegExpExecArray | null;
          while ((lm = linkRe.exec(body)) !== null) {
            const href = lm[1] ?? "";
            if (href.startsWith("http")) links.push(href);
          }
          return [...new Set(links)].slice(0, 50).join("\n") || "(no links)";
        }
        default:
          return clip(htmlToText(body));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to fetch ${url}: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Tool: web_search ──────────────────────────────────────────────────────────

export const web_search = tool({
  description: "Search the web using Firecrawl (if configured) or DuckDuckGo fallback.",
  inputSchema: z.object({
    query: z.string().min(1),
    num_results: z.number().int().min(1).max(10).optional().default(5),
  }),
  execute: async ({ query, num_results }) => {
    logger.tool("web_search", query);
    logger.pending(`Searching: '${query}'...`);

    const fc = await getFirecrawl();
    if (fc) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const res = await fc.search(query, { limit: num_results, sources: ["web"] }) as {
          web?: { title?: string; url?: string; snippet?: string }[];
        };
        const items = (res.web ?? []).slice(0, num_results);
        const out = items
          .map((d, i) => `${i + 1}. ${d.title ?? "(untitled)"}\n   ${d.url ?? ""}\n   ${d.snippet ?? ""}`)
          .join("\n\n") || "(no results)";
        logger.success(`Found ${items.length} results for '${query}'`);
        return clip(out);
      } catch { /* fall through */ }
    }

    logger.info("Using DuckDuckGo fallback search...");
    const out = await duckDuckGoSearch(query, num_results ?? 5);
    logger.success(`Search complete for '${query}'`);
    return clip(out);
  },
});

// ── Tool: download_file ───────────────────────────────────────────────────────

export const download_file = tool({
  description: "Download a file from a URL to a local path. Shows progress.",
  inputSchema: z.object({
    url: z.string().url(),
    dest_path: z.string(),
  }),
  execute: async ({ url, dest_path }) => {
    logger.tool("download_file", `${url} → ${dest_path}`);
    logger.pending(`Downloading ${url}...`);

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OllyBot/1.0)" },
        redirect: "follow",
      });

      if (!resp.ok) {
        logger.error(`Download failed: HTTP ${resp.status}`);
        return `Error: HTTP ${resp.status}`;
      }

      const contentLength = resp.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

      const abs = path.resolve(dest_path);
      await fsp.mkdir(path.dirname(abs), { recursive: true });

      const buffer = await resp.arrayBuffer();
      await fsp.writeFile(abs, Buffer.from(buffer));

      const size = buffer.byteLength;
      logger.success(`Downloaded ${url} → ${dest_path} (${(size / 1024).toFixed(1)}KB${totalBytes ? ` of ${(totalBytes / 1024).toFixed(1)}KB` : ""})`);
      return `Downloaded to ${dest_path} (${(size / 1024).toFixed(1)}KB)`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Download failed: ${msg}`);
      return `Error: ${msg}`;
    }
  },
});

// ── Export all ────────────────────────────────────────────────────────────────

export const webTools = {
  web_fetch,
  web_search,
  download_file,
};
