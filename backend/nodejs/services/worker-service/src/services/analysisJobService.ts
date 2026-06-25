import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import type {
  AnalysisJobMessage,
  AnalysisJobPipelineDependencies,
  AnalysisJobStatus,
  RepositoryFile,
  WorkerServiceConfig
} from "../types/service.ts";
import { buildRepositoryAnalysisPrompt, buildQuestionGenerationPrompt } from "../utils/prompts.ts";
import { createRetryableError, normalizeJobError } from "../utils/jobErrors.ts";
import { parseGeneratedQuestions } from "../utils/questionParser.ts";
import { RepositoryFilter } from "../utils/repositoryFilter.ts";

const STATUS_FLOW: AnalysisJobStatus[] = [
  "checking_bot_access",
  "reading_repository",
  "indexing_code",
  "analyzing_code",
  "generating_questions",
  "saving_questions",
  "completed"
];

type Dependencies = AnalysisJobPipelineDependencies & {
  config: WorkerServiceConfig;
};

export class AnalysisJobService {
  private readonly repositoryFilter = new RepositoryFilter();

  constructor(private readonly dependencies: Dependencies) {}

  async process(message: AnalysisJobMessage): Promise<void> {
    const normalizedMessage = {
      ...message,
      branch: message.branch?.trim() || "main",
      attempt: message.attempt > 0 ? message.attempt : 1
    };

    try {
      await this.checkBotAccess(normalizedMessage);
      const files = await this.readRepository(normalizedMessage);
      const index = await this.buildCodeIndex(normalizedMessage, files);
      const analysis = await this.analyzeRepository(normalizedMessage, index);
      const questions = await this.generateQuestions(normalizedMessage, analysis);
      await this.saveQuestions(normalizedMessage, questions);
      await this.dependencies.analysisJobRepository.completeAnalysisJob(normalizedMessage.jobId);
      this.dependencies.logger.info("analysis job completed", {
        jobId: normalizedMessage.jobId,
        status: STATUS_FLOW.at(-1)
      });
    } catch (error) {
      const jobError = normalizeJobError(error);
      if (!jobError.retryable) {
        await this.dependencies.analysisJobRepository.failAnalysisJob(
          normalizedMessage.jobId,
          jobError.code,
          jobError.message
        );
      }

      throw jobError;
    }
  }

  private async checkBotAccess(message: AnalysisJobMessage): Promise<void> {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "checking_bot_access");
    const hasAccess = await this.dependencies.giteaRepository.checkAccess(message.giteaRepoUrl);
    if (!hasAccess) {
      throw new AppError("Gitea bot does not have access to the repository.", {
        code: "BOT_ACCESS_DENIED",
        statusCode: 400
      });
    }
  }

  private async readRepository(message: AnalysisJobMessage): Promise<RepositoryFile[]> {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "reading_repository");
    const tree = await this.dependencies.giteaRepository.getRepositoryTree(message.giteaRepoUrl, message.branch);
    const files: RepositoryFile[] = [];

    for (const node of tree) {
      if (node.type !== "blob" || !this.repositoryFilter.shouldRead(node.path, 0)) {
        continue;
      }

      const content = await this.dependencies.giteaRepository.getFileContent(
        message.giteaRepoUrl,
        node.path,
        message.branch
      );

      if (!this.repositoryFilter.acceptContent(node.path, content)) {
        continue;
      }

      files.push({
        path: node.path,
        size: content.length,
        content
      });
    }

    if (files.length === 0) {
      throw new AppError("Repository did not contain readable source files.", {
        code: "REPOSITORY_NOT_FOUND",
        statusCode: 400
      });
    }

    return files;
  }

  private async buildCodeIndex(message: AnalysisJobMessage, files: RepositoryFile[]) {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "indexing_code");

    return {
      user_id: message.userId,
      repository_id: message.repositoryId,
      gitea_repository_url: message.giteaRepoUrl,
      branch_name: message.branch,
      repository_file_tree: files.map((file) => file.path),
      selected_source_files: files.map((file) => ({
        path: file.path,
        size: file.size,
        summary: `${file.path} has ${file.size} bytes and approximately ${file.content.split("\n").length} lines`,
        excerpt: file.content.slice(0, 4000)
      }))
    };
  }

  private async analyzeRepository(
    message: AnalysisJobMessage,
    codeIndex: Record<string, unknown>
  ): Promise<string> {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "analyzing_code");
    const prompt = buildRepositoryAnalysisPrompt(JSON.stringify(codeIndex));

    return this.dependencies.aiRepository.generateJson(prompt);
  }

  private async generateQuestions(message: AnalysisJobMessage, analysis: string) {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "generating_questions");
    const prompt = buildQuestionGenerationPrompt(analysis);
    const rawQuestions = await this.dependencies.aiRepository.generateJson(prompt);

    try {
      return parseGeneratedQuestions(rawQuestions);
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : "AI output was invalid.", {
        code: "AI_OUTPUT_INVALID",
        statusCode: 400
      });
    }
  }

  private async saveQuestions(message: AnalysisJobMessage, questions: ReturnType<typeof parseGeneratedQuestions>) {
    await this.dependencies.analysisJobRepository.updateAnalysisJobStatus(message.jobId, "saving_questions");
    await this.dependencies.analysisJobRepository.saveGeneratedQuestions(message.jobId, questions);
  }

  createRetryableFailure(error: unknown) {
    return createRetryableError(error);
  }
}
