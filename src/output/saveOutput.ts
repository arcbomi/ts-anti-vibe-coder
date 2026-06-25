import path from "node:path";

import type { WorkflowStage } from "../pipeline/types.js";
import type { ToolProvider } from "../tools/ToolProvider.js";

type SaveStageOutputInput = {
  baseDir: string;
  stage: WorkflowStage;
  stageIndex: number;
  content: string;
  tools: ToolProvider;
};

export async function saveStageOutput(input: SaveStageOutputInput): Promise<string> {
  const fileName =
    input.stage.id === "final-questions"
      ? "final-questions.md"
      : `${String(input.stageIndex + 1).padStart(2, "0")}-${input.stage.outputFileName}`;

  const outputPath = path.join(input.baseDir, fileName);
  await input.tools.writeFile(outputPath, input.content);
  return outputPath;
}
