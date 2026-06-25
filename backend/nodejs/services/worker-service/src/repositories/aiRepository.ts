import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type { WorkerServiceConfig } from "../types/service.ts";

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class AIRepository {
  constructor(private readonly config: WorkerServiceConfig) {}

  async generateJson(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.aiTimeoutMs);

    try {
      const response = await fetch(`${this.config.aiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.aiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.aiModel,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AppError(`AI request failed with status ${response.status}.`, {
          code: response.status >= 500 ? "AI_TIMEOUT" : "AI_OUTPUT_INVALID",
          statusCode: response.status
        });
      }

      const payload = (await response.json()) as OpenAIResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        throw new AppError("AI response did not include JSON content.", {
          code: "AI_OUTPUT_INVALID"
        });
      }

      return content;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("AI request failed.", {
        code: "AI_TIMEOUT",
        cause: error
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
