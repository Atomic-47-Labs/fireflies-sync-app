// Download Queue Manager
import { db } from '../db';
import { apiClient } from '../api';
import { fileSystem } from './filesystem';
import {
  generateTranscriptJSON,
  generateSummaryMarkdown,
  generateTranscriptHTML,
  generateMetadataJSON,
  downloadFile,
} from './file-generators';
import { generateMeetingFolderPath } from '../utils';
import type { Meeting, FileType, FileRecord, DownloadProgress } from '../../types';
import { StorageError } from '../../types';

export interface DownloadTask {
  meeting: Meeting;
  fileTypes: FileType[];
  priority: number;
}

export interface DownloadResult {
  meetingId: string;
  success: boolean;
  filesDownloaded: FileType[];
  filesFailed: FileType[];
  error?: string;
}

export type DownloadProgressCallback = (
  meetingId: string,
  fileType: FileType,
  progress: DownloadProgress
) => void;

export type DownloadCompleteCallback = (result: DownloadResult) => void;

export class DownloadQueueManager {
  private queue: DownloadTask[] = [];
  private activeDownloads: Map<string, AbortController> = new Map();
  private maxConcurrent: number = 3;
  private processing: boolean = false;
  private paused: boolean = false;

  private onProgressCallback?: DownloadProgressCallback;
  private onCompleteCallback?: DownloadCompleteCallback;

  /**
   * Set maximum concurrent downloads
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(10, max));
  }

  /**
   * Set progress callback
   */
  onProgress(callback: DownloadProgressCallback): void {
    this.onProgressCallback = callback;
  }

  /**
   * Set complete callback
   */
  onComplete(callback: DownloadCompleteCallback): void {
    this.onCompleteCallback = callback;
  }

  /**
   * Add meeting to download queue
   */
  async addToQueue(
    meeting: Meeting,
    fileTypes: FileType[],
    priority: number = 0
  ): Promise<void> {
    // Check if already in queue
    const existing = this.queue.find(task => task.meeting.id === meeting.id);
    if (existing) {
      return;
    }

    this.queue.push({ meeting, fileTypes, priority });
    
    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Start processing if not already
    if (!this.processing && !this.paused) {
      this.startProcessing();
    }
  }

  /**
   * Add multiple meetings to queue
   */
  async addMultipleToQueue(
    meetings: Meeting[],
    fileTypes: FileType[],
    priority: number = 0
  ): Promise<void> {
    for (const meeting of meetings) {
      await this.addToQueue(meeting, fileTypes, priority);
    }
  }

