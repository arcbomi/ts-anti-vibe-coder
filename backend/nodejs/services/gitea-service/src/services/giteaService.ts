import { randomUUID } from "node:crypto";
import { AppError } from "@backend/microservice-sdk";
import { ANALYSIS_JOB_STATUS, BOT_ACCESS_STATUS, ERROR_CODE, type AnalysisJobRecord, type RepositoryRecord, type SafeRepositorySnapshot } from "../models/gitea.js";
import { normalizeRepositoryUrl } from "../utils/repositoryUrl.js";
import { firstNonEmpty } from "../utils/strings.js";
import { isUuid } from "../utils/uuid.js";
import type { GiteaDomainService, ServiceDependencies } from "../types/service.js";

export class GiteaService implements GiteaDomainService {
  repositoryStore: ServiceDependencies["repositoryStore"];
  tomorrowConnectionStore: ServiceDependencies["tomorrowConnectionStore"];
  giteaApiClient: ServiceDependencies["giteaApiClient"];
  analysisQueuePublisher: ServiceDependencies["analysisQueuePublisher"];
  tomorrowProjectDiscoveryClient: ServiceDependencies["tomorrowProjectDiscoveryClient"];
  fileFilter: ServiceDependencies["fileFilter"];
  config: ServiceDependencies["config"];
  logger: ServiceDependencies["logger"];

  constructor(dependencies: ServiceDependencies) {
    this.repositoryStore = dependencies.repositoryStore;
    this.tomorrowConnectionStore = dependencies.tomorrowConnectionStore;
    this.giteaApiClient = dependencies.giteaApiClient;
    this.analysisQueuePublisher = dependencies.analysisQueuePublisher;
    this.tomorrowProjectDiscoveryClient = dependencies.tomorrowProjectDiscoveryClient;
    this.fileFilter = dependencies.fileFilter;
    this.config = dependencies.config;
    this.logger = dependencies.logger;
  }

  async createRepository(userId: string, input: { giteaRepoUrl: string }) {
    this.ensureUserId(userId);
    const normalized = normalizeRepositoryUrl(input.giteaRepoUrl, this.config.gitea.baseUrl);
    return this.repositoryStore.createRepository({
      id: randomUUID(),
      userId,
      giteaRepoUrl: normalized.url,
      giteaProjectPath: normalized.projectPath,
      defaultBranch: "main",
      botAccessStatus: BOT_ACCESS_STATUS.unknown
    });
  }

  async listRepositories(userId: string) {
    this.ensureUserId(userId);
    return this.repositoryStore.listRepositories(userId);
  }

  async syncTomorrowProjects(userId: string) {
    this.ensureUserId(userId);
    let connection;
    try {
      connection = await this.tomorrowConnectionStore.getTomorrowConnection(userId);
    } catch (error) {
      throw new AppError("Unable to read Tomorrow account connection.", {
        statusCode: 500,
        code: ERROR_CODE.internal,
        cause: error
      });
    }

    if (!connection || !connection.remoteToken.trim() || !connection.username.trim()) {
      throw new AppError("Your Tomorrow account is not connected.", {
        statusCode: 409,
        code: ERROR_CODE.tomorrowNotConnected
      });
    }

    let projects;
    try {
      projects = await this.tomorrowProjectDiscoveryClient.discoverSucceededProjects({
        username: connection.username.trim(),
        remoteToken: connection.remoteToken.trim(),
        profilePath: firstNonEmpty(connection.profilePath, this.config.tomorrow.profilePath)
      });
    } catch (error) {
      throw new AppError("Unable to read your Tomorrow projects.", {
        statusCode: 502,
        code: ERROR_CODE.tomorrowSyncFailed,
        cause: error
      });
    }

    for (const project of projects) {
      if (!project.isSucceeded) {
        continue;
      }

      let normalized;
      try {
        normalized = normalizeRepositoryUrl(project.repoUrl, this.config.gitea.baseUrl);
      } catch {
        continue;
      }

      try {
        await this.repositoryStore.createRepository({
          id: randomUUID(),
          userId,
          giteaRepoUrl: normalized.url,
          giteaProjectPath: normalized.projectPath,
          tomorrowAuditText: project.auditText.trim(),
          defaultBranch: "main",
          botAccessStatus: BOT_ACCESS_STATUS.unknown
        });
      } catch (error) {
        throw new AppError("Unable to save Tomorrow projects.", {
          statusCode: 500,
          code: ERROR_CODE.internal,
          cause: error
        });
      }
    }

    try {
      return await this.repositoryStore.listRepositories(userId);
    } catch (error) {
      throw new AppError("Internal server error.", {
        statusCode: 500,
        code: ERROR_CODE.internal,
        cause: error
      });
    }
  }

  async getRepository(userId: string, repositoryId: string) {
    this.ensureUserId(userId);
    this.ensureRepositoryId(repositoryId);
    return this.loadRepository(userId, repositoryId);
  }

