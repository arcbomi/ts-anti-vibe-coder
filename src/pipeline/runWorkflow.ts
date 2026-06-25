import { saveStageOutput } from "../output/saveOutput.js";
import type { WorkflowInput } from "../input/WorkflowInput.js";
import type { ToolProvider } from "../tools/ToolProvider.js";
import type { WorkflowContext, WorkflowStage } from "./types.js";

export async function runWorkflow(
  input: WorkflowInput,
  tools: ToolProvider,
  stages: WorkflowStage[],
): Promise<WorkflowContext> {
  const context: WorkflowContext = {
    outputs: toStringRecord(input.previousStageOutputs),
    parsedOutputs: input.previousStageOutputs ?? {},
    stageOrder: [],
  };

  for (const [index, stage] of stages.entries()) {
    if (stage.enabled && !stage.enabled(input)) {
      console.log(`Skipping stage ${stage.id}`);
      continue;
    }

    console.log(`\n[${index + 1}/${stages.length}] Running ${stage.name}`);

    try {
      const args = { input, context, tools };
      const rawOutput = stage.run
        ? await stage.run(args)
        : await runLLMStage(stage, args, tools);

      context.outputs[stage.id] = rawOutput;
      context.parsedOutputs[stage.id] = stage.parseOutput
        ? stage.parseOutput(rawOutput)
        : rawOutput;
      context.stageOrder.push(stage.id);

      if (input.outputDir) {
        const savedTo = await saveStageOutput({
          baseDir: input.outputDir,
          stage,
          stageIndex: index,
          content: rawOutput,
          tools,
        });
        console.log(`Saved ${stage.id} output to ${savedTo}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Stage ${stage.id} failed: ${message}`);
      throw error;
    }
  }

  return context;
}

async function runLLMStage(
  stage: WorkflowStage,
  args: { input: WorkflowInput; context: WorkflowContext; tools: ToolProvider },
  tools: ToolProvider,
): Promise<string> {
  if (!stage.buildPrompt) {
    throw new Error(`Stage ${stage.id} is missing both run and buildPrompt.`);
  }

  const prompt = await stage.buildPrompt(args);
  return await tools.runLLM({
    system: stage.system,
    prompt,
    temperature: stage.temperature,
    maxTokens: stage.maxTokens,
  });
}

function toStringRecord(
  value: Record<string, unknown> | undefined,
): Record<string, string> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, stringifyUnknown(item)]),
  );
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
