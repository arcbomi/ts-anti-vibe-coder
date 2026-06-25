import type { FastifyInstance } from "fastify";
import type { AnalysisJobRecord, GiteaRepositoryMetadata, GiteaTreeNode, RepositoryRecord, SafeRepositorySnapshot, TomorrowConnection, TomorrowProject } from "../models/gitea.js";

export type GiteaServiceConfig = {
  serviceName: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  gitea: {
    baseUrl: string;
    botToken: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
    queueName: string;
  };
  tomorrow: {
    serviceUrl: string;
    profilePath: string;
  };
  files: {
    maxFileSizeBytes: number;
  };
};

export type AuthenticatedUser = {
  userId: string;
};

export type AuthenticatedRequest = {
  headers: Record<string, unknown>;
  userContext?: AuthenticatedUser;
};

export type GiteaServiceApp = FastifyInstance & {
  config: GiteaServiceConfig;
  serviceLogger: {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
  };
};

export type RepositoryStore = {
  ensureSchema(): Promise<void>;
  createRepository(input: {
    id: string;
    userId: string;
    giteaRepoUrl: string;
    giteaProjectPath: string;
    tomorrowAuditText?: string;
    defaultBranch?: string;
    botAccessStatus?: string;
  }): Promise<RepositoryRecord>;
  listRepositories(userId: string): Promise<RepositoryRecord[]>;
  getRepository(userId: string, repositoryId: string): Promise<RepositoryRecord | null>;
  updateBotAccess(input: {
    userId: string;
    repositoryId: string;
    status: string;
    defaultBranch?: string;
  }): Promise<RepositoryRecord | null>;
  createAnalysisJob(input: {
    id: string;
    userId: string;
    repositoryId: string;
    status: string;
    errorMessage?: string | null;
  }): Promise<AnalysisJobRecord>;
  getAnalysisJob(userId: string, analysisJobId: string): Promise<AnalysisJobRecord | null>;
  failAnalysisJob(userId: string, analysisJobId: string, message: string): Promise<boolean>;
};

export type TomorrowConnectionStore = {
  getTomorrowConnection(userId: string): Promise<TomorrowConnection | null>;
};

export type GiteaApiClient = {
  checkAccess(repoUrl: string): Promise<boolean>;
  getRepository(repoUrl: string): Promise<GiteaRepositoryMetadata>;
  getRepositoryTree(repoUrl: string, branch: string): Promise<GiteaTreeNode[]>;
  getFileContent(repoUrl: string, filePath: string, branch: string): Promise<Buffer>;
};

export type AnalysisQueuePublisher = {
  publishAnalysisJob(input: {
    jobId: string;
    userId: string;
    repositoryId: string;
    giteaRepoUrl: string;
    branch: string;
  }): Promise<void>;
};

export type TomorrowProjectDiscoveryClient = {
  discoverSucceededProjects(input: {
    username: string;
    remoteToken: string;
    profilePath: string;
  }): Promise<TomorrowProject[]>;
};

export type RequestUser = {
  userId: string;
};

export type CreateRepositoryInput = {
  giteaRepoUrl: string;
};

export type ServiceDependencies = {
  repositoryStore: RepositoryStore;
  tomorrowConnectionStore: TomorrowConnectionStore;
  giteaApiClient: GiteaApiClient;
  analysisQueuePublisher: AnalysisQueuePublisher;
  tomorrowProjectDiscoveryClient: TomorrowProjectDiscoveryClient;
  fileFilter: {
    shouldReadPath(filePath: string): boolean;
    shouldReadContent(content: Buffer): boolean;
  };
  config: GiteaServiceConfig;
  logger: GiteaServiceApp["serviceLogger"];
};

export type GiteaDomainService = {
  createRepository(userId: string, input: CreateRepositoryInput): Promise<RepositoryRecord>;
  listRepositories(userId: string): Promise<RepositoryRecord[]>;
  syncTomorrowProjects(userId: string): Promise<RepositoryRecord[]>;
  getRepository(userId: string, repositoryId: string): Promise<RepositoryRecord>;
  checkBotAccess(userId: string, repositoryId: string): Promise<RepositoryRecord>;
  startAnalysis(userId: string, repositoryId: string): Promise<AnalysisJobRecord>;
  getAnalysisJob(userId: string, analysisJobId: string): Promise<AnalysisJobRecord>;
  readSafeRepositoryFiles(userId: string, repositoryId: string): Promise<SafeRepositorySnapshot>;
};
