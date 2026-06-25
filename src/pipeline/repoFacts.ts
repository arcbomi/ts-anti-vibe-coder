import path from "node:path";

import type { ToolProvider } from "../tools/ToolProvider.js";

export type RepoSymbol = {
  file: string;
  symbol: string;
  snippet: string;
};

export type RepoFacts = {
  files: string[];
  symbols: RepoSymbol[];
};

const INCLUDED_EXTENSIONS = new Set([".go", ".html"]);
const MAX_SNIPPET_CHARS = 1800;

export async function buildRepoFacts(
  tools: ToolProvider,
  repoPath: string,
): Promise<RepoFacts> {
  const files = (await tools.listFiles(repoPath))
    .filter((filePath) => shouldIncludeFile(filePath))
    .map((filePath) => path.relative(repoPath, filePath))
    .sort();

  const symbols: RepoSymbol[] = [];

  for (const relativeFile of files) {
    const absolutePath = path.join(repoPath, relativeFile);
    const ext = path.extname(relativeFile).toLowerCase();
    const content = await tools.readFile(absolutePath);

    if (ext === ".go") {
      symbols.push(...extractGoSymbols(relativeFile, content));
    } else if (ext === ".html") {
      symbols.push({
        file: relativeFile,
        symbol: "top-level template",
        snippet: clipText(content.trim(), MAX_SNIPPET_CHARS),
      });
    }
  }

  return { files, symbols };
}

export function formatRepoFactsMarkdown(repoFacts: RepoFacts): string {
  const fileLines = repoFacts.files.map((file) => `- ${file}`);
  const symbolBlocks = repoFacts.symbols.map((symbol) =>
    [
      `File: ${symbol.file}`,
      `Symbol: ${symbol.symbol}`,
      "```",
      symbol.snippet,
      "```",
    ].join("\n"),
  );

  return [
    "# Repository Facts",
    "",
    "## Files",
    ...fileLines,
    "",
    "## Symbols",
    ...symbolBlocks,
  ].join("\n");
}

function extractGoSymbols(file: string, content: string): RepoSymbol[] {
  const matches = [...content.matchAll(/^func\s+([A-Za-z0-9_]+)\s*\(/gm)];
  const symbols: RepoSymbol[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? content.length;
    const symbolName = current[1];
    const snippet = clipText(content.slice(start, end).trim(), MAX_SNIPPET_CHARS);

    symbols.push({
      file,
      symbol: symbolName,
      snippet,
    });
  }

  return symbols;
}

function shouldIncludeFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  const extension = path.extname(normalized).toLowerCase();

  if (!INCLUDED_EXTENSIONS.has(extension)) {
    return false;
  }

  if (
    normalized.includes("/node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/outputs/") ||
    normalized.includes("/src/") ||
    normalized.includes("/.git/")
  ) {
    return false;
  }

  return (
    normalized.includes("/internal/") ||
    normalized.endsWith("/cmd/server/main.go") ||
    normalized.includes("/templates/")
  );
}

function clipText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...<truncated>`;
}
