# Product Requirements Document (PRD)
# Fireflies Transcript Downloader & File Manager

**Version:** 1.0  
**Last Updated:** September 30, 2025  
**Status:** Requirements Definition  
**Owner:** Product Team  

---

## 1. Executive Summary

### 1.1 Purpose
This document defines the requirements for building a web application that enables Fireflies.ai business account users to download, manage, and synchronize their complete meeting history locally. The application will run directly in Chrome/Edge browsers, use IndexedDB (Dexie.js) for local state management, and leverage the File System Access API to save files directly to the user's hard drive. The application will handle bulk downloads of transcripts, audio files, and AI summaries for up to 3 years of historical data.

### 1.2 Scope
**In Scope:**
- Modern web application (Progressive Web App)
- Runs in Chrome 86+, Edge 86+, Opera 72+
- Download management for 4 file types per meeting (MP3, DOCX, JSON, MD)
- IndexedDB (Dexie.js) for local catalog and state management
- File System Access API for saving files to user-selected directory
- Sync status tracking and visualization
- Progress monitoring and reporting
- Resume/restart capabilities
- File organization and storage management
- Connection to Fireflies.ai GraphQL API
- PWA installability for desktop-like experience

**Out of Scope (Future Versions):**
- Support for Firefox and Safari (until File System Access API is available)
- Native desktop application packaging
- Automated scheduled syncs running in background when browser closed
- Cloud backup integration
- Full-text search within transcripts
- Meeting analytics dashboard
- Multi-account management
- Mobile applications (requires different approach)

### 1.3 Success Criteria
- Successfully download and organize 3 years of meeting data
- Achieve >99% download success rate
- Complete initial sync of 1000 meetings in <24 hours
- User can restart failed downloads without re-downloading successful ones
- Clear visibility into sync status for all meetings

---

## 2. Goals and Objectives

### 2.1 Business Goals
1. Enable enterprise customers to maintain local archives for compliance
2. Reduce customer churn by providing data portability
3. Differentiate Fireflies offering with enterprise-grade data management
4. Support disaster recovery and business continuity requirements

### 2.2 User Goals
1. Backup entire meeting history with minimal manual effort
2. Maintain organized, accessible local archives
3. Know exactly what's synced and what isn't
4. Recover from failed downloads easily
5. Access meeting data offline

### 2.3 Technical Goals
1. Handle API rate limits gracefully (60 req/min for business accounts)
2. Support large-scale downloads (1000+ meetings)
3. Provide robust error handling and recovery
4. Maintain data integrity throughout download process
5. Optimize for network efficiency and storage
6. Leverage modern web APIs (File System Access, IndexedDB)
7. Ensure browser responsiveness during downloads
8. Provide PWA experience comparable to native apps
9. Handle browser storage quotas and permissions effectively

---

## 3. User Personas

### 3.1 Primary Persona: Enterprise Compliance Manager
**Name:** Sarah Chen  
**Role:** Compliance Manager at 500-person SaaS company  
**Goals:**
- Maintain complete local archives of all company meetings
- Meet regulatory compliance requirements
- Ensure data availability for audits
- Manage data retention policies

**Pain Points:**
- No automated way to backup meeting data
- Concerns about cloud vendor lock-in
- Need proof of data retention
- Manual downloads are not scalable

### 3.2 Secondary Persona: Business Operations Lead
**Name:** Marcus Rodriguez  
**Role:** Director of Business Operations at consulting firm  
**Goals:**
- Access meeting transcripts offline during travel
- Organize meeting data by project/client
- Quick recovery if cloud service has issues
- Share meeting archives with team

**Pain Points:**
- Unreliable internet in some client locations
- Need offline access to historical meetings
- Want local backup "just in case"
- Current process is too manual

### 3.3 Tertiary Persona: IT Administrator
**Name:** Jennifer Park  
**Role:** IT Admin at enterprise organization  
**Goals:**
- Manage data across multiple cloud services
- Implement company-wide backup policies
- Monitor storage and compliance
- Support users with data access needs

**Pain Points:**
- No programmatic backup solution
- Difficult to monitor sync status across team
- Need to ensure all data is backed up
- Want automated, reliable process

---

## 4. User Stories and Use Cases

### 4.1 Epic 1: Initial Setup and Configuration

**US-1.0:** As a user, I want to know if my browser is compatible, so that I understand if I can use the application.  
**Acceptance Criteria:**
- Application detects browser and version on load
- Shows clear compatibility message if browser doesn't support File System Access API
- Recommends Chrome or Edge if unsupported browser detected
- Provides link to download compatible browser
- Shows green checkmark if browser is compatible

**US-1.1:** As a user, I want to connect the application to my Fireflies account using an API key, so that I can access my meeting data.  
**Acceptance Criteria:**
- User can input API key through settings UI
- Application validates API key with Fireflies API
- Invalid keys show clear error messages
- API key is stored securely in IndexedDB (encrypted)
- User can update or change API key later
- API key persists across browser sessions

**US-1.2:** As a user, I want to select where downloaded files will be stored, so that I can organize them according to my preferences.  
**Acceptance Criteria:**
- User can trigger directory picker via File System Access API
- Application requests read/write permission for selected directory
- Shows warning if browser doesn't have sufficient permissions
- Directory handle stored in IndexedDB for future sessions
- Can change storage location later (with option to move existing files)
- Shows current selected directory path in settings
- Option to start in Desktop or Documents folder

**US-1.3:** As a user, I want to configure which file types to download, so that I can save storage space if I don't need all formats.  
**Acceptance Criteria:**
- Checkboxes for: Audio (MP3), Transcript Doc (DOCX), Transcript JSON, Summary (MD)
- At least one format must be selected
- Settings persist across sessions
- Can change selections and re-sync

