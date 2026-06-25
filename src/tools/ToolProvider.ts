export type RunLLMInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export interface ToolProvider {
  readFile(path: string): Promise<string>;
  listFiles(path: string): Promise<string[]>;
  runLLM(input: RunLLMInput): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}
