import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type {
  AnalysisJobRecord as HttpAnalysisJobRecord,
  CreateRepositoryRequest,
  GiteaServiceConfig,
  GiteaServicePort,
  RepositoryRecord as HttpRepositoryRecord,
  ServiceLogger,
  StartAnalysisResponse
} from "../config/types.js";
import type {
  AnalysisJobRecord,
  RepositoryRecord
} from "../models/gitea.js";
import { GiteaService } from "./giteaService.js";

type RuntimeRepositoryBundle = ConstructorParameters<typeof GiteaService>[0];

function mapRepository(record: RepositoryRecord): HttpRepositoryRecord {
  return {
    id: record.id,
    repository_id: record.id,
    gitea_repo_url: record.giteaRepoUrl,
    gitea_project_path: record.giteaProjectPath,
    tomorrow_audit_text: record.tomorrowAuditText,
    default_branch: record.defaultBranch,
    bot_access_status: record.botAccessStatus,
    latest_analysis_job_id: record.latestAnalysisJobId,
    latest_analysis_status: record.latestAnalysisStatus,
    latest_analysis_error_message: record.latestAnalysisErrorMessage,
    latest_analysis_job: record.latestAnalysisJobId ? { id: record.latestAnalysisJobId } : null,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function mapAnalysisJob(record: AnalysisJobRecord): HttpAnalysisJobRecord {
  return {
    id: record.id,
    analysis_job_id: record.id,
    repository_id: record.repositoryId,
    repositoryId: record.repositoryId,
    status: record.status,
    error_message: record.errorMessage,
    errorMessage: record.errorMessage,
    created_at: record.createdAt,
    createdAt: record.createdAt,
    completed_at: record.completedAt,
    completedAt: record.completedAt
  };
}

class GiteaHttpServiceAdapter implements GiteaServicePort {
  private readonly domainService: GiteaService;

  constructor(domainService: GiteaService) {
    this.domainService = domainService;
  }

  async createRepository(userId: string, payload: CreateRepositoryRequest) {
    const repository = await this.domainService.createRepository(userId, {
      giteaRepoUrl: payload.gitea_repo_url
    });
    return mapRepository(repository);
  }

  async listRepositories(userId: string) {
    return (await this.domainService.listRepositories(userId)).map(mapRepository);
  }

  async syncTomorrowProjects(userId: string) {
    return (await this.domainService.syncTomorrowProjects(userId)).map(mapRepository);
  }

  async getRepository(userId: string, repositoryId: string) {
    return mapRepository(await this.domainService.getRepository(userId, repositoryId));
  }

  async checkBotAccess(userId: string, repositoryId: string) {
    return mapRepository(await this.domainService.checkBotAccess(userId, repositoryId));
  }

  async startAnalysis(userId: string, repositoryId: string): Promise<StartAnalysisResponse> {
    const job = await this.domainService.startAnalysis(userId, repositoryId);
    return {
      id: job.id,
      analysis_job_id: job.id,
      status: job.status
    };
  }

  async getAnalysisJob(userId: string, analysisJobId: string) {
    return mapAnalysisJob(await this.domainService.getAnalysisJob(userId, analysisJobId));
  }
}

function adaptConfig(config: GiteaServiceConfig) {
  return {
    serviceName: config.serviceName,
    port: config.port,
    databaseUrl: config.repository.databaseUrl,
    jwtSecret: "",
    gitea: {
      baseUrl: config.gitea.baseUrl,
      botToken: config.gitea.botToken
    },
    redis: {
      host: "127.0.0.1",
      port: 6379,
      password: "",
      db: 0,
      queueName: "analysis_jobs"
    },
    tomorrow: {
      serviceUrl: config.tomorrow.serviceUrl,
      profilePath: config.tomorrow.defaultProfilePath
    },
    files: {
      maxFileSizeBytes: 204800
    }
  };
}

export function createGiteaService(
  repository: RuntimeRepositoryBundle,
  config: GiteaServiceConfig,
  logger: ServiceLogger
) {
  if (!repository || typeof repository !== "object") {
    throw new AppError("Repository runtime bundle is required.", {
      statusCode: 500,
      code: "SERVICE_BOOTSTRAP_ERROR"
    });
  }

  const domainService = new GiteaService({
    ...repository,
    config: adaptConfig(config),
    logger
  });

  return new GiteaHttpServiceAdapter(domainService);
}

export function buildGiteaServiceDomain({
  repository,
  config,
  logger
}: {
  repository: RuntimeRepositoryBundle;
  config: GiteaServiceConfig;
  logger: ServiceLogger;
}) {
  return createGiteaService(repository, config, logger);
}

export { GiteaService } from "./giteaService.js";
