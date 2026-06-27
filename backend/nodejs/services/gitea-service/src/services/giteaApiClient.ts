import { AppError } from "@backend/microservice-sdk";
import { ERROR_CODE, type GiteaRepositoryMetadata, type GiteaTreeNode } from "../models/gitea.js";
import { parseRepositoryParts } from "../utils/repositoryUrl.js";
import type { GiteaApiClient as GiteaApiClientContract } from "../types/service.js";

export class GiteaApiClient implements GiteaApiClientContract {
  baseUrl: string;
  botToken: string;

  constructor(input: { baseUrl: string; botToken: string }) {
    this.baseUrl = input.baseUrl.replace(/\/+$/g, "");
    this.botToken = input.botToken.trim();
  }

  async checkAccess(repoUrl: string) {
    try {
      await this.getRepository(repoUrl);
      return true;
    } catch (error) {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
        return false;
      }
      throw error;
    }
  }

  async getRepository(repoUrl: string): Promise<GiteaRepositoryMetadata> {
    const { owner, repo } = parseRepositoryParts(repoUrl, this.baseUrl);
    const payload = await this.fetchJson<{ default_branch?: string }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    return {
      defaultBranch: payload.default_branch?.trim() || "main"
    };
  }

  async getRepositoryTree(repoUrl: string, branch: string) {
    const { owner, repo } = parseRepositoryParts(repoUrl, this.baseUrl);
    const payload = await this.fetchJson<{ tree?: Array<{ path?: string; type?: string; mode?: string; sha?: string }> }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch || "main")}?recursive=true`
    );
    return (payload.tree ?? []).map<GiteaTreeNode>((node) => ({
      path: node.path ?? "",
      type: node.type ?? "blob",
      mode: node.mode,
      id: node.sha,
      name: node.path?.split("/").at(-1) ?? ""
    }));
  }

  async getFileContent(repoUrl: string, filePath: string, branch: string) {
    const { owner, repo } = parseRepositoryParts(repoUrl, this.baseUrl);
    const escapedPath = filePath
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const payload = await this.fetchJson<{ type?: string; encoding?: string; content?: string }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${escapedPath}?ref=${encodeURIComponent(branch || "main")}`
    );

    if (payload.type && payload.type !== "file") {
      throw new AppError("Unable to read Gitea repository file.", {
        statusCode: 502,
        code: ERROR_CODE.giteaApiError
      });
    }
    if ((payload.encoding ?? "").toLowerCase() !== "base64" || !payload.content) {
      throw new AppError("Unable to read Gitea repository file.", {
        statusCode: 502,
        code: ERROR_CODE.giteaApiError
      });
    }

    return Buffer.from(payload.content.replace(/\n/g, ""), "base64");
  }

  private async fetchJson<T>(apiPath: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/api/v1${apiPath}`, {
      headers: {
        Accept: "application/json",
        Authorization: `token ${this.botToken}`
      }
    });

    if (!response.ok) {
      throw new AppError("Unable to contact Gitea.", {
        statusCode: response.status === 403 ? 403 : response.status === 404 ? 404 : 502,
        code: ERROR_CODE.giteaApiError
      });
    }

    return (await response.json()) as T;
  }
}
