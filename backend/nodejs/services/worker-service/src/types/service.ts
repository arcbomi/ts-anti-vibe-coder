import type { FastifyInstance } from "fastify";

export interface WorkerServiceConfig {
  serviceName: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  analysisQueueName: string;
  analysisDeadLetterQueueName: string;
  workerConcurrency: number;
  maxJobAttempts: number;
  retryDelayMs: number;
  giteaBaseUrl: string;
  giteaBotToken: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTimeoutMs: number;
}

export interface WorkerServiceApp extends FastifyInstance {
  config: WorkerServiceConfig;
  serviceName: string;
  serviceLogger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
}

export interface AnalysisJobMessage {
  jobId: string;
  userId: string;
  repositoryId: string;
  giteaRepoUrl: string;
  branch: string;
  attempt: number;
}

export type AnalysisJobStatus =
  | "pending"
  | "checking_bot_access"
  | "reading_repository"
  | "indexing_code"
  | "analyzing_code"
  | "generating_questions"
  | "saving_questions"
  | "completed"
  | "failed";

export interface RepositoryFile {
  path: string;
  size: number;
  content: string;
}

export interface GeneratedQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string;
  difficulty: string;
  sourceFilePath: string;
}

export interface GiteaTreeNode {
  path: string;
  type: string;
}

export interface QueueRepositoryPort {
  pop(queueName: string, timeoutSeconds: number): Promise<string | null>;
  push(queueName: string, payload: string): Promise<void>;
  stop(): Promise<void>;
}

export interface AnalysisJobRepositoryPort {
  updateAnalysisJobStatus(jobId: string, status: AnalysisJobStatus): Promise<void>;
  failAnalysisJob(jobId: string, errorCode: string, errorMessage: string): Promise<void>;
  completeAnalysisJob(jobId: string): Promise<void>;
  saveGeneratedQuestions(jobId: string, questions: GeneratedQuestion[]): Promise<void>;
}

export interface GiteaRepositoryPort {
  checkAccess(repoUrl: string): Promise<boolean>;
  getRepositoryTree(repoUrl: string, branch: string): Promise<GiteaTreeNode[]>;
  getFileContent(repoUrl: string, filePath: string, branch: string): Promise<string>;
}

export interface AIRepositoryPort {
  generateJson(prompt: string): Promise<string>;
}

export interface AnalysisJobPipelineDependencies {
  config: WorkerServiceConfig;
  logger: WorkerServiceApp["serviceLogger"];
  analysisJobRepository: AnalysisJobRepositoryPort;
  giteaRepository: GiteaRepositoryPort;
  aiRepository: AIRepositoryPort;
}

export interface WorkerRuntimeDependencies {
  config: WorkerServiceConfig;
  logger: WorkerServiceApp["serviceLogger"];
  queueRepository: QueueRepositoryPort;
  analysisJobRepository: AnalysisJobRepositoryPort;
  analysisJobService: {
    process(message: AnalysisJobMessage): Promise<void>;
  };
}

export interface WorkerRuntimeStatus {
  service: string;
  ready: boolean;
  workerConcurrency: number;
  activeWorkers: number;
  queueName: string;
  deadLetterQueueName: string;
  checkedAt: string;
}