### 4.2 Epic 2: Meeting Discovery and Catalog
**US-2.1:** As a user, I want to see a complete list of all my meetings from the past 3 years, so that I know what's available to download.  
**Acceptance Criteria:**
- Application fetches complete meeting list via API
- Displays meetings in table/list view
- Shows: Title, Date, Duration, Participants, Sync Status
- Handles pagination for large meeting lists (1000+ meetings)
- Updates local database with meeting metadata

**US-2.2:** As a user, I want to filter meetings by date range, so that I can sync specific time periods.  
**Acceptance Criteria:**
- Date range picker (From/To dates)
- Filter applies to meeting list view
- Can clear filters to show all meetings
- Filter state persists during session

**US-2.3:** As a user, I want to search meetings by title, so that I can find specific meetings quickly.  
**Acceptance Criteria:**
- Search box with real-time filtering
- Case-insensitive search
- Searches meeting title field
- Shows match count
- Can clear search

### 4.3 Epic 3: Download Management
**US-3.1:** As a user, I want to download all meetings with one click, so that I can backup my entire history easily.  
**Acceptance Criteria:**
- "Sync All" button prominently displayed
- Starts download queue for all unsynced meetings
- Shows confirmation dialog with count of meetings to sync
- Can cancel before download starts

**US-3.2:** As a user, I want to see real-time progress for each download, so that I know what's happening.  
**Acceptance Criteria:**
- Progress bar for each meeting being downloaded
- Shows current file being downloaded (e.g., "Downloading audio...")
- Displays download speed (KB/s or MB/s)
- Shows estimated time remaining
- Updates at least once per second

**US-3.3:** As a user, I want to see overall progress across all downloads, so that I know when sync will complete.  
**Acceptance Criteria:**
- Overall progress indicator (e.g., "45 of 200 meetings synced")
- Overall progress bar
- Total estimated time remaining
- Total data downloaded / to be downloaded
- Current download rate

**US-3.4:** As a user, I want downloads to continue while I work in other tabs, so that I can multitask.  
**Acceptance Criteria:**
- Downloads continue when user switches to other tabs
- Page title shows sync progress (e.g., "⟳ 45/200 - Fireflies Downloader")
- Browser notification when sync completes
- Option to install as PWA for standalone window experience
- Warning if user tries to close browser during active downloads

**US-3.5:** As a user, I want to pause and resume downloads, so that I can manage network usage.  
**Acceptance Criteria:**
- Pause button stops all active downloads
- Current downloads complete before pausing
- Resume button continues from where it stopped
- State persists if application is closed while paused

**US-3.6:** As a user, I want to restart individual failed downloads, so that I don't have to re-download everything.  
**Acceptance Criteria:**
- Failed meetings show "Failed" status with error reason
- "Retry" button/action on failed meetings
- Can retry individual meeting or batch retry all failed
- Successful downloads are not affected by retries

**US-3.7:** As a user, I want to be prompted to restore directory access when I return, so that I don't lose my sync configuration.  
**Acceptance Criteria:**
- Application checks for stored directory handle on load
- Verifies permission is still granted
- Prompts user to re-grant permission if needed
- Shows clear message explaining why permission is needed
- Allows user to select different directory if desired
- Gracefully handles permission denial

### 4.4 Epic 4: Sync Status and Monitoring
**US-4.1:** As a user, I want to see which meetings are synced vs. not synced, so that I know what's backed up.  
**Acceptance Criteria:**
- Status column with clear indicators:
  - ✓ Synced (green)
  - ⟳ Syncing (blue/animated)
  - ✗ Failed (red)
  - ○ Not Synced (gray)
- Can sort by sync status
- Can filter to show only unsynced or failed meetings

**US-4.2:** As a user, I want to see detailed status for each file type, so that I know if partial downloads occurred.  
**Acceptance Criteria:**
- Expandable detail view showing status per file type
- Shows which specific files are downloaded (MP3, DOCX, JSON, MD)
- Indicates if any file type failed while others succeeded
- Can retry specific file types

**US-4.3:** As a user, I want to see a sync history log, so that I can audit what happened.  
**Acceptance Criteria:**
- Log view showing chronological list of sync events
- Events include: Sync started, Meeting downloaded, Errors, Sync completed
- Timestamps for all events
- Can export log to text file
- Log persists across sessions

**US-4.4:** As a user, I want to be notified of new meetings since last sync, so that I can keep my archive current.  
**Acceptance Criteria:**
- "Check for New Meetings" button
- Automatic check on application startup
- Shows count of new meetings found
- Option to auto-sync new meetings
- Badge/indicator showing unsynced count

### 4.5 Epic 5: File Organization
**US-5.1:** As a user, I want files organized in a logical folder structure, so that I can find them easily.  
**Acceptance Criteria:**
- Folder structure: `{root}/{year}/{month}/{date}_{meeting-title}/`
- Files named consistently within each meeting folder
- Invalid filename characters handled (replaced with underscore)
- Maximum path length respected (Windows 260 char limit)

**US-5.2:** As a user, I want metadata preserved with downloads, so that I have context for each meeting.  
**Acceptance Criteria:**
- Metadata JSON file in each meeting folder
- Contains: Meeting ID, Title, Date, Duration, Participants, Organizer
- Original API response timestamp
- Download timestamp

**US-5.3:** As a user, I want to open the download folder from the app, so that I can access files quickly.  
**Acceptance Criteria:**
- "Open Folder" button in main UI
- Opens root download folder in system file explorer
- "Open" action on individual meetings opens that meeting's folder

### 4.6 Epic 6: Error Handling and Recovery
**US-6.1:** As a user, I want clear error messages when downloads fail, so that I can take appropriate action.  
**Acceptance Criteria:**
- Error messages categorized by type:
  - Network errors
  - API errors (rate limit, auth, not found)
  - Disk errors (out of space, permission)
  - File errors (corrupt download)
- Each error shows suggested resolution
- Errors logged to file for troubleshooting

