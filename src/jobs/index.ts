import cron, { ScheduledTask } from "node-cron";
import { logger } from "@/utils/logger";
import { JobDefinition, JobStatus } from "./types";
import env from "@/config/env";

/**
 * Job Scheduler
 * Manages all scheduled cron jobs
 */
export class JobScheduler {
  private jobs: Map<string, ScheduledTask> = new Map();
  private jobDefinitions: JobDefinition[] = [];

  /**
   * Register a job definition
   */
  registerJob(job: JobDefinition): void {
    this.jobDefinitions.push(job);
  }

  /**
   * Start all registered jobs
   */
  start(): void {
    // Don't start jobs in test environment
    if (env.NODE_ENV === "test") {
      logger.info("Jobs disabled in test environment");
      return;
    }

    logger.info(`Starting ${this.jobDefinitions.length} scheduled job(s)...`);

    for (const job of this.jobDefinitions) {
      if (!job.enabled) {
        logger.info(`Job "${job.name}" is disabled, skipping`);
        continue;
      }

      try {
        const task = cron.schedule(
          job.schedule,
          async () => {
            const startTime = Date.now();
            logger.info(`Executing job: ${job.name}`);

            try {
              const result = await job.execute();
              const executionTime = Date.now() - startTime;

              if (result.status === JobStatus.SUCCESS) {
                logger.info(
                  `Job "${job.name}" completed successfully in ${executionTime}ms: ${result.message}`
                );
              } else {
                logger.error(
                  `Job "${job.name}" failed after ${executionTime}ms: ${result.message}`,
                  result.error
                );
              }
            } catch (error) {
              const executionTime = Date.now() - startTime;
              logger.error(`Job "${job.name}" threw an error after ${executionTime}ms:`, error);
            }
          },
          {
            timezone: "Europe/Rome", // Calabria timezone
          }
        );

        this.jobs.set(job.name, task);
        logger.info(`Job "${job.name}" scheduled with pattern: ${job.schedule}`);
      } catch (error) {
        logger.error(`Failed to schedule job "${job.name}":`, error);
      }
    }

    logger.info(`All jobs started successfully`);
  }

  /**
   * Stop all jobs
   */
  stop(): void {
    logger.info("Stopping all scheduled jobs...");
    for (const [name, task] of this.jobs.entries()) {
      task.stop();
      logger.info(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getStatus(): Array<{ name: string; scheduled: boolean }> {
    return this.jobDefinitions.map((job) => ({
      name: job.name,
      scheduled: this.jobs.has(job.name),
    }));
  }
}

// Export singleton instance
export const jobScheduler = new JobScheduler();
