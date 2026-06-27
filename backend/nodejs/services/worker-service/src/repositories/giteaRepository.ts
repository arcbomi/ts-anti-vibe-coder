import { AppError } from "@backend/microservice-sdk";
import type { GiteaTreeNode, WorkerServiceConfig } from "../types/service.ts";

export class GiteaRepository {
  constructor(private readonly config: WorkerServiceConfig) {}

  async checkAccess(repoUrl: string): Promise<boolean> {
    const response = await this.fetchJson<{ accessible?: boolean }>(this.toApiUrl(repoUrl), {
      headers: this.buildHeaders()
    });

    return response.accessible !== false;
  }

  async getRepositoryTree(repoUrl: string, branch: string): Promise<GiteaTreeNode[]> {
    const response = await this.fetchJson<{ tree?: GiteaTreeNode[] }>(
      `${this.toApiUrl(repoUrl)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      {
        headers: this.buildHeaders()
      }
    );

    return Array.isArray(response.tree) ? response.tree : [];
  }

  async getFileContent(repoUrl: string, filePath: string, branch: string): Promise<string> {
    const response = await this.fetchJson<{ content?: string }>(
      `${this.toApiUrl(repoUrl)}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
      {
        headers: this.buildHeaders()
      }
    );

    if (typeof response.content !== "string") {
      throw new AppError(`Gitea file content missing for ${filePath}.`, {
        code: "GITEA_TEMPORARY_ERROR"
      });
    }

    return Buffer.from(response.content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  private buildHeaders() {
    return {
      Authorization: `token ${this.config.giteaBotToken}`,
      Accept: "application/json"
    };
  }

  private toApiUrl(repoUrl: string): string {
    const parsed = new URL(repoUrl);
    const repositoryPath = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    const [owner, repo] = repositoryPath.split("/");

    if (!owner || !repo) {
      throw new AppError("Gitea repository URL must include owner and repository.", {
        code: "INVALID_REPOSITORY_URL",
        statusCode: 400
      });
    }

    return `${this.config.giteaBaseUrl.replace(/\/+$/, "")}/api/v1/repos/${owner}/${repo}`;
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.aiTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AppError(`Gitea request failed with status ${response.status}.`, {
          code: response.status >= 500 ? "GITEA_TEMPORARY_ERROR" : "INVALID_REPOSITORY_URL",
          statusCode: response.status
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Gitea request failed.", {
        code: "GITEA_TEMPORARY_ERROR",
        cause: error
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
