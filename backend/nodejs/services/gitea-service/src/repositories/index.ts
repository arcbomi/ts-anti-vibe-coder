import { randomUUID } from "node:crypto";
import { BOT_ACCESS_STATUS, type AnalysisJobRecord, type RepositoryRecord, type TomorrowConnection } from "../models/gitea.js";
import type { GiteaServiceConfig, ServiceLogger } from "../config/types.js";
import { RedisAnalysisQueuePublisher } from "../services/analysisQueuePublisher.js";
import { GiteaApiClient } from "../services/giteaApiClient.js";
import { TomorrowProjectDiscoveryClient } from "../services/tomorrowProjectDiscoveryClient.js";
import { FileFilter } from "../utils/fileFilter.js";
import { firstNonEmpty } from "../utils/strings.js";
import { PostgresGiteaRepository } from "./giteaRepository.js";
import { PostgresTomorrowConnectionRepository } from "./tomorrowConnectionRepository.js";
import type {
  AnalysisQueuePublisher,
  GiteaApiClient as GiteaApiClientContract,
  RepositoryStore,
  TomorrowConnectionStore,
  TomorrowProjectDiscoveryClient as TomorrowProjectDiscoveryClientContract
} from "../types/service.js";

type RuntimeRepositoryBundle = {
  repositoryStore: RepositoryStore;
  tomorrowConnectionStore: TomorrowConnectionStore;
  giteaApiClient: GiteaApiClientContract;
  analysisQueuePublisher: AnalysisQueuePublisher;
  tomorrowProjectDiscoveryClient: TomorrowProjectDiscoveryClientContract;
  fileFilter: FileFilter;
};

function nowIso() {
  return new Date().toISOString();
}

function parseRedisAddress(rawAddress: string | undefined) {
  const value = String(rawAddress ?? "127.0.0.1:6379").trim();
  const [host = "127.0.0.1", port = "6379"] = value.split(":");
  const parsedPort = Number(port);
  return {
    host: host.trim() || "127.0.0.1",
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 6379
  };
}

class InMemoryGiteaRepository implements RepositoryStore {
  repositories = new Map<string, RepositoryRecord>();
  analysisJobs = new Map<string, AnalysisJobRecord>();

  async ensureSchema() {}

  async createRepository(input: {
    id: string;
    userId: string;
    giteaRepoUrl: string;
    giteaProjectPath: string;
    tomorrowAuditText?: string;
    defaultBranch?: string;
    botAccessStatus?: string;
  }) {
    const existing = [...this.repositories.values()].find(
      (repository) =>
        repository.userId === input.userId && repository.giteaProjectPath === input.giteaProjectPath
    );

    const record: RepositoryRecord = {
      id: existing?.id ?? input.id ?? randomUUID(),
      userId: input.userId,
      giteaRepoUrl: input.giteaRepoUrl,
      giteaProjectPath: input.giteaProjectPath,
      tomorrowAuditText: input.tomorrowAuditText ?? "",
      defaultBranch: existing?.defaultBranch ?? input.defaultBranch ?? "main",
      botAccessStatus: (input.botAccessStatus ?? BOT_ACCESS_STATUS.unknown) as RepositoryRecord["botAccessStatus"],
      latestAnalysisJobId: existing?.latestAnalysisJobId ?? null,
      latestAnalysisStatus: existing?.latestAnalysisStatus ?? null,
      latestAnalysisErrorMessage: existing?.latestAnalysisErrorMessage ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso()
    };

    this.repositories.set(record.id, record);
    return record;
  }