  async checkBotAccess(userId: string, repositoryId: string) {
    this.ensureUserId(userId);
    this.ensureRepositoryId(repositoryId);
    const repository = await this.loadRepository(userId, repositoryId);

    await this.repositoryStore.updateBotAccess({
      userId,
      repositoryId,
      status: BOT_ACCESS_STATUS.checking,
      defaultBranch: repository.defaultBranch
    });

    let access = false;
    try {
      access = await this.giteaApiClient.checkAccess(repository.giteaRepoUrl);
    } catch (error) {
      await this.repositoryStore.updateBotAccess({
        userId,
        repositoryId,
        status: BOT_ACCESS_STATUS.failed,
        defaultBranch: repository.defaultBranch
      });
      throw error instanceof AppError
        ? error
        : new AppError("Unable to check Gitea repository access.", {
            statusCode: 502,
            code: ERROR_CODE.giteaApiError,
            cause: error
          });
    }

    if (!access) {
      await this.repositoryStore.updateBotAccess({
        userId,
        repositoryId,
        status: BOT_ACCESS_STATUS.denied,
        defaultBranch: repository.defaultBranch
      });
      throw new AppError(
        "The Gitea bot does not have access to this repository. Please add the bot as a collaborator and try again.",
        {
          statusCode: 403,
          code: ERROR_CODE.botAccessDenied
        }
      );
    }

    let metadata;
    try {
      metadata = await this.giteaApiClient.getRepository(repository.giteaRepoUrl);
    } catch (error) {
      await this.repositoryStore.updateBotAccess({
        userId,
        repositoryId,
        status: BOT_ACCESS_STATUS.failed,
        defaultBranch: repository.defaultBranch
      });
      throw error instanceof AppError
        ? error
        : new AppError("Unable to read Gitea repository metadata.", {
            statusCode: 502,
            code: ERROR_CODE.giteaApiError,
            cause: error
          });
    }

    const updated = await this.repositoryStore.updateBotAccess({
      userId,
      repositoryId,
      status: BOT_ACCESS_STATUS.granted,
      defaultBranch: metadata.defaultBranch || "main"
    });
    if (!updated) {
      throw repositoryNotFoundError();
    }

    return updated;
  }

  async startAnalysis(userId: string, repositoryId: string) {
    this.ensureUserId(userId);
    this.ensureRepositoryId(repositoryId);
    const repository = await this.loadRepository(userId, repositoryId);
    if (repository.botAccessStatus !== BOT_ACCESS_STATUS.granted) {
      throw new AppError(
        "The Gitea bot does not have access to this repository. Please add the bot as a collaborator and try again.",
        {
          statusCode: 403,
          code: ERROR_CODE.botAccessDenied
        }
      );
    }

    const job = await this.repositoryStore.createAnalysisJob({
      id: randomUUID(),
      userId,
      repositoryId,
      status: ANALYSIS_JOB_STATUS.pending
    });

    try {
      await this.analysisQueuePublisher.publishAnalysisJob({
        jobId: job.id,
        userId,
        repositoryId,
        giteaRepoUrl: repository.giteaRepoUrl,
        branch: repository.defaultBranch || "main"
      });
    } catch (error) {
      try {
        await this.repositoryStore.failAnalysisJob(userId, job.id, "Unable to enqueue analysis job.");
      } catch {
        // Best-effort state update.
      }
      throw error instanceof AppError
        ? error
        : new AppError("Unable to enqueue analysis job.", {
            statusCode: 502,
            code: ERROR_CODE.queuePublishFailed,
            cause: error
          });
    }

    return job;
  }

  async getAnalysisJob(userId: string, analysisJobId: string): Promise<AnalysisJobRecord> {
    this.ensureUserId(userId);
    if (!isUuid(analysisJobId)) {
      throw analysisJobNotFoundError();
    }

    const job = await this.repositoryStore.getAnalysisJob(userId, analysisJobId);
    if (!job) {
      throw analysisJobNotFoundError();
    }

    return job;
  }

  async readSafeRepositoryFiles(userId: string, repositoryId: string): Promise<SafeRepositorySnapshot> {
    const repository = await this.getRepository(userId, repositoryId);
    if (repository.botAccessStatus !== BOT_ACCESS_STATUS.granted) {
      throw new AppError(
        "The Gitea bot does not have access to this repository. Please add the bot as a collaborator and try again.",
        {
          statusCode: 403,
          code: ERROR_CODE.botAccessDenied
        }
      );
    }

    const branch = repository.defaultBranch || "main";
    const tree = await this.giteaApiClient.getRepositoryTree(repository.giteaRepoUrl, branch);
    const snapshot: SafeRepositorySnapshot = {
      repositoryId,
      branch,
      files: []
    };

    for (const node of tree) {
      if (node.type !== "blob" || !this.fileFilter.shouldReadPath(node.path)) {
        continue;
      }

      try {
        const content = await this.giteaApiClient.getFileContent(repository.giteaRepoUrl, node.path, branch);
        if (!this.fileFilter.shouldReadContent(content)) {
          continue;
        }
        snapshot.files.push({
          path: node.path,
          size: content.length,
          content: content.toString("utf8")
        });
      } catch {
        continue;
      }
    }

    return snapshot;
  }

  private ensureUserId(userId: string) {
    if (!isUuid(userId)) {
      throw new AppError("Authenticated user id is required.", {
        statusCode: 401,
        code: ERROR_CODE.unauthorized
      });
    }
  }

  private ensureRepositoryId(repositoryId: string) {
    if (!isUuid(repositoryId)) {
      throw repositoryNotFoundError();
    }
  }

  private async loadRepository(userId: string, repositoryId: string): Promise<RepositoryRecord> {
    const repository = await this.repositoryStore.getRepository(userId, repositoryId);
    if (!repository) {
      throw repositoryNotFoundError();
    }
    return repository;
  }
}

function repositoryNotFoundError() {
  return new AppError("Repository not found.", {
    statusCode: 404,
    code: ERROR_CODE.repositoryNotFound
  });
}

function analysisJobNotFoundError() {
  return new AppError("Analysis job not found.", {
    statusCode: 404,
    code: ERROR_CODE.analysisJobNotFound
  });
}
