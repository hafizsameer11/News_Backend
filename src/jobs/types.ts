/**
 * Job execution status
 */
export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

/**
 * Job execution result
 */
export interface JobResult {
  status: JobStatus;
  message: string;
  error?: Error;
  executionTime?: number;
  data?: any;
}

/**
 * Job definition interface
 */
export interface JobDefinition {
  name: string;
  schedule: string; // Cron expression
  enabled: boolean;
  execute: () => Promise<JobResult>;
}