**US-6.2:** As a user, I want automatic retry on transient failures, so that temporary issues don't require manual intervention.  
**Acceptance Criteria:**
- Network timeouts retry automatically (3 attempts)
- Rate limit errors wait and retry automatically
- Exponential backoff between retries
- User can disable auto-retry in settings

**US-6.3:** As a user, I want to resume downloads after application crash or restart, so that I don't lose progress.  
**Acceptance Criteria:**
- Application state persisted to database
- On startup, detects incomplete downloads
- Prompts user to resume or start fresh
- Partial files cleaned up before resuming
- Download queue reconstructed from last state

### 4.7 Epic 7: Storage Management
**US-7.1:** As a user, I want to see how much disk space is being used, so that I can manage storage.  
**Acceptance Criteria:**
- Storage stats displayed in UI:
  - Total size of downloaded files
  - Available disk space
  - Estimated size for pending downloads
- Updates in real-time during downloads
- Warning when disk space <5GB remaining

**US-7.2:** As a user, I want to selectively delete downloaded meetings, so that I can free up space.  
**Acceptance Criteria:**
- Select multiple meetings to delete
- Confirmation dialog before deletion
- Deletes files from disk and marks as not synced in database
- Can re-download deleted meetings later
- Deleted count and space freed shown

---

## 5. Functional Requirements

### 5.1 Authentication and Authorization
**FR-1.1:** Application SHALL authenticate with Fireflies API using Bearer token authentication  
**FR-1.2:** Application SHALL validate API key before allowing operations  
**FR-1.3:** Application SHALL store API key encrypted in IndexedDB  
**FR-1.4:** Application SHALL handle auth failures gracefully with clear messages  
**FR-1.5:** Application SHALL support Business account tier rate limits (60 req/min)  
**FR-1.6:** Application SHALL persist authentication state across browser sessions  
**FR-1.7:** Application SHALL clear stored credentials on explicit user logout

### 5.2 Meeting Discovery
**FR-2.1:** Application SHALL fetch all transcripts from past 3 years using `transcripts` query  
**FR-2.2:** Application SHALL handle pagination for large meeting lists (>50 meetings)  
**FR-2.3:** Application SHALL store meeting metadata in IndexedDB using Dexie.js  
**FR-2.4:** Application SHALL detect new meetings since last sync  
**FR-2.5:** Application SHALL support filtering by date range  
**FR-2.6:** Application SHALL support searching by meeting title  
**FR-2.7:** Application SHALL query IndexedDB efficiently with indexed fields  
**FR-2.8:** Application SHALL handle IndexedDB storage quota limits gracefully

### 5.3 File Download
**FR-3.1:** Application SHALL download audio files (MP3) using `audio_url` field via fetch API  
**FR-3.2:** Application SHALL generate transcript documents (DOCX) from transcript data  
**FR-3.3:** Application SHALL generate transcript JSON using `sentences` field  
**FR-3.4:** Application SHALL generate summary markdown using `summary` fields  
**FR-3.5:** Application SHALL support concurrent downloads (configurable, default 3)  
**FR-3.6:** Application SHALL verify file integrity after download (file size check)  
**FR-3.7:** Application SHALL use File System Access API to write files to user-selected directory  
**FR-3.8:** Application SHALL respect API rate limits (60 req/min)  
**FR-3.9:** Application SHALL handle large file downloads with progress tracking  
**FR-3.10:** Application SHALL create directory structure using File System Access API  
**FR-3.11:** Application SHALL verify directory write permissions before starting downloads  
**FR-3.12:** Application SHALL handle browser permission prompts gracefully

### 5.4 Progress Tracking
**FR-4.1:** Application SHALL display real-time progress for each active download  
**FR-4.2:** Application SHALL display overall sync progress (meetings synced / total)  
**FR-4.3:** Application SHALL calculate and display download speed  
**FR-4.4:** Application SHALL estimate time remaining for active downloads  
**FR-4.5:** Application SHALL persist progress state to database  
**FR-4.6:** Application SHALL emit progress events for UI updates

### 5.5 Sync Status Management
**FR-5.1:** Application SHALL track sync status for each meeting (not_synced, syncing, synced, failed)  
**FR-5.2:** Application SHALL track sync status for each file type within a meeting  
**FR-5.3:** Application SHALL persist sync status to IndexedDB  
**FR-5.4:** Application SHALL update sync status in real-time as downloads complete  
**FR-5.5:** Application SHALL detect and mark orphaned/incomplete downloads on startup  
**FR-5.6:** Application SHALL use Dexie.js transactions for atomic status updates  
**FR-5.7:** Application SHALL maintain referential integrity between meetings and files tables

### 5.6 File Organization
**FR-6.1:** Application SHALL organize files in structure: `{root}/{year}/{month}/{date}_{title}/`  
**FR-6.2:** Application SHALL sanitize filenames to remove invalid characters  
**FR-6.3:** Application SHALL create metadata JSON file for each meeting  
**FR-6.4:** Application SHALL use consistent naming: `audio.mp3`, `transcript.docx`, `transcript.json`, `summary.md`  
**FR-6.5:** Application SHALL handle filename collisions (append number if duplicate)  
**FR-6.6:** Application SHALL use File System Access API getDirectoryHandle() to create nested folders  
**FR-6.7:** Application SHALL handle path length limitations across operating systems  
**FR-6.8:** Application SHALL store file paths relative to root in IndexedDB

### 5.7 Error Handling
**FR-7.1:** Application SHALL retry transient network errors automatically (3 attempts)  
**FR-7.2:** Application SHALL implement exponential backoff for retries  
**FR-7.3:** Application SHALL handle rate limit errors by waiting and retrying  
**FR-7.4:** Application SHALL log all errors with timestamp and context  
**FR-7.5:** Application SHALL categorize errors by type (network, api, disk, file)  
**FR-7.6:** Application SHALL display actionable error messages to user

