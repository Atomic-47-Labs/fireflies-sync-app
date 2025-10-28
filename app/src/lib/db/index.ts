// IndexedDB Database using Dexie.js
import Dexie, { type Table } from 'dexie';
import type { 
  Meeting, 
  FileRecord, 
  SyncEvent, 
  ConfigItem,
  TranscriptContent,
  SummaryContent,
  SearchMetadata 
} from '../../types';

export class FirefliesDatabase extends Dexie {
  meetings!: Table<Meeting, string>;
  files!: Table<FileRecord, number>;
  syncHistory!: Table<SyncEvent, number>;
  config!: Table<ConfigItem, string>;
  transcriptContent!: Table<TranscriptContent, string>;
  summaryContent!: Table<SummaryContent, string>;
  searchMetadata!: Table<SearchMetadata, string>;

  constructor() {
    super('Atomic47Labs_FirefilesTranscriptApp');
    
    // Define schema
    this.version(1).stores({
      meetings: 'id, title, date, sync_status, organizer_email, *participants, last_synced_at',
      files: '++id, meeting_id, file_type, status, downloaded_at',
      syncHistory: '++id, timestamp, event_type, meeting_id',
      config: 'key'
    });

    // Version 2: Add compound index for meeting_id+file_type
    this.version(2).stores({
      meetings: 'id, title, date, sync_status, organizer_email, *participants, last_synced_at',
      files: '++id, meeting_id, file_type, status, downloaded_at, [meeting_id+file_type]',
      syncHistory: '++id, timestamp, event_type, meeting_id',
      config: 'key'
    });

    // Version 3: Add full-text search support tables
    this.version(3).stores({
      meetings: 'id, title, date, sync_status, organizer_email, *participants, last_synced_at',
      files: '++id, meeting_id, file_type, status, downloaded_at, [meeting_id+file_type]',
      syncHistory: '++id, timestamp, event_type, meeting_id',
      config: 'key',
      transcriptContent: 'meeting_id, indexed_at',
      summaryContent: 'meeting_id',
      searchMetadata: 'meeting_id, *keywords, *topics'
    });

    // Map to classes (optional, for better TypeScript support)
    this.meetings.mapToClass(MeetingEntity);
    this.files.mapToClass(FileRecordEntity);
    this.syncHistory.mapToClass(SyncEventEntity);
    this.config.mapToClass(ConfigItemEntity);
    this.transcriptContent.mapToClass(TranscriptContentEntity);
    this.summaryContent.mapToClass(SummaryContentEntity);
    this.searchMetadata.mapToClass(SearchMetadataEntity);
  }

  /**
   * Initialize database with default config
   */
  async initialize() {
    try {
      const onboardingComplete = await this.config.get('onboarding_completed');
      
      if (!onboardingComplete) {
        // Set default configuration
        await this.setConfig('onboarding_completed', false);
        await this.setConfig('file_types', {
          audio: true,
          transcript_docx: true,
          transcript_json: true,
          summary: true
        });
        await this.setConfig('concurrent_downloads', 3);
        await this.setConfig('auto_retry', true);
        await this.setConfig('max_retries', 3);
        await this.setConfig('date_range_years', 3);
        await this.setConfig('theme', 'system');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * Helper method to get config value
   */
  async getConfig<T = any>(key: string): Promise<T | undefined> {
    const item = await this.config.get(key);
    return item?.value as T | undefined;
  }

  /**
   * Helper method to set config value
   */
  async setConfig(key: string, value: any): Promise<void> {
    await this.config.put({
      key,
      value,
      updated_at: Date.now()
    });
  }

  /**
   * Helper method to clear all data (for testing/reset)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.meetings, this.files, this.syncHistory, this.config, async () => {
      await this.meetings.clear();
      await this.files.clear();
      await this.syncHistory.clear();
      await this.config.clear();
    });
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const [total, synced, failed, syncing] = await Promise.all([
      this.meetings.count(),
      this.meetings.where('sync_status').equals('synced').count(),
      this.meetings.where('sync_status').equals('failed').count(),
      this.meetings.where('sync_status').equals('syncing').count()
    ]);

    return {
      total,
      synced,
      failed,
      syncing,
      not_synced: total - synced - failed - syncing
    };
  }

  /**
   * Get meetings by status
   */
  getMeetingsByStatus(status: Meeting['sync_status']) {
    return this.meetings.where('sync_status').equals(status).toArray();
  }

  /**
   * Get meetings in date range
   */
  getMeetingsInRange(fromDate: number, toDate: number) {
    return this.meetings
      .where('date')
      .between(fromDate, toDate, true, true)
      .toArray();
  }

  /**
   * Search meetings by title
   */
  async searchMeetings(query: string) {
    const allMeetings = await this.meetings.toArray();
    const lowerQuery = query.toLowerCase();
    return allMeetings.filter(m => 
      m.title.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get files for a meeting
   */
  getFilesByMeeting(meeting_id: string) {
    return this.files.where('meeting_id').equals(meeting_id).toArray();
  }

  /**
   * Log sync event
   */
  async logEvent(event_type: SyncEvent['event_type'], meeting_id?: string, details?: any) {
    await this.syncHistory.add({
      event_type,
      meeting_id,
      timestamp: Date.now(),
      details
    });
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100) {
    return this.syncHistory
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
  }
}

// Entity classes for better TypeScript support
class MeetingEntity implements Meeting {
  id!: string;
  title!: string;
  date!: number;
  duration!: number;
  organizer_email!: string;
  participants!: string[];
  transcript_url!: string;
  audio_url?: string;
  fireflies_users!: string[];
  created_at!: number;
  updated_at!: number;
  last_synced_at?: number;
  sync_status!: 'not_synced' | 'syncing' | 'synced' | 'failed';
  sync_error?: string;
  metadata?: Record<string, any>;
}

class FileRecordEntity implements FileRecord {
  id?: number;
  meeting_id!: string;
  file_type!: 'audio' | 'transcript_docx' | 'transcript_json' | 'summary';
  file_path!: string;
  file_size?: number;
  download_url?: string;
  status!: 'not_downloaded' | 'downloading' | 'downloaded' | 'failed';
  error_message?: string;
  downloaded_at?: number;
  checksum?: string;
}

class SyncEventEntity implements SyncEvent {
  id?: number;
  event_type!: 'sync_started' | 'meeting_downloaded' | 'sync_completed' | 'error';
  meeting_id?: string;
  timestamp!: number;
  details?: Record<string, any>;
}

class ConfigItemEntity implements ConfigItem {
  key!: string;
  value!: any;
  updated_at!: number;
}

class TranscriptContentEntity implements TranscriptContent {
  meeting_id!: string;
  text!: string;
  speakers!: string[];
  sentence_count!: number;
  word_count!: number;
  indexed_at!: number;
}

class SummaryContentEntity implements SummaryContent {
  meeting_id!: string;
  text!: string;
  overview?: string;
  action_items!: string[];
  outline!: string[];
  shorthand_bullet!: string[];
}

class SearchMetadataEntity implements SearchMetadata {
  meeting_id!: string;
  keywords!: string[];
  topics!: string[];
  speaker_names!: string[];
  extracted_at!: number;
}

// Export singleton instance
export const db = new FirefliesDatabase();

// Initialize on import
db.initialize().catch(console.error);

