import net from "node:net";
import { AppError } from "../../../../packages/microservice-sdk/src/index.js";
import { ERROR_CODE } from "../models/gitea.js";
import type { AnalysisQueuePublisher as AnalysisQueuePublisherContract } from "../types/service.js";

function encodeCommand(parts: string[]) {
  const chunks = [`*${parts.length}\r\n`];
  for (const part of parts) {
    const value = String(part);
    chunks.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
  }
  return chunks.join("");
}

export class RedisAnalysisQueuePublisher implements AnalysisQueuePublisherContract {
  host: string;
  port: number;
  password: string;
  db: number;
  queueName: string;

  constructor(input: { host: string; port: number; password: string; db: number; queueName: string }) {
    this.host = input.host;
    this.port = input.port;
    this.password = input.password;
    this.db = input.db;
    this.queueName = input.queueName;
  }

  async publishAnalysisJob(input: {
    jobId: string;
    userId: string;
    repositoryId: string;
    giteaRepoUrl: string;
    branch: string;
  }) {
    const payload = JSON.stringify({
      job_id: input.jobId,
      user_id: input.userId,
      repository_id: input.repositoryId,
      gitea_repo_url: input.giteaRepoUrl,
      branch: input.branch || "main",
      attempt: 1
    });

    const commands: string[] = [];
    if (this.password.trim()) {
      commands.push(encodeCommand(["AUTH", this.password.trim()]));
    }
    if (this.db > 0) {
      commands.push(encodeCommand(["SELECT", String(this.db)]));
    }
    commands.push(encodeCommand(["LPUSH", this.queueName, payload]));
    commands.push(encodeCommand(["QUIT"]));

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        reject(
          new AppError("Unable to enqueue analysis job.", {
            statusCode: 502,
            code: ERROR_CODE.queuePublishFailed,
            cause: error
          })
        );
      };

      socket.on("connect", () => {
        socket.write(commands.join(""));
      });
      socket.on("error", fail);
      socket.on("close", () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  }
}