### 5.8 Recovery and Resume
**FR-8.1:** Application SHALL detect incomplete downloads on startup from IndexedDB state  
**FR-8.2:** Application SHALL prompt user to resume or restart on recovery  
**FR-8.3:** Application SHALL verify directory permissions still valid on resume  
**FR-8.4:** Application SHALL reconstruct download queue from last IndexedDB state  
**FR-8.5:** Application SHALL allow manual restart of failed downloads  
**FR-8.6:** Application SHALL handle browser tab refresh gracefully  
**FR-8.7:** Application SHALL persist download state across browser sessions  
**FR-8.8:** Application SHALL warn user before leaving page during active downloads

### 5.9 Storage Management
**FR-9.1:** Application SHALL estimate disk space needed for pending downloads  
**FR-9.2:** Application SHALL calculate total size of downloaded files from metadata  
**FR-9.3:** Application SHALL display storage statistics in UI  
**FR-9.4:** Application SHALL support deletion of downloaded files with IndexedDB cleanup  
**FR-9.5:** Application SHALL use Storage API to query available browser storage quota  
**FR-9.6:** Application SHALL warn user when IndexedDB approaches quota limits  
**FR-9.7:** Application SHALL handle QuotaExceededError gracefully

---

## 6. Non-Functional Requirements

### 6.1 Performance
**NFR-1.1:** Application SHALL download 100 meetings in <2 hours on typical broadband connection (50 Mbps)  
**NFR-1.2:** Application SHALL support querying 5000+ meetings without UI lag  
**NFR-1.3:** Application UI SHALL remain responsive during background downloads  
**NFR-1.4:** Application SHALL load initial page in <2 seconds on typical connection  
**NFR-1.5:** IndexedDB queries SHALL complete in <500ms for typical operations  
**NFR-1.6:** Application SHALL render meeting list with virtualization for 1000+ items  
**NFR-1.7:** File writes via File System Access API SHALL not block UI thread

### 6.2 Scalability
**NFR-2.1:** Application SHALL support downloading 10,000+ meetings  
**NFR-2.2:** Application SHALL handle meetings with 100+ participants  
**NFR-2.3:** Application SHALL support audio files up to 1.5GB  
**NFR-2.4:** IndexedDB SHALL efficiently store metadata for 10,000+ meetings  
**NFR-2.5:** Application SHALL handle browser storage quota limits (typically >1GB)  
**NFR-2.6:** Application SHALL support concurrent file writes via File System Access API

### 6.3 Reliability
**NFR-3.1:** Application SHALL achieve >99% download success rate under normal conditions  
**NFR-3.2:** Application SHALL recover gracefully from browser tab refresh  
**NFR-3.3:** Application SHALL not corrupt IndexedDB on unexpected page unload  
**NFR-3.4:** Application SHALL verify file integrity after downloads  
**NFR-3.5:** Application SHALL maintain data consistency between IndexedDB and filesystem  
**NFR-3.6:** Application SHALL handle browser tab suspension gracefully  
**NFR-3.7:** Application SHALL persist critical state before page unload events

### 6.4 Usability
**NFR-4.1:** Application SHALL require <5 minutes for initial setup  
**NFR-4.2:** Primary workflows SHALL require <3 clicks  
**NFR-4.3:** Error messages SHALL be clear and actionable for non-technical users  
**NFR-4.4:** Application SHALL follow web accessibility standards (WCAG 2.1 AA)  
**NFR-4.5:** Application SHALL support keyboard shortcuts for common actions  
**NFR-4.6:** Application SHALL be responsive and work on different screen sizes  
**NFR-4.7:** Application SHALL provide clear onboarding for browser compatibility and permissions

### 6.5 Security
**NFR-5.1:** Application SHALL encrypt API key in IndexedDB using Web Crypto API  
**NFR-5.2:** Application SHALL not log API keys to browser console  
**NFR-5.3:** Application SHALL use HTTPS for all API communications  
**NFR-5.4:** Application SHALL validate SSL certificates  
**NFR-5.5:** Application SHALL clear sensitive data from memory when not needed  
**NFR-5.6:** Application SHALL leverage browser's same-origin policy for security  
**NFR-5.7:** Application SHALL implement Content Security Policy (CSP)  
**NFR-5.8:** Application SHALL not expose sensitive data in URL parameters

### 6.6 Compatibility
**NFR-6.1:** Application SHALL support Chrome 86+ (primary)  
**NFR-6.2:** Application SHALL support Edge 86+ (primary)  
**NFR-6.3:** Application SHALL support Opera 72+ (secondary)  
**NFR-6.4:** Application SHALL detect unsupported browsers and show helpful message  
**NFR-6.5:** Application SHALL support Fireflies API v2.0+  
**NFR-6.6:** Application SHALL handle API version changes gracefully  
**NFR-6.7:** Application SHALL be installable as PWA on supported platforms  
**NFR-6.8:** Application SHALL work on Windows, macOS, and Linux (via supported browsers)  
**NFR-6.9:** Application SHALL gracefully degrade if File System Access API becomes unavailable

### 6.7 Maintainability
**NFR-7.1:** Code SHALL have >80% test coverage  
**NFR-7.2:** Application SHALL log sufficient detail for troubleshooting  
**NFR-7.3:** Configuration SHALL be centralized and easily modifiable  
**NFR-7.4:** Application SHALL include version number and build info  
**NFR-7.5:** Updates SHALL be deployable without data loss

---

## 7. Technical Requirements

