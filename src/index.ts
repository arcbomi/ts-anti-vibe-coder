import "dotenv/config";

import { loadWorkflowInput } from "./input/WorkflowInput.js";
import { runWorkflow } from "./pipeline/runWorkflow.js";
import { createStages } from "./pipeline/stages.js";
import { LLMToolProvider } from "./tools/LLMToolProvider.js";
import { MockToolProvider } from "./tools/MockToolProvider.js";
import type { ToolProvider } from "./tools/ToolProvider.js";

async function main(): Promise<void> {
  const input = await loadWorkflowInput();
  const tools = createToolProvider();
  const stages = createStages();

  console.log("Starting workflow runner");
  console.log(`Repository: ${input.repoPath}`);
  console.log(`Generate final questions: ${input.generateFinalQuestions === true}`);
  console.log(`Output directory: ${input.outputDir ?? "(disabled)"}`);

  const context = await runWorkflow(input, tools, stages);

  console.log("\nWorkflow complete");
  console.log(`Completed stages: ${context.stageOrder.join(", ")}`);
}

function createToolProvider(): ToolProvider {
  const provider = (process.env.TOOL_PROVIDER ?? "llm").toLowerCase();

  if (provider === "mock") {
    return new MockToolProvider();
  }

  const baseUrl =
    process.env.LLM_BASE_URL ??
    "https://restless-sound-b427.arcbomi.workers.dev";
  const model =
    process.env.MODEL ?? "@cf/qwen/qwen2.5-coder-32b-instruct";

  return new LLMToolProvider({
    baseUrl,
    model,
    apiKey: process.env.LLM_API_KEY,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
