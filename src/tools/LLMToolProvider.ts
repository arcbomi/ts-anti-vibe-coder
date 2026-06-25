import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RunLLMInput, ToolProvider } from "./ToolProvider.js";

type LLMToolProviderOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export class LLMToolProvider implements ToolProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LLMToolProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.runLLMOnce(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message.toLowerCase();
        const shouldRetry =
          attempt < 2 &&
          (message.includes("timeout") || message.includes("504") || message.includes("3046"));

        if (!shouldRetry) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("LLM request failed");
  }

  private async runLLMOnce(input: RunLLMInput): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 2000,
      }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`LLM request failed (${response.status}): ${rawText}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`LLM returned non-JSON content: ${rawText}`);
    }

    const content = this.extractContent(parsed);
    if (!content) {
      throw new Error(`LLM response did not include assistant content: ${rawText}`);
    }

    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  private extractContent(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const maybeChoices = (payload as { choices?: Array<{
      message?: { content?: string };
      delta?: { content?: string };
    }> }).choices;

    if (Array.isArray(maybeChoices)) {
      const firstChoice = maybeChoices[0];
      if (firstChoice?.message?.content) {
        return firstChoice.message.content;
      }
      if (firstChoice?.delta?.content) {
        return firstChoice.delta.content;
      }
    }

    const maybeResponse = (payload as { response?: string }).response;
    if (typeof maybeResponse === "string") {
      return maybeResponse;
    }

    return null;
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