### 7.1 Architecture
**Platform:** Progressive Web Application (PWA)  
**Frontend Framework:** React 18+ or Vue 3+  
**State Management:** Zustand or Redux Toolkit  
**Database:** IndexedDB via Dexie.js 3.x  
**File Storage:** File System Access API  
**API:** Fireflies.ai GraphQL API (https://api.fireflies.ai/graphql)  
**Build Tool:** Vite 4+  
**Language:** TypeScript  
**Styling:** Tailwind CSS + shadcn/ui or similar component library  

### 7.2 Browser APIs Used

#### 7.2.1 File System Access API
```javascript
// Core operations needed
window.showDirectoryPicker()           // Select storage directory
DirectoryHandle.getDirectoryHandle()   // Create/access subdirectories
DirectoryHandle.getFileHandle()        // Create/access files
FileSystemWritableFileStream           // Write file content
DirectoryHandle.queryPermission()      // Check permission status
DirectoryHandle.requestPermission()    // Request permission
```

#### 7.2.2 IndexedDB via Dexie.js
```javascript
// Database wrapper for type-safe operations
import Dexie from 'dexie';

class FirefliesDb extends Dexie {
  meetings: Dexie.Table<Meeting, string>;
  files: Dexie.Table<FileRecord, number>;
  syncHistory: Dexie.Table<SyncEvent, number>;
  config: Dexie.Table<ConfigItem, string>;
}
```

#### 7.2.3 Web Crypto API
```javascript
// For encrypting API key
crypto.subtle.encrypt()
crypto.subtle.decrypt()
crypto.getRandomValues()
```

#### 7.2.4 Fetch API
```javascript
// For downloading files and API calls
fetch(url, options)
ReadableStream
```

#### 7.2.5 Web Workers (Optional)
```javascript
// For offloading heavy processing
new Worker('download-worker.js')
postMessage()
onmessage
```

### 7.3 Data Model

#### 7.3.1 IndexedDB Schema (Dexie.js)

**TypeScript Interfaces:**
```typescript
interface Meeting {
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
  sync_status: 'not_synced' | 'syncing' | 'synced' | 'failed';
  sync_error?: string;
  metadata?: Record<string, any>;
}

interface FileRecord {
  id?: number;                   // Auto-increment
  meeting_id: string;
  file_type: 'audio' | 'transcript_docx' | 'transcript_json' | 'summary';
  file_path: string;
  file_size?: number;
  download_url?: string;
  status: 'not_downloaded' | 'downloading' | 'downloaded' | 'failed';
  error_message?: string;
  downloaded_at?: number;
  checksum?: string;
}

interface SyncEvent {
  id?: number;                   // Auto-increment
  event_type: 'sync_started' | 'meeting_downloaded' | 'sync_completed' | 'error';
  meeting_id?: string;
  timestamp: number;
  details?: Record<string, any>;
}

interface ConfigItem {
  key: string;                   // Primary key
  value: any;
  updated_at: number;
}
```

**Dexie Schema Definition:**
```typescript
const db = new Dexie('FirefliesDownloader') as FirefliesDb;

db.version(1).stores({
  meetings: 'id, title, date, syncStatus, organizer_email, *participants',
  files: '++id, meeting_id, file_type, status, downloaded_at',
  syncHistory: '++id, timestamp, event_type, meeting_id',
  config: 'key'
});
```

#### 7.3.2 Configuration Storage in IndexedDB

**Config Keys:**
```typescript
{
  'api_key_encrypted': string,           // Encrypted API key
  'directory_handle': FileSystemDirectoryHandle,  // Serialized handle
  'download_path_display': string,       // For UI display only
  'file_types_enabled': {
    audio: boolean,
    transcript_docx: boolean,
    transcript_json: boolean,
    summary: boolean
  },
  'concurrent_downloads': number,        // Default: 3
  'auto_retry': boolean,                 // Default: true
  'max_retries': number,                 // Default: 3
  'date_range_years': number,            // Default: 3
  'last_sync_timestamp': number,
  'onboarding_completed': boolean
}
```

### 7.3 API Integration

#### 7.3.1 Required GraphQL Queries

**Query 1: Fetch All Transcripts**
```graphql
query GetTranscripts($fromDate: String, $toDate: String, $limit: Int, $skip: Int) {
  transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, skip: $skip) {
    id
    title
    date
    dateString
    duration
    organizer_email
    participants
    transcript_url
    audio_url
    fireflies_users
  }
}
```

**Query 2: Fetch Single Transcript Details**
```graphql
query GetTranscript($id: String!) {
  transcript(id: $id) {
    id
    title
    date
    dateString
    duration
    organizer_email
    participants
    transcript_url
    audio_url
    sentences {
      text
      speaker_name
      start_time
      end_time
    }
    summary {
      action_items
      overview
      outline
      shorthand_bullet
      keywords
    }
  }
}
```

**Query 3: Get User Info** (for validation)
```graphql
query GetUser {
  user {
    user_id
    name
    email
    is_admin
    num_transcripts
  }
}
```

#### 7.3.2 API Rate Limiting
- Business accounts: 60 requests/minute
- Implement token bucket algorithm
- Queue requests when approaching limit
- Add 1-second delay between requests to stay safe

#### 7.3.3 File Downloads
- Audio: Direct download from `audio_url` field (requires Business/Enterprise plan)
- Transcript DOCX: May need to use web export or generate from JSON
- Transcript JSON: Construct from `sentences` field
- Summary MD: Construct from `summary` fields

### 7.4 File Format Specifications

#### 7.4.1 Transcript JSON Format
```json
{
  "meeting_id": "transcript_id",
  "title": "Meeting Title",
  "date": "2025-09-30T10:00:00Z",
  "duration": 3600,
  "organizer": "user@example.com",
  "participants": ["user1@example.com", "user2@example.com"],
  "sentences": [
    {
      "speaker_name": "John Doe",
      "text": "Hello everyone",
      "start_time": 0.0,
      "end_time": 2.5
    }
  ]
}
```

#### 7.4.2 Summary Markdown Format
```markdown
# Meeting Title
**Date:** September 30, 2025
**Duration:** 60 minutes
**Organizer:** user@example.com
**Participants:** user1@example.com, user2@example.com

## Overview
[Overview text from API]

## Action Items
- [Action item 1]
- [Action item 2]

## Key Topics
- [Topic 1]
- [Topic 2]

## Keywords
keyword1, keyword2, keyword3
```

#### 7.4.3 Metadata JSON Format
```json
{
  "meeting_id": "transcript_id",
  "title": "Meeting Title",
  "date": "2025-09-30T10:00:00Z",
  "duration_seconds": 3600,
  "organizer_email": "user@example.com",
  "participants": ["user1@example.com", "user2@example.com"],
  "fireflies_users": ["user1@example.com"],
  "transcript_url": "https://app.fireflies.ai/view/...",
  "downloaded_at": "2025-09-30T15:30:00Z",
  "files": {
    "audio": "audio.mp3",
    "transcript_docx": "transcript.docx",
    "transcript_json": "transcript.json",
    "summary": "summary.md"
  }
}
```

### 7.5 Folder Structure
```
{download_root}/
├── 2025/
│   ├── 09/
│   │   ├── 2025-09-30_weekly-standup/
│   │   │   ├── audio.mp3
│   │   │   ├── transcript.docx
│   │   │   ├── transcript.json
│   │   │   ├── summary.md
│   │   │   └── metadata.json
│   │   └── 2025-09-30_client-call/
│   │       └── [files...]
│   └── 10/
│       └── [meetings...]
├── 2024/
│   └── [months...]
└── 2023/
    └── [months...]
```

### 7.6 Application State Management

**State Location:** IndexedDB (via Dexie.js) + React Context/Zustand

**Persistent State (IndexedDB):**
```typescript
{
  // Authentication
  api_key_encrypted: string,
  api_key_valid: boolean,
  user_email: string,
  
  // File System
  directory_handle: FileSystemDirectoryHandle,
  directory_path_display: string,
  
  // Preferences
  file_types: {
    audio: boolean,
    transcript_docx: boolean,
    transcript_json: boolean,
    summary: boolean
  },
  concurrent_downloads: number,
  auto_retry: boolean,
  max_retries: number,
  
  // Sync State
  last_sync_timestamp: number,
  total_meetings: number,
  synced_meetings: number,
  
  // UI State
  onboarding_completed: boolean,
  theme: 'light' | 'dark' | 'system'
}
```

**Runtime State (React State/Zustand):**
```typescript
interface AppState {
  // Auth
  isAuthenticated: boolean;
  apiKey: string | null;
  
  // Directory
  directoryHandle: FileSystemDirectoryHandle | null;
  hasDirectoryPermission: boolean;
  
  // Meetings
  meetings: Meeting[];
  filteredMeetings: Meeting[];
  selectedMeetings: Set<string>;
  
  // Download Queue
  downloadQueue: string[];
  activeDownloads: Map<string, DownloadProgress>;
  
  // UI
  searchQuery: string;
  dateFilter: { from: Date | null; to: Date | null };
  statusFilter: SyncStatus | 'all';
  isLoading: boolean;
  error: string | null;
}
```

---

## 8. User Interface Requirements

### 8.1 Browser Compatibility Screen (First Visit)
```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│              🔍 Browser Compatibility Check              │
│                                                          │
│  ✅ Your browser supports this application!             │
│                                                          │
│  Browser: Chrome 120.0                                  │
│  File System Access API: ✓ Supported                   │
│  IndexedDB: ✓ Supported                                │
│                                                          │
│           [Continue to Application →]                   │
│                                                          │
│  Note: This app requires Chrome 86+, Edge 86+, or      │
│  Opera 72+ to save files to your computer.             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**If Unsupported Browser:**
```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│              ⚠️  Unsupported Browser                     │
│                                                          │
│  This application requires a Chromium-based browser     │
│  with File System Access API support.                   │
│                                                          │
│  ✅ Chrome 86+                                          │
│  ✅ Edge 86+                                            │
│  ✅ Opera 72+                                           │
│                                                          │
│  ❌ Firefox (not yet supported)                         │
│  ❌ Safari (not yet supported)                          │
│                                                          │
│       [Download Chrome] [Download Edge]                 │
│                                                          │
│  Why? This app needs to save files directly to your    │
│  computer, which requires the File System Access API.   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Main Window Layout
```
┌─────────────────────────────────────────────────────────┐
│ [Menu Bar]                                   [− □ ×]    │
├─────────────────────────────────────────────────────────┤
│ [Fireflies Transcript Manager]                          │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Status Bar:                                         │ │
│ │ Connected: user@example.com                         │ │
│ │ Last Sync: 2 hours ago | New Meetings: 5           │ │
│ │ Storage: 15.3 GB used | 450 GB available           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Sync All] [Check for New] [Settings] [Open Folder]│ │
│ │ Search: [____________] Date Range: [From] [To]     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Overall Progress                                    │ │
│ │ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  45 of 200 meetings synced   │ │
│ │ Estimated time remaining: 2h 15m                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Meeting List                                        │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ ✓ | 2025-09-30 | Weekly Standup      | 45min │   │ │
│ │ │ ⟳ | 2025-09-30 | Client Review       | 60min │   │ │
│ │ │   ▓▓▓▓▓░░░░░░░░ Downloading audio... 45%     │   │ │
│ │ │ ○ | 2025-09-29 | Team Planning       | 30min │   │ │
│ │ │ ✗ | 2025-09-29 | Product Sync        | 60min │   │ │
│ │ │   Error: Network timeout - [Retry]           │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Activity Log] [Settings] [About]                       │
└─────────────────────────────────────────────────────────┘
```

### 8.2 UI Components

#### 8.2.1 Status Bar (Top)
- Connection status with user email
- Last sync timestamp
- New meetings indicator (badge with count)
- Storage usage and available space

#### 8.2.2 Action Buttons
- **Sync All**: Start syncing all unsynced meetings
- **Check for New**: Query API for new meetings since last check
- **Settings**: Open settings dialog
- **Open Folder**: Open download root in file explorer

#### 8.2.3 Filter Controls
- Search box (live filtering by title)
- Date range picker (From/To dates)
- Status filter dropdown (All, Synced, Not Synced, Failed)
- Clear filters button

#### 8.2.4 Progress Indicators
- Overall progress bar with percentage
- Meetings synced count (e.g., "45 of 200")
- Estimated time remaining
- Current download rate (MB/s)

#### 8.2.5 Meeting List Table
**Columns:**
- Status icon (✓ ⟳ ✗ ○)
- Date
- Title (clickable to expand details)
- Duration
- Actions (Retry button for failed, Open folder button for synced)

**Expandable Row Details:**
- Organizer and participants
- File-level status (audio, docx, json, md)
- Progress bar for active downloads
- Error messages for failures
- Individual file retry buttons

#### 8.2.6 Activity Log Panel
- Chronological list of events
- Auto-scrolls to bottom
- Filterable by event type
- Export to file button

### 8.3 Settings Dialog
```
┌─────────────────────────────────────────────────────────┐
│ Settings                                     [×]         │
├─────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌──────────────────────────────────────┐ │
│ │ API       │ │ Fireflies API Configuration          │ │
│ │ ----      │ │                                      │ │
│ │ Download  │ │ API Key: [********************] [👁] │ │
│ │           │ │          [Test Connection]           │ │
│ │ Files     │ │                                      │ │
│ │           │ │ Status: ✓ Connected as user@ex.com  │ │
│ │ Advanced  │ │                                      │ │
│ │           │ │                                      │ │
│ │ About     │ │                                      │ │
│ └───────────┘ └──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                               [Cancel] [Save & Close]   │
└─────────────────────────────────────────────────────────┘
```

**Tabs:**
1. **API**: API key input, connection test
2. **Download**: Storage location, concurrent downloads setting
3. **Files**: Checkboxes for file types to download
4. **Advanced**: Auto-retry settings, log level, date range
5. **About**: Version info, links to docs, license

### 8.4 Notifications
- Browser notifications (with user permission) for:
  - Sync completed successfully
  - Sync failed with error count
  - New meetings detected
  - Browser storage quota warning
- Page title updates during sync (e.g., "⟳ 45/200 - Fireflies")
- Favicon changes to indicate status (normal/syncing/error)
- Warning dialog before leaving page during active downloads

### 8.5 PWA Installation
- Install prompt when user visits multiple times
- Installable from browser menu (Chrome: Install App)
- Custom install banner with benefits
- Standalone window mode when installed
- App icon for desktop/taskbar

---

## 9. Dependencies and Constraints

### 9.1 External Dependencies
- Fireflies.ai API availability and stability
- User must have Business account tier
- User must have valid API key with appropriate permissions
- Meetings must be accessible via user's account (privacy settings)
- **Browser compatibility: Chrome 86+, Edge 86+, or Opera 72+**

### 9.2 API Constraints
- Rate limit: 60 requests per minute
- Audio downloads require Business/Enterprise plan
- Historical data limited to account age
- Some fields may be null/empty depending on meeting type

### 9.3 Browser/Platform Constraints
- **File System Access API only available in Chromium browsers**
- Firefox and Safari not currently supported
- User must grant directory access permissions
- Permissions may be revoked if user clears browser data
- IndexedDB storage quota varies by browser (typically 50% of available disk)
- Browser must remain open during downloads
- Background sync not available when browser/tab closed
- Service Worker limitations for large file operations

### 9.4 Data Constraints
- Maximum 3 years of historical data
- Large meetings (2+ hours) may have very large audio files (>1GB)
- Transcript JSON can be large for long meetings (10MB+)
- Total storage could exceed 100GB for active users
- IndexedDB quota typically 50% of available disk space
- Browsers may prompt user for storage quota increase

---

## 10. Success Metrics

### 10.1 Technical Metrics
- **Download Success Rate**: >99% of attempted downloads succeed
- **Performance**: Complete sync of 1000 meetings in <24 hours
- **Reliability**: Application crashes occur in <0.1% of sessions
- **Data Integrity**: 100% of downloaded files pass integrity checks

### 10.2 User Experience Metrics
- **Setup Time**: Users complete setup in <5 minutes
- **Time to First Sync**: First meeting downloads start within 30 seconds of clicking "Sync All"
- **Error Recovery**: Users successfully retry failed downloads 100% of the time
- **Satisfaction**: User satisfaction score >4.5/5

### 10.3 Business Metrics
- **Adoption**: 30% of Business tier users activate the tool within 3 months
- **Retention**: 80% of users who complete initial sync continue using for updates
- **Support Tickets**: <5% of users require support assistance
- **Churn Reduction**: Reduce churn by 10% among users concerned with data portability

---

## 11. Timeline and Milestones

### Phase 1: Foundation (Weeks 1-3)
- **Week 1**: Project setup, architecture design, database schema
- **Week 2**: API integration layer, authentication, basic queries
- **Week 3**: Download engine, file management, storage organization

### Phase 2: Core Features (Weeks 4-6)
- **Week 4**: Progress tracking, sync status management, UI framework
- **Week 5**: Main window UI, meeting list, filters and search
- **Week 6**: Settings dialog, configuration management, error handling

### Phase 3: Polish and Testing (Weeks 7-9)
- **Week 7**: Resume/recovery logic, comprehensive error handling
- **Week 8**: Performance optimization, stress testing with large datasets
- **Week 9**: UI/UX refinements, accessibility, documentation

### Phase 4: Beta and Launch (Weeks 10-12)
- **Week 10**: Closed beta with 10-20 users, bug fixes
- **Week 11**: Open beta, performance tuning, final fixes
- **Week 12**: Production release, monitoring, support readiness

---

## 12. Open Questions

### 12.1 Technical Questions
1. **Q:** Should we support resumable downloads for partial audio files?  
   **Status:** TBD - depends on API response headers

2. **Q:** How do we handle meetings with missing audio (Free plan users in meeting)?  
   **Status:** TBD - skip with clear message or offer alternative

3. **Q:** Should we generate DOCX from JSON or is there an API endpoint?  
   **Status:** Research needed - may need to use html2docx or similar library

4. **Q:** What's the best approach for tracking incremental updates?  
   **Status:** TBD - timestamp-based or query all and compare?

5. **Q:** Should we use Web Workers for download management?  
   **Status:** TBD - test performance impact, may help with large files

6. **Q:** How do we handle IndexedDB quota exceeded errors?  
   **Status:** Prompt user to increase quota, provide cleanup options

7. **Q:** Should we implement Service Worker for offline capability?  
   **Status:** v2 consideration - limited benefit for download-focused app

8. **Q:** How do we handle browser storage cleanup/eviction?  
   **Status:** Implement detection and recovery, warn user

### 12.2 Product Questions
1. **Q:** Should we support scheduled automatic syncs?  
   **Status:** Out of scope for v1, consider for v2

2. **Q:** Should we support multiple Fireflies accounts?  
   **Status:** Out of scope for v1

3. **Q:** Should we provide any analytics on downloaded data?  
   **Status:** Out of scope for v1

4. **Q:** Should we support cloud backup (S3, Drive) integration?  
   **Status:** Out of scope for v1, strong candidate for v2

### 12.3 Business Questions
1. **Q:** Will this be a paid add-on or included with Business tier?  
   **Status:** TBD - business decision needed

2. **Q:** Do we need usage analytics/telemetry?  
   **Status:** TBD - privacy considerations

3. **Q:** What's our support model for this tool?  
   **Status:** TBD - self-serve docs vs. direct support

---

## 13. Risks and Mitigation

### 13.1 Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API rate limits block large syncs | High | Medium | Implement smart queuing, allow pausing |
| Audio files too large for some users | Medium | Low | Make audio optional, show size estimates |
| Browser storage quota exceeded | Medium | Medium | Monitor quota, request increase, warn user |
| File System Access permissions revoked | High | Medium | Check permissions on startup, re-prompt gracefully |
| IndexedDB corruption | High | Low | Implement transaction safety, backup strategy |
| Browser compatibility limits adoption | High | High | Clear messaging, detect browser, suggest alternatives |
| Downloads interrupted by tab close | Medium | High | Warn before unload, save state frequently |

### 13.2 Product Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users don't see value | High | Low | Clear onboarding, immediate value |
| Complex UI intimidates users | Medium | Medium | Simplified default view, progressive disclosure |
| Storage requirements too high | Medium | Medium | Make file types optional, show estimates |

### 13.3 Business Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low adoption rate | Medium | Medium | In-product promotion, clear benefits |
| High support burden | Medium | Low | Comprehensive docs, error messages |
| API costs increase | Low | Low | Optimize API usage, cache aggressively |

---

## 14. Deployment and Hosting

### 14.1 Hosting Options
- **Recommended:** Vercel, Netlify, or Cloudflare Pages
- Static site hosting (no backend required)
- HTTPS required (for File System Access API)
- Custom domain support
- Automatic deployments from git

### 14.2 Build and Deployment
```bash
# Build for production
npm run build

# Output: dist/ folder with static assets
# Deploy dist/ to hosting provider
```

### 14.3 Environment Configuration
```typescript
// Environment variables
VITE_FIREFLIES_API_URL=https://api.fireflies.ai/graphql
VITE_APP_VERSION=1.0.0
VITE_ANALYTICS_ID=xxx  // Optional
```

### 14.4 PWA Manifest
```json
{
  "name": "Fireflies Transcript Downloader",
  "short_name": "FF Downloader",
  "description": "Download and manage your Fireflies meeting transcripts locally",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 14.5 Service Worker (Basic)
```javascript
// sw.js - For offline shell only
const CACHE_NAME = 'ff-downloader-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/main.js',
  '/assets/main.css'
];

