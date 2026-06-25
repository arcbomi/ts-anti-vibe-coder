import type {
  AnalysisJobMessage,
  QueueRepositoryPort,
  WorkerRuntimeDependencies,
  WorkerRuntimeStatus
} from "../types/service.ts";
import { normalizeJobError } from "../utils/jobErrors.ts";
import { parseAnalysisJobMessage } from "../validation/analysisJobValidation.ts";

export class WorkerRuntimeService {
  private started = false;
  private stopRequested = false;
  private activeWorkers = 0;
  private readonly loops = new Set<Promise<void>>();

  constructor(private readonly dependencies: WorkerRuntimeDependencies) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.stopRequested = false;

    for (let index = 0; index < this.dependencies.config.workerConcurrency; index += 1) {
      const loop = this.runLoop(index + 1);
      this.loops.add(loop);
      void loop.finally(() => this.loops.delete(loop));
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    await this.dependencies.queueRepository.stop();
    await Promise.allSettled([...this.loops]);
  }

  getStatus(): WorkerRuntimeStatus {
    return {
      service: this.dependencies.config.serviceName,
      ready: this.started && !this.stopRequested,
      workerConcurrency: this.dependencies.config.workerConcurrency,
      activeWorkers: this.activeWorkers,
      queueName: this.dependencies.config.analysisQueueName,
      deadLetterQueueName: this.dependencies.config.analysisDeadLetterQueueName,
      checkedAt: new Date().toISOString()
    };
  }

  private async runLoop(workerId: number): Promise<void> {
    while (!this.stopRequested) {
      try {
        const payload = await this.dependencies.queueRepository.pop(this.dependencies.config.analysisQueueName, 5);
        if (!payload) {
          continue;
        }

        this.activeWorkers += 1;
        await this.processPayload(payload, workerId);
      } catch (error) {
        this.dependencies.logger.error("worker loop failed", {
          workerId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      } finally {
        if (this.activeWorkers > 0) {
          this.activeWorkers -= 1;
        }
      }
    }
  }

  private async processPayload(payload: string, workerId: number): Promise<void> {
    let message: AnalysisJobMessage;

    try {
      message = parseAnalysisJobMessage(payload);
    } catch (error) {
      await this.dependencies.queueRepository.push(this.dependencies.config.analysisDeadLetterQueueName, payload);
      this.dependencies.logger.error("analysis job payload validation failed", {
        workerId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return;
    }

    try {
      await this.dependencies.analysisJobService.process(message);
    } catch (error) {
      const jobError = normalizeJobError(error);
      const shouldRetry = jobError.retryable && message.attempt < this.dependencies.config.maxJobAttempts;
      const nextMessage = {
        ...message,
        attempt: message.attempt + 1
      };

      if (shouldRetry) {
        await this.sleep(this.dependencies.config.retryDelayMs);
        await this.dependencies.queueRepository.push(
          this.dependencies.config.analysisQueueName,
          JSON.stringify(nextMessage)
        );
        this.dependencies.logger.warn("analysis job requeued", {
          workerId,
          jobId: message.jobId,
          attempt: nextMessage.attempt,
          code: jobError.code
        });
        return;
      }

      await this.dependencies.analysisJobRepository.failAnalysisJob(
        message.jobId,
        jobError.code,
        jobError.message
      );
      await this.dependencies.queueRepository.push(
        this.dependencies.config.analysisDeadLetterQueueName,
        JSON.stringify(message)
      );
      this.dependencies.logger.error("analysis job dead-lettered", {
        workerId,
        jobId: message.jobId,
        code: jobError.code,
        error: jobError.message
      });
    }
  }

  private async sleep(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
