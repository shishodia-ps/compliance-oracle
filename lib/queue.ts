import Queue from 'bull';
import { REDIS_URL } from '@/lib/redis';
import { redis } from '@/lib/redis';

// Document processing queue
export const documentQueue = new Queue('document-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
});

// Job status tracking
export const jobStatusQueue = new Queue('job-status', REDIS_URL);

// Document job data interface
export interface DocumentJobData {
  documentId: string;
  filePath: string;
  fileName: string;
  organizationId: string;
  userId: string;
}

// Job progress interface
export interface JobProgress {
  step: 'extract' | 'index' | 'enrich' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: any;
}

// Queue stats interface
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

// Event handlers for monitoring
export function setupQueueListeners() {
  console.log('[QUEUE] Setting up queue listeners...');
  
  documentQueue.on('completed', (job, result) => {
    console.log(`✅ Document ${job.data.documentId} processed successfully`);
  });

  documentQueue.on('failed', (job, err) => {
    console.error(`❌ Document ${job.data.documentId} failed:`, err.message);
  });

  documentQueue.on('progress', (job, progress: JobProgress) => {
    console.log(`📊 Document ${job.data.documentId}: ${progress.step} - ${progress.progress}%`);
  });

  documentQueue.on('waiting', (jobId) => {
    console.log(`⏳ Job ${jobId} is waiting`);
  });

  documentQueue.on('active', (job) => {
    console.log(`🔄 Job ${job.id} started processing`);
  });

  documentQueue.on('stalled', (job) => {
    console.warn(`⚠️ Job ${job.id} stalled`);
  });

  documentQueue.on('error', (error) => {
    console.error('❌ Queue error:', error);
  });

  console.log('[QUEUE] Listeners configured');
}

// Get queue statistics
export async function getQueueStats(): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    documentQueue.getWaitingCount(),
    documentQueue.getActiveCount(),
    documentQueue.getCompletedCount(),
    documentQueue.getFailedCount(),
    documentQueue.getDelayedCount(),
    documentQueue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  };
}

// Get document processing progress from Redis
export async function getDocumentProgress(documentId: string): Promise<JobProgress | null> {
  const progress = await redis.get(`doc:${documentId}:progress`);
  if (progress) {
    return JSON.parse(progress);
  }
  return null;
}

// Clean old jobs
export async function cleanOldJobs() {
  await documentQueue.clean(24 * 3600 * 1000, 'completed'); // 24 hours
  await documentQueue.clean(7 * 24 * 3600 * 1000, 'failed'); // 7 days
}

// Initialize queue
export async function initQueue() {
  setupQueueListeners();
  
  // Clean old jobs periodically
  setInterval(() => {
    cleanOldJobs().catch(console.error);
  }, 24 * 3600 * 1000); // Daily
}
