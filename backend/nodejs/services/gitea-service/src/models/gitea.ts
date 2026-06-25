export const BOT_ACCESS_STATUS = {
  unknown: "unknown",
  checking: "checking",
  granted: "granted",
  denied: "denied",
  failed: "failed"
} as const;

export const ANALYSIS_JOB_STATUS = {
  pending: "pending"
} as const;

export const ERROR_CODE = {
  invalidRepositoryUrl: "INVALID_REPOSITORY_URL",
  repositoryNotFound: "REPOSITORY_NOT_FOUND",
  analysisJobNotFound: "ANALYSIS_JOB_NOT_FOUND",
  botAccessDenied: "BOT_ACCESS_DENIED",
  giteaApiError: "GITEA_API_ERROR",
  queuePublishFailed: "QUEUE_PUBLISH_FAILED",
  tomorrowNotConnected: "TOMORROW_NOT_CONNECTED",
  tomorrowSyncFailed: "TOMORROW_SYNC_FAILED",
  unauthorized: "UNAUTHORIZED",
  configuration: "CONFIGURATION_ERROR",
  internal: "INTERNAL_ERROR"
} as const;

export type BotAccessStatus = (typeof BOT_ACCESS_STATUS)[keyof typeof BOT_ACCESS_STATUS];
export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUS)[keyof typeof ANALYSIS_JOB_STATUS] | "completed" | "failed";

export type RepositoryRecord = {
  id: string;
  userId: string;
  giteaRepoUrl: string;
  giteaProjectPath: string;
  tomorrowAuditText: string;
  defaultBranch: string;
  botAccessStatus: BotAccessStatus;
  latestAnalysisJobId: string | null;
  latestAnalysisStatus: string | null;
  latestAnalysisErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisJobRecord = {
  id: string;
  userId: string;
  repositoryId: string;
  status: AnalysisJobStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type SafeRepositoryFile = {
  path: string;
  size: number;
  content: string;
};

export type SafeRepositorySnapshot = {
  repositoryId: string;
  branch: string;
  files: SafeRepositoryFile[];
};

export type NormalizedRepository = {
  url: string;
  projectPath: string;
  baseUrl: string;
};

export type GiteaRepositoryMetadata = {
  defaultBranch: string;
};

export type GiteaTreeNode = {
  path: string;
  type: string;
  mode?: string;
  id?: string;
  name?: string;
};

export type TomorrowConnection = {
  username: string;
  remoteToken: string;
  profilePath: string;
};

export type TomorrowProject = {
  repoUrl: string;
  auditText: string;
  isSucceeded: boolean;
};
