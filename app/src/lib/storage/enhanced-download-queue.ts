// Enhanced Download Queue with Pause/Resume Support
import type { Meeting, FileType } from '../../types';

// Simple browser-compatible EventEmitter
class SimpleEventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export interface DownloadJob {
  id: string;
  meetingId: string;
  meetingTitle: string;
  fileType: FileType;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  currentOperation?: string; // e.g., "Fetching transcript", "Downloading audio"
  fileName?: string; // e.g., "audio.mp3", "transcript.json"
}

export interface QueueProgress {
  total: number;
  completed: number;
  failed: number;
  paused: number;
  downloading: number;
  pending: number;
  overallProgress: number; // 0-100
}

export class EnhancedDownloadQueue extends SimpleEventEmitter {
  private jobs: Map<string, DownloadJob> = new Map();
  private activeDownloads = 0;
  private maxConcurrent: number;
  private isPaused = false;
  private maxRetries = 3;
  private requestsPerMinute: number; // Rate limit in requests per minute
  private delayBetweenDownloads: number; // Calculated delay in milliseconds
  private lastDownloadTime = 0;

  constructor(maxConcurrent: number = 1, requestsPerMinute: number = 10) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.requestsPerMinute = requestsPerMinute;
    this.delayBetweenDownloads = this.calculateDelay(requestsPerMinute);
  }

  /**
   * Calculate delay between downloads based on requests per minute
   */
  private calculateDelay(requestsPerMinute: number): number {
    return Math.floor((60 * 1000) / requestsPerMinute);
  }

  /**
   * Add jobs to the queue
   */
  addJobs(meetings: Meeting[], fileTypes: FileType[]): void {
    for (const meeting of meetings) {
      for (const fileType of fileTypes) {
        const jobId = `${meeting.id}-${fileType}`;
        
        if (!this.jobs.has(jobId)) {
          const job: DownloadJob = {
            id: jobId,
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            fileType,
            status: 'pending',
            progress: 0,
            retryCount: 0,
          };
          
          this.jobs.set(jobId, job);
        }
      }
    }

    this.emit('jobs-added', this.getProgress());
    this.processQueue();
  }

  /**
   * Pause all downloads
   */
  pause(): void {
    this.isPaused = true;
    
    // Mark downloading jobs as paused
    for (const job of this.jobs.values()) {
      if (job.status === 'downloading') {
        job.status = 'paused';
      }
    }
    
    this.emit('paused', this.getProgress());
  }

  /**
   * Resume downloads
   */
  resume(): void {
    this.isPaused = false;
    
    // Mark paused jobs as pending
    for (const job of this.jobs.values()) {
      if (job.status === 'paused') {
        job.status = 'pending';
      }
    }
    
    this.emit('resumed', this.getProgress());
    this.processQueue();
  }

  /**
   * Cancel specific job
   */
  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'paused')) {
      this.jobs.delete(jobId);
      this.emit('job-cancelled', jobId, this.getProgress());
    }
  }

  /**
   * Cancel all pending/paused jobs
   */
  cancelAll(): void {
    const toDelete: string[] = [];
    
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'pending' || job.status === 'paused') {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.jobs.delete(id));
    this.emit('all-cancelled', this.getProgress());
  }

  /**
   * Retry failed jobs
   */
  retryFailed(): void {
    for (const job of this.jobs.values()) {
      if (job.status === 'failed' && job.retryCount < this.maxRetries) {
        job.status = 'pending';
        job.progress = 0;
        job.error = undefined;
        job.retryCount++;
      }
    }
    
    this.emit('retry-initiated', this.getProgress());
    this.processQueue();
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    const toDelete: string[] = [];
    
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed') {
        toDelete.push(id);
      }
    }
    
    toDelete.forEach(id => this.jobs.delete(id));
    this.emit('completed-cleared', this.getProgress());
  }

  /**
   * Get current queue progress
   */
  getProgress(): QueueProgress {
    let completed = 0;
    let failed = 0;
    let paused = 0;
    let downloading = 0;
    let pending = 0;
    let totalProgress = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'completed':
          completed++;
          totalProgress += 100;
          break;
        case 'failed':
          failed++;
          break;
        case 'paused':
          paused++;
          totalProgress += job.progress;
          break;
        case 'downloading':
          downloading++;
          totalProgress += job.progress;
          break;
        case 'pending':
          pending++;
          break;
      }
    }

    const total = this.jobs.size;
    const overallProgress = total > 0 ? totalProgress / total : 0;

    return {
      total,
      completed,
      failed,
      paused,
      downloading,
      pending,
      overallProgress,
    };
  }

  /**
   * Get all jobs
   */
  getJobs(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Check if queue is paused
   */
  isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Set rate limit in requests per minute
   */
  setRequestsPerMinute(requestsPerMinute: number): void {
    this.requestsPerMinute = requestsPerMinute;
    this.delayBetweenDownloads = this.calculateDelay(requestsPerMinute);
    console.log(`⏱️ Rate limit set to ${requestsPerMinute} requests/min (${this.delayBetweenDownloads}ms delay)`);
    this.emit('rate-limit-changed', { requestsPerMinute, delayMs: this.delayBetweenDownloads });
  }

  /**
   * Get current rate limit settings
   */
  getRateLimitSettings(): { requestsPerMinute: number; delayMs: number; maxConcurrent: number } {
    return {
      requestsPerMinute: this.requestsPerMinute,
      delayMs: this.delayBetweenDownloads,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Set max concurrent downloads
   */
  setMaxConcurrent(maxConcurrent: number): void {
    this.maxConcurrent = maxConcurrent;
    console.log(`🔢 Max concurrent downloads set to ${maxConcurrent}`);
    this.emit('concurrency-changed', maxConcurrent);
  }

  /**
   * Check if queue is active
   */
  isActive(): boolean {
    return this.activeDownloads > 0 || this.hasPendingJobs();
  }

  /**
   * Check if there are pending jobs
   */
  private hasPendingJobs(): boolean {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        return true;
      }
    }
    return false;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isPaused) return;

    while (this.activeDownloads < this.maxConcurrent && this.hasPendingJobs()) {
      const nextJob = this.getNextJob();
      if (!nextJob) break;

      // Rate limiting: wait if not enough time has passed since last download
      const timeSinceLastDownload = Date.now() - this.lastDownloadTime;
      if (this.lastDownloadTime > 0 && timeSinceLastDownload < this.delayBetweenDownloads) {
        const waitTime = this.delayBetweenDownloads - timeSinceLastDownload;
        console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next download`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      this.lastDownloadTime = Date.now();
      this.activeDownloads++;
      nextJob.status = 'downloading';
      nextJob.startedAt = Date.now();
      
      this.emit('job-started', nextJob, this.getProgress());

      // Process job asynchronously
      this.processJob(nextJob).finally(() => {
        this.activeDownloads--;
        this.processQueue(); // Continue processing
      });
    }
  }

  /**
   * Get next pending job
   */
  private getNextJob(): DownloadJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Set external processor function
   */
  setProcessor(processor: (job: DownloadJob, onProgress: (progress: number) => void) => Promise<void>): void {
    // Remove all existing processors first to prevent duplicates
    this.removeAllListeners('process-job');
    // Now add the new processor
    this.on('process-job', processor);
  }

  /**
   * Process a single job
   */
  private async processJob(job: DownloadJob): Promise<void> {
    try {
      // Create progress callback
      const onProgress = (progress: number) => {
        job.progress = progress;
        this.emit('job-progress', job, this.getProgress());
      };

      // Emit job for external processing
      this.emit('process-job', job, onProgress);

      // Wait for external processor to complete
      // For now, simulate - will be replaced by real implementation
      await this.waitForProcessor(job, onProgress);

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = Date.now();
      this.emit('job-completed', job, this.getProgress());
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Download failed';
      this.emit('job-failed', job, this.getProgress());
    }
  }

  /**
   * Wait for external processor (placeholder)
   */
  private async waitForProcessor(job: DownloadJob, onProgress: (progress: number) => void): Promise<void> {
    // Check if there's an external processor
    const listeners = (this as any).events?.get('process-job');
    if (!listeners || listeners.length === 0) {
      // No external processor, simulate
      return this.simulateDownload(job, onProgress);
    }
    
    // External processor will handle it
    // Just wait a bit to let it complete
    return new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  /**
   * Simulate download (placeholder)
   */
  private async simulateDownload(job: DownloadJob, onProgress: (progress: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        onProgress(progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });
  }

}

// Export singleton
// Create download queue with rate limiting to prevent API throttling
// - maxConcurrent: 1 (download one file at a time)
// - requestsPerMinute: 10 (10 requests per minute = 6 seconds between downloads)
export const downloadQueue = new EnhancedDownloadQueue(1, 10);

