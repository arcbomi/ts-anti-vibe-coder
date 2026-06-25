import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RunLLMInput, ToolProvider } from "./ToolProvider.js";

type MockToolProviderOptions = {
  responses?: Record<string, string>;
  defaultResponse?: string;
};

export class MockToolProvider implements ToolProvider {
  private readonly responses: Record<string, string>;
  private readonly defaultResponse: string;

  constructor(options: MockToolProviderOptions = {}) {
    this.responses = options.responses ?? {};
    this.defaultResponse =
      options.defaultResponse ?? "# Mock output\n\nNo canned response was provided.";
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(filePath, "utf8");
  }

  async listFiles(rootPath: string): Promise<string[]> {
    const results: string[] = [];
    await this.walk(rootPath, results);
    return results.sort();
  }

  async runLLM(input: RunLLMInput): Promise<string> {
    const matchedKey = Object.keys(this.responses).find((key) =>
      input.prompt.includes(key),
    );
    if (matchedKey) {
      return this.responses[matchedKey];
    }
    return `${this.defaultResponse}\n\nSystem:\n${input.system}\n\nPrompt excerpt:\n${input.prompt.slice(0, 500)}`;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  private async walk(currentPath: string, results: string[]): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.walk(fullPath, results);
      } else {
        results.push(fullPath);
      }
    }
  }
}
