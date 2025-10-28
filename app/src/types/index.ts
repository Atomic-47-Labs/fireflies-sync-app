// Core Type Definitions for Fireflies Downloader

export type SyncStatus = 'not_synced' | 'syncing' | 'synced' | 'failed';
export type FileType = 'audio' | 'transcript_docx' | 'transcript_json' | 'summary';
export type FileStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'failed';
export type EventType = 'sync_started' | 'meeting_downloaded' | 'sync_completed' | 'error';

export interface Meeting {
  id: string;                    // Primary key
  title: string;
  date: number;                  // Unix timestamp
  duration: number;              // seconds
  organizer_email: string;
  participants: string[];
  transcript_url: string;
  audio_url?: string;
  fireflies_users: string[];
  created_at: number;
  updated_at: number;
  last_synced_at?: number;
  sync_status: SyncStatus;
  sync_error?: string;
  metadata?: Record<string, any>;
}

export interface FileRecord {
  id?: number;                   // Auto-increment
  meeting_id: string;
  file_type: FileType;
  file_path: string;
  file_size?: number;
  download_url?: string;
  status: FileStatus;
  error_message?: string;
  downloaded_at?: number;
  checksum?: string;
}

export interface SyncEvent {
  id?: number;                   // Auto-increment
  event_type: EventType;
  meeting_id?: string;
  timestamp: number;
  details?: Record<string, any>;
}

export interface ConfigItem {
  key: string;                   // Primary key
  value: any;
  updated_at: number;
}

export interface FileTypePreferences {
  audio: boolean;
  transcript_docx: boolean;
  transcript_json: boolean;
  summary: boolean;
}

export interface AppConfig {
  api_key_encrypted?: string;
  api_key_valid?: boolean;
  user_email?: string;
  directory_handle?: any; // FileSystemDirectoryHandle (not directly serializable)
  directory_path_display?: string;
  file_types: FileTypePreferences;
  concurrent_downloads: number;
  auto_retry: boolean;
  max_retries: number;
  date_range_years: number;
  last_sync_timestamp?: number;
  onboarding_completed: boolean;
  theme?: 'light' | 'dark' | 'system';
}

export interface DownloadProgress {
  meeting_id: string;
  file_type: FileType;
  bytes_downloaded: number;
  total_bytes?: number;
  progress_percent: number;
  speed_bps?: number;
  eta_seconds?: number;
  started_at: number;
}

export interface BrowserCompatibility {
  isCompatible: boolean;
  browser: string;
  version: string;
  fileSystemAccessSupported: boolean;
  indexedDBSupported: boolean;
  requiredAPIs: {
    [key: string]: boolean;
  };
}

// Fireflies API Types
export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  dateString: string;
  duration: number;
  organizer_email: string;
  participants: string[];
  transcript_url: string;
  audio_url?: string;
  fireflies_users: string[];
  sentences?: TranscriptSentence[];
  summary?: TranscriptSummary;
}

export interface TranscriptSentence {
  text: string;
  speaker_name: string;
  start_time: number;
  end_time: number;
}

export interface TranscriptSummary {
  action_items?: string[];
  overview?: string;
  outline?: string[];
  shorthand_bullet?: string[];
  keywords?: string[];
}

export interface FirefliesUser {
  user_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  num_transcripts: number;
}

// Error Types
export class AppError extends Error {
  code: string;
  category: 'network' | 'api' | 'storage' | 'permission' | 'file';
  recoverable: boolean;
  
  constructor(
    message: string,
    code: string,
    category: 'network' | 'api' | 'storage' | 'permission' | 'file',
    recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.recoverable = recoverable;
  }
}

export class NetworkError extends AppError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, 'NETWORK_ERROR', 'network', recoverable);
    this.name = 'NetworkError';
  }
}

export class APIError extends AppError {
  statusCode?: number;
  
  constructor(message: string, statusCode?: number, recoverable: boolean = false) {
    super(message, 'API_ERROR', 'api', recoverable);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

export class RateLimitError extends AppError {
  retryAfter?: number;
  
  constructor(retryAfter?: number) {
    super('API rate limit exceeded', 'RATE_LIMIT', 'api', true);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 'api', false);
    this.name = 'AuthError';
  }
}

export class PermissionError extends AppError {
  constructor(message: string) {
    super(message, 'PERMISSION_ERROR', 'permission', true);
    this.name = 'PermissionError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, recoverable: boolean = false) {
    super(message, 'STORAGE_ERROR', 'storage', recoverable);
    this.name = 'StorageError';
  }
}

// Full-Text Search Types
export interface TranscriptContent {
  meeting_id: string;       // Primary key
  text: string;             // Full transcript text
  speakers: string[];       // Unique speaker names
  sentence_count: number;   // Number of sentences
  word_count: number;       // Total word count
  indexed_at: number;       // When this was indexed
}

export interface SummaryContent {
  meeting_id: string;       // Primary key
  text: string;             // Combined summary text for search
  overview?: string;        // Overview section
  action_items: string[];   // Action items
  outline: string[];        // Outline/topics
  shorthand_bullet: string[]; // Summary points
}

export interface SearchMetadata {
  meeting_id: string;       // Primary key
  keywords: string[];       // Extracted keywords
  topics: string[];         // Extracted topics
  speaker_names: string[];  // Speaker names
  extracted_at: number;     // When this was extracted
}

export interface SearchResult {
  meeting: Meeting;
  score: number;            // Relevance score
  highlights: string[];     // Highlighted text snippets
  matchType: 'title' | 'summary' | 'transcript' | 'keywords';
}