  async listRepositories(userId: string) {
    return [...this.repositories.values()]
      .filter((repository) => repository.userId === userId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getRepository(userId: string, repositoryId: string) {
    const repository = this.repositories.get(repositoryId);
    return repository && repository.userId === userId ? repository : null;
  }

  async updateBotAccess(input: {
    userId: string;
    repositoryId: string;
    status: string;
    defaultBranch?: string;
  }) {
    const repository = await this.getRepository(input.userId, input.repositoryId);
    if (!repository) {
      return null;
    }

    const updated: RepositoryRecord = {
      ...repository,
      botAccessStatus: input.status as RepositoryRecord["botAccessStatus"],
      defaultBranch: input.defaultBranch?.trim() || repository.defaultBranch,
      updatedAt: nowIso()
    };
    this.repositories.set(updated.id, updated);
    return updated;
  }

  async createAnalysisJob(input: {
    id: string;
    userId: string;
    repositoryId: string;
    status: string;
    errorMessage?: string | null;
  }) {
    const job: AnalysisJobRecord = {
      id: input.id,
      userId: input.userId,
      repositoryId: input.repositoryId,
      status: input.status as AnalysisJobRecord["status"],
      errorMessage: input.errorMessage ?? null,
      createdAt: nowIso(),
      completedAt: null
    };
    this.analysisJobs.set(job.id, job);

    const repository = this.repositories.get(input.repositoryId);
    if (repository) {
      this.repositories.set(repository.id, {
        ...repository,
        latestAnalysisJobId: job.id,
        latestAnalysisStatus: job.status,
        latestAnalysisErrorMessage: job.errorMessage,
        updatedAt: nowIso()
      });
    }

    return job;
  }

  async getAnalysisJob(userId: string, analysisJobId: string) {
    const job = this.analysisJobs.get(analysisJobId);
    return job && job.userId === userId ? job : null;
  }

  async failAnalysisJob(userId: string, analysisJobId: string, message: string) {
    const job = await this.getAnalysisJob(userId, analysisJobId);
    if (!job) {
      return false;
    }

    const failedJob: AnalysisJobRecord = {
      ...job,
      status: "failed",
      errorMessage: message,
      completedAt: nowIso()
    };
    this.analysisJobs.set(failedJob.id, failedJob);

    const repository = this.repositories.get(failedJob.repositoryId);
    if (repository) {
      this.repositories.set(repository.id, {
        ...repository,
        latestAnalysisJobId: failedJob.id,
        latestAnalysisStatus: failedJob.status,
        latestAnalysisErrorMessage: failedJob.errorMessage,
        updatedAt: nowIso()
      });
    }

    return true;
  }
}

class InMemoryTomorrowConnectionRepository implements TomorrowConnectionStore {
  connections = new Map<string, TomorrowConnection>();

  async getTomorrowConnection(userId: string) {
    return this.connections.get(userId) ?? null;
  }
}

export function createGiteaRepository(config: GiteaServiceConfig, _logger?: ServiceLogger): RuntimeRepositoryBundle {
  const driver = config.repository.driver;
  const repositoryStore =
    driver === "database" && config.repository.databaseUrl
      ? new PostgresGiteaRepository(config.repository.databaseUrl)
      : new InMemoryGiteaRepository();

  const tomorrowConnectionStore =
    driver === "database" && config.repository.databaseUrl
      ? new PostgresTomorrowConnectionRepository(config.repository.databaseUrl)
      : new InMemoryTomorrowConnectionRepository();

  const redisAddress = parseRedisAddress(process.env.REDIS_ADDR);

  return {
    repositoryStore,
    tomorrowConnectionStore,
    giteaApiClient: new GiteaApiClient({
      baseUrl: config.gitea.baseUrl,
      botToken: config.gitea.botToken
    }),
    analysisQueuePublisher: new RedisAnalysisQueuePublisher({
      host: redisAddress.host,
      port: redisAddress.port,
      password: String(process.env.REDIS_PASSWORD ?? "").trim(),
      db: Number(process.env.REDIS_DB ?? 0) || 0,
      queueName: firstNonEmpty(process.env.ANALYSIS_QUEUE_NAME, "analysis_jobs")
    }),
    tomorrowProjectDiscoveryClient: new TomorrowProjectDiscoveryClient(config.tomorrow.serviceUrl),
    fileFilter: new FileFilter()
  };
}

export async function buildGiteaRepository({
  config,
  logger
}: {
  config: GiteaServiceConfig;
  logger: ServiceLogger;
}) {
  const bundle = createGiteaRepository(config, logger);
  await bundle.repositoryStore.ensureSchema();
  return bundle;
}

export { PostgresGiteaRepository } from "./giteaRepository.js";
export { PostgresTomorrowConnectionRepository } from "./tomorrowConnectionRepository.js";
