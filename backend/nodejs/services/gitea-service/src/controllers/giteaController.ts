import type { FastifyReply, FastifyRequest } from "fastify";
import { sendSuccess } from "../../../../packages/microservice-sdk/src/index.js";
import type { AnalysisJobRecord, RepositoryRecord } from "../models/gitea.js";
import { validateCreateRepositoryInput } from "../validation/repositoryValidation.js";
import type { AuthenticatedRequest, GiteaDomainService } from "../types/service.js";

export class GiteaController {
  service: GiteaDomainService;

  constructor(service: GiteaDomainService) {
    this.service = service;
  }

  async createRepository(request: FastifyRequest<{ Body: { gitea_repo_url?: string } }> & AuthenticatedRequest, reply: FastifyReply) {
    const repository = await this.service.createRepository(request.userContext?.userId ?? "", validateCreateRepositoryInput(request.body));
    return sendSuccess(reply, toRepositoryCreateResponse(repository));
  }

  async listRepositories(request: FastifyRequest & AuthenticatedRequest, reply: FastifyReply) {
    const repositories = await this.service.listRepositories(request.userContext?.userId ?? "");
    return sendSuccess(reply, repositories.map(toRepositoryResponse));
  }

  async syncTomorrowProjects(request: FastifyRequest & AuthenticatedRequest, reply: FastifyReply) {
    const repositories = await this.service.syncTomorrowProjects(request.userContext?.userId ?? "");
    return sendSuccess(reply, repositories.map(toRepositoryResponse));
  }

  async getRepository(request: FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply: FastifyReply) {
    const repository = await this.service.getRepository(request.userContext?.userId ?? "", request.params.id);
    return sendSuccess(reply, toRepositoryResponse(repository));
  }

  async checkBotAccess(request: FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply: FastifyReply) {
    const repository = await this.service.checkBotAccess(request.userContext?.userId ?? "", request.params.id);
    return sendSuccess(reply, {
      id: repository.id,
      repository_id: repository.id,
      bot_access_status: repository.botAccessStatus,
      message: "Bot access confirmed."
    });
  }

  async startAnalysis(request: FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply: FastifyReply) {
    const job = await this.service.startAnalysis(request.userContext?.userId ?? "", request.params.id);
    return sendSuccess(reply, {
      id: job.id,
      analysis_job_id: job.id,
      status: job.status
    });
  }

  async getAnalysisJob(request: FastifyRequest<{ Params: { id: string } }> & AuthenticatedRequest, reply: FastifyReply) {
    const job = await this.service.getAnalysisJob(request.userContext?.userId ?? "", request.params.id);
    return sendSuccess(reply, toAnalysisJobResponse(job));
  }
}

function toRepositoryCreateResponse(repository: RepositoryRecord) {
  return {
    id: repository.id,
    repository_id: repository.id,
    gitea_repo_url: repository.giteaRepoUrl,
    bot_access_status: repository.botAccessStatus
  };
}

function toRepositoryResponse(repository: RepositoryRecord) {
  return {
    id: repository.id,
    repository_id: repository.id,
    gitea_repo_url: repository.giteaRepoUrl,
    gitea_project_path: repository.giteaProjectPath,
    tomorrow_audit_text: repository.tomorrowAuditText,
    default_branch: repository.defaultBranch,
    bot_access_status: repository.botAccessStatus,
    latest_analysis_job_id: repository.latestAnalysisJobId,
    latest_analysis_status: repository.latestAnalysisStatus,
    latest_analysis_error_message: repository.latestAnalysisErrorMessage,
    latest_analysis_job: repository.latestAnalysisJobId ? { id: repository.latestAnalysisJobId } : undefined,
    created_at: repository.createdAt,
    updated_at: repository.updatedAt
  };
}

function toAnalysisJobResponse(job: AnalysisJobRecord) {
  return {
    id: job.id,
    analysis_job_id: job.id,
    repository_id: job.repositoryId,
    status: job.status,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    completed_at: job.completedAt
  };
}