// Cache shell for offline access to UI
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});
```

### 14.6 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - uses: vercel/action@v1  # or netlify/deploy@v1
```

---

## 15. Appendix

### 15.1 Glossary
- **Meeting**: A single recorded session in Fireflies.ai
- **Transcript**: The text record of a meeting with timestamps
- **Sync**: The process of downloading files from Fireflies to local storage
- **Sync Status**: Current state of a meeting's download (synced, syncing, failed, etc.)
- **File Type**: One of four downloadable formats (audio, docx, json, md)
- **File System Access API**: Browser API for reading/writing files to user's computer
- **IndexedDB**: Browser database for storing structured data locally
- **Dexie.js**: TypeScript-friendly wrapper for IndexedDB
- **PWA**: Progressive Web App - web app installable as desktop app
- **Directory Handle**: Reference to a folder provided by File System Access API
- **Service Worker**: Background script for offline functionality
- **Storage Quota**: Browser limit on IndexedDB storage space

### 15.2 References
- Fireflies API Documentation: https://docs.fireflies.ai/
- GraphQL API Reference: https://docs.fireflies.ai/graphql-api
- Rate Limits: https://docs.fireflies.ai/fundamentals/limits
- Authentication: https://docs.fireflies.ai/fundamentals/authorization
- File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Dexie.js Documentation: https://dexie.org/
- PWA Documentation: https://web.dev/progressive-web-apps/
- Browser Compatibility: https://caniuse.com/native-filesystem-api

### 15.3 Revision History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-09-30 | Product Team | Initial PRD - Web App Architecture |

**Architecture Decision:** Modern web application using File System Access API and IndexedDB instead of native desktop application. This provides zero-installation deployment, automatic updates, and cross-platform compatibility while maintaining the ability to save files directly to the user's hard drive.

---

**Document Status:** Draft  
**Next Review Date:** TBD  
**Approvals Required:** Product Manager, Engineering Lead, Design Lead