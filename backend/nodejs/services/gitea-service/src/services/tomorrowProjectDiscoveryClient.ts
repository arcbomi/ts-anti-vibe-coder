import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE, type TomorrowProject } from "../models/gitea.js";
import type { TomorrowProjectDiscoveryClient as TomorrowProjectDiscoveryClientContract } from "../types/service.js";

export class TomorrowProjectDiscoveryClient implements TomorrowProjectDiscoveryClientContract {
  serviceUrl: string;

  constructor(serviceUrl: string) {
    this.serviceUrl = serviceUrl.replace(/\/+$/g, "");
  }

  async discoverSucceededProjects(input: {
    username: string;
    remoteToken: string;
    profilePath: string;
  }): Promise<TomorrowProject[]> {
    const response = await fetch(`${this.serviceUrl}/api/v1/tomorrow/projects/discover`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    let payload: { data?: { projects?: TomorrowProject[] }; error?: { message?: string } } | null = null;
    try {
      payload = (await response.json()) as { data?: { projects?: TomorrowProject[] }; error?: { message?: string } };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new AppError(payload?.error?.message || "Unable to read your Tomorrow projects.", {
        statusCode: 502,
        code: ERROR_CODE.tomorrowSyncFailed
      });
    }

    return payload?.data?.projects ?? [];
  }
}
