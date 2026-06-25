import type { WorkflowInput } from "../input/WorkflowInput.js";
import type { ToolProvider } from "../tools/ToolProvider.js";

export type WorkflowContext = {
  outputs: Record<string, string>;
  parsedOutputs: Record<string, unknown>;
  stageOrder: string[];
};

export type PromptBuilderArgs = {
  input: WorkflowInput;
  context: WorkflowContext;
  tools: ToolProvider;
};

export type WorkflowStage = {
  id: string;
  name: string;
  system: string;
  outputFileName: string;
  buildPrompt?: (args: PromptBuilderArgs) => Promise<string>;
  run?: (args: PromptBuilderArgs) => Promise<string>;
  parseOutput?: (raw: string) => unknown;
  enabled?: (input: WorkflowInput) => boolean;
  temperature?: number;
  maxTokens?: number;
};

export type StagePromptDefinition = {
  system: string;
  outputFileName: string;
  template: (args: PromptBuilderArgs) => Promise<string>;
  temperature?: number;
  maxTokens?: number;
};