  /**
   * Remove meeting from queue
   */
  removeFromQueue(meetingId: string): boolean {
    const index = this.queue.findIndex(task => task.meeting.id === meetingId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Cancel active download
   */
  cancelDownload(meetingId: string): boolean {
    const controller = this.activeDownloads.get(meetingId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(meetingId);
      return true;
    }
    return false;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.paused = false;
    if (!this.processing && this.queue.length > 0) {
      this.startProcessing();
    }
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    
    // Cancel all active downloads
    this.activeDownloads.forEach(controller => controller.abort());
    this.activeDownloads.clear();
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeDownloads: this.activeDownloads.size,
      paused: this.paused,
      processing: this.processing,
    };
  }

  /**
   * Start processing queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && !this.paused) {
      // Wait if we're at max concurrent downloads
      while (this.activeDownloads.size >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Get next task
      const task = this.queue.shift();
      if (!task) break;

      // Start download (don't await - run concurrently)
      this.downloadMeeting(task).catch(console.error);
    }

    this.processing = false;
  }

  /**
   * Download all files for a meeting
   */
  private async downloadMeeting(task: DownloadTask): Promise<void> {
    const { meeting, fileTypes } = task;
    const abortController = new AbortController();
    this.activeDownloads.set(meeting.id, abortController);

    const result: DownloadResult = {
      meetingId: meeting.id,
      success: false,
      filesDownloaded: [],
      filesFailed: [],
    };

    try {
      // Update meeting status to syncing
      await db.meetings.update(meeting.id, { 
        sync_status: 'syncing',
        updated_at: Date.now()
      });

      // Get full transcript details
      const transcript = await apiClient.getTranscript(meeting.id);

      // Generate folder path
      const folderPath = generateMeetingFolderPath(meeting.date, meeting.title);
      const pathSegments = folderPath.split('/');

      // Download each file type
      for (const fileType of fileTypes) {
        if (abortController.signal.aborted) {
          throw new Error('Download cancelled');
        }

        try {
          await this.downloadFileType(
            meeting.id,
            fileType,
            transcript,
            pathSegments
          );

          result.filesDownloaded.push(fileType);

          // Update file record in database
          await this.updateFileRecord(meeting.id, fileType, 'downloaded');
        } catch (error) {
          console.error(`Failed to download ${fileType} for ${meeting.id}:`, error);
          result.filesFailed.push(fileType);
          
          // Update file record with error
          await this.updateFileRecord(
            meeting.id,
            fileType,
            'failed',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      // Generate metadata file
      const downloadedFiles = {
        audio: result.filesDownloaded.includes('audio'),
        transcript_docx: result.filesDownloaded.includes('transcript_docx'),
        transcript_json: result.filesDownloaded.includes('transcript_json'),
        summary: result.filesDownloaded.includes('summary'),
      };

      const metadata = generateMetadataJSON(transcript, downloadedFiles);
      await fileSystem.writeFile(pathSegments, 'metadata.json', metadata);

      // Update meeting status
      const newStatus = result.filesFailed.length === 0 ? 'synced' : 'failed';
      await db.meetings.update(meeting.id, {
        sync_status: newStatus,
        last_synced_at: Date.now(),
        sync_error: result.filesFailed.length > 0 
          ? `Failed to download: ${result.filesFailed.join(', ')}`
          : undefined,
        updated_at: Date.now()
      });

      // Log event
      await db.logEvent('meeting_downloaded', meeting.id, {
        files_downloaded: result.filesDownloaded,
        files_failed: result.filesFailed,
      });

      result.success = result.filesFailed.length === 0;
    } catch (error) {
      console.error(`Failed to download meeting ${meeting.id}:`, error);
      
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      // Update meeting with error
      await db.meetings.update(meeting.id, {
        sync_status: 'failed',
        sync_error: result.error,
        updated_at: Date.now()
      });

      // Log error event
      await db.logEvent('error', meeting.id, {
        error: result.error,
        phase: 'download'
      });
    } finally {
      // Clean up
      this.activeDownloads.delete(meeting.id);

      // Call completion callback
      if (this.onCompleteCallback) {
        this.onCompleteCallback(result);
      }
    }
  }

  /**
   * Download specific file type
   */
  private async downloadFileType(
    meetingId: string,
    fileType: FileType,
    transcript: any,
    pathSegments: string[]
  ): Promise<void> {
    const startTime = Date.now();

    switch (fileType) {
      case 'audio':
        if (!transcript.audio_url) {
          throw new StorageError('No audio URL available');
        }
        
        await this.downloadAudio(
          meetingId,
          transcript.audio_url,
          pathSegments,
          startTime
        );
        break;

      case 'transcript_json':
        const json = generateTranscriptJSON(transcript);
        await fileSystem.writeFile(pathSegments, 'transcript.json', json);
        break;

      case 'transcript_docx':
        // Generate HTML version (basic DOCX compatibility)
        const html = generateTranscriptHTML(transcript);
        await fileSystem.writeFile(pathSegments, 'transcript.docx', html);
        break;

      case 'summary':
        const markdown = generateSummaryMarkdown(transcript);
        await fileSystem.writeFile(pathSegments, 'summary.md', markdown);
        break;
    }
  }

  /**
   * Download audio file with progress tracking
   */
  private async downloadAudio(
    meetingId: string,
    audioUrl: string,
    pathSegments: string[],
    startTime: number
  ): Promise<void> {
    const blob = await downloadFile(audioUrl, (progress) => {
      if (this.onProgressCallback) {
        const downloadProgress: DownloadProgress = {
          meeting_id: meetingId,
          file_type: 'audio',
          bytes_downloaded: progress.loaded,
          total_bytes: progress.total,
          progress_percent: progress.percent,
          speed_bps: progress.loaded / ((Date.now() - startTime) / 1000),
          started_at: startTime,
        };

        this.onProgressCallback(meetingId, 'audio', downloadProgress);
      }
    });

    await fileSystem.writeFile(pathSegments, 'audio.mp3', blob);
  }

  /**
   * Update file record in database
   */
  private async updateFileRecord(
    meetingId: string,
    fileType: FileType,
    status: FileRecord['status'],
    errorMessage?: string
  ): Promise<void> {
    // Check if record exists
    const existing = await db.files
      .where({ meeting_id: meetingId, file_type: fileType })
      .first();

    if (existing) {
      await db.files.update(existing.id!, {
        status,
        error_message: errorMessage,
        downloaded_at: status === 'downloaded' ? Date.now() : undefined,
      });
    } else {
      await db.files.add({
        meeting_id: meetingId,
        file_type: fileType,
        file_path: '',
        status,
        error_message: errorMessage,
        downloaded_at: status === 'downloaded' ? Date.now() : undefined,
      });
    }
  }
}

// Export singleton instance
export const downloadQueue = new DownloadQueueManager();

