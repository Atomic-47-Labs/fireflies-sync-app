// Application Constants

export const APP_NAME = 'Fireflies Transcript Downloader';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Download and manage your Fireflies meeting transcripts locally';

// API Configuration
export const FIREFLIES_API_URL = import.meta.env.VITE_FIREFLIES_API_URL || 'https://api.fireflies.ai/graphql';

// Rate Limiting (Business account: 60 req/min)
export const API_RATE_LIMIT = 60; // requests per minute
export const API_RATE_WINDOW = 60 * 1000; // 60 seconds in milliseconds
export const API_REQUEST_DELAY = 1000; // 1 second delay between requests (safe buffer)

// Download Configuration
export const DEFAULT_CONCURRENT_DOWNLOADS = 3;
export const MAX_CONCURRENT_DOWNLOADS = 10;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_DATE_RANGE_YEARS = 3;

// Retry Configuration
export const RETRY_BASE_DELAY = 1000; // 1 second
export const RETRY_MAX_DELAY = 30000; // 30 seconds
export const RETRY_MULTIPLIER = 2; // exponential backoff

// File Configuration
export const FILE_TYPES = {
  audio: { ext: '.mp3', name: 'Audio' },
  transcript_docx: { ext: '.docx', name: 'Transcript (Word)' },
  transcript_json: { ext: '.json', name: 'Transcript (JSON)' },
  summary: { ext: '.md', name: 'Summary (Markdown)' }
} as const;

export const METADATA_FILENAME = 'metadata.json';

// Storage Configuration
export const MIN_FREE_SPACE_WARNING_GB = 5; // Warn when less than 5GB free
export const ESTIMATED_AUDIO_SIZE_MB_PER_HOUR = 60; // ~1MB per minute of audio

// Browser Requirements
export const MINIMUM_BROWSER_VERSIONS = {
  Chrome: '86',
  Edge: '86',
  Opera: '72'
} as const;

export const SUPPORTED_BROWSERS = Object.keys(MINIMUM_BROWSER_VERSIONS);

// Path Configuration
export const MAX_PATH_LENGTH = 260; // Windows MAX_PATH limit
export const INVALID_PATH_CHARS = /[<>:"|?*\x00-\x1F]/g;
export const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

// UI Configuration
export const VIRTUALIZATION_THRESHOLD = 100; // Start virtualizing list at 100 items
export const DEBOUNCE_DELAY = 300; // 300ms for search input
export const PROGRESS_UPDATE_INTERVAL = 1000; // Update progress every 1 second

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  API_ERROR: 'Error communicating with Fireflies API.',
  RATE_LIMIT: 'API rate limit exceeded. Please wait a moment.',
  AUTH_ERROR: 'Authentication failed. Please check your API key.',
  PERMISSION_ERROR: 'File system permission denied. Please grant access to continue.',
  STORAGE_ERROR: 'Storage error occurred. Please check available disk space.',
  INVALID_API_KEY: 'Invalid API key. Please check and try again.',
  NO_DIRECTORY_SELECTED: 'No download directory selected. Please select a directory.',
  BROWSER_NOT_SUPPORTED: 'Your browser is not supported. Please use Chrome, Edge, or Opera.',
  FILE_SYSTEM_API_NOT_AVAILABLE: 'File System Access API is not available in this browser.'
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  MEETING_DOWNLOADED: 'Meeting downloaded successfully',
  SYNC_COMPLETED: 'Sync completed successfully',
  API_KEY_VALIDATED: 'API key validated successfully',
  DIRECTORY_SELECTED: 'Download directory selected',
  SETTINGS_SAVED: 'Settings saved successfully'
} as const;

// Local Storage Keys (for non-IndexedDB data)
export const STORAGE_KEYS = {
  THEME: 'ff-downloader-theme',
  LAST_DIRECTORY_PATH: 'ff-downloader-last-path'
} as const;

// Theme
export const THEMES = ['light', 'dark', 'system'] as const;

// Date Formats
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const FOLDER_DATE_FORMAT = 'YYYY-MM-DD';

// Pagination
export const MEETINGS_PER_PAGE = 50;
export const MAX_MEETINGS_TO_FETCH = 10000; // Safety limit

// Testing/Development
export const IS_DEV = import.meta.env.DEV;
export const IS_PROD = import.meta.env.PROD;

// Feature Flags
export const FEATURES = {
  ENABLE_NOTIFICATIONS: true,
  ENABLE_PWA: true,
  ENABLE_ANALYTICS: false,
  ENABLE_ERROR_REPORTING: IS_PROD
} as const;

