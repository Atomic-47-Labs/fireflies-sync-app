/**
 * Directory Scanner
 * Scans the download directory to find existing meeting files and update database
 */

import { db } from '../db';
import type { Meeting, FileType } from '../../types';

interface ScanResult {
  meetingsScanned: number;
  filesFound: number;
  meetingsUpdated: number;
}

interface MeetingFiles {
  audio: boolean;
  transcript_json: boolean;
  transcript_docx: boolean;
  summary: boolean;
}

/**
 * Scan a directory for existing meeting files and update database
 */
export async function scanDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  onProgress?: (message: string) => void
): Promise<ScanResult> {
  const result: ScanResult = {
    meetingsScanned: 0,
    filesFound: 0,
    meetingsUpdated: 0,
  };

  onProgress?.('Starting directory scan...');

  try {
    // Get all meetings from database
    const meetings = await db.meetings.toArray();
    onProgress?.(`Found ${meetings.length} meetings in database`);

    // Scan each meeting's expected folder
    for (const meeting of meetings) {
      result.meetingsScanned++;
      
      const meetingFiles = await scanMeetingFiles(directoryHandle, meeting);
      
      if (meetingFiles) {
        const fileCount = Object.values(meetingFiles).filter(Boolean).length;
        result.filesFound += fileCount;

        // Update database with found files
        await updateMeetingFiles(meeting.id, meetingFiles);
        
        // Update meeting sync status
        const allFilesPresent = 
          meetingFiles.audio && 
          meetingFiles.transcript_json && 
          meetingFiles.transcript_docx && 
          meetingFiles.summary;
        
        if (allFilesPresent && meeting.sync_status !== 'synced') {
          await db.meetings.update(meeting.id, { 
            sync_status: 'synced',
            updated_at: Date.now()
          });
          result.meetingsUpdated++;
        } else if (!allFilesPresent && meeting.sync_status === 'synced') {
          await db.meetings.update(meeting.id, { 
            sync_status: 'not_synced',
            updated_at: Date.now()
          });
          result.meetingsUpdated++;
        }
      }

      if (result.meetingsScanned % 10 === 0) {
        onProgress?.(`Scanned ${result.meetingsScanned}/${meetings.length} meetings...`);
      }
    }

    onProgress?.(`Scan complete! Found ${result.filesFound} files in ${result.meetingsScanned} meetings`);
    
    return result;
  } catch (error) {
    console.error('Directory scan failed:', error);
    throw error;
  }
}

/**
 * Scan for files for a specific meeting
 */
async function scanMeetingFiles(
  rootHandle: FileSystemDirectoryHandle,
  meeting: Meeting
): Promise<MeetingFiles | null> {
  try {
    // Build expected folder path: YYYY-MM/YYYY-MM-DD_Title
    const meetingDate = new Date(meeting.date);
    const monthFolder = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Sanitize title (same logic as download process)
    let sanitizedTitle = meeting.title
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
      .replace(/\s+/g, '-')            // Replace spaces with hyphens
      .replace(/\.+$/g, '')            // Remove trailing periods
      .replace(/[-_\s]+$/g, '')        // Remove trailing hyphens, underscores, spaces
      .replace(/^[-_\s.]+/g, '');      // Remove leading hyphens, underscores, spaces, periods
    
    if (!sanitizedTitle) {
      sanitizedTitle = 'meeting';
    }
    
    const timestamp = meetingDate.toISOString().split('T')[0];
    const meetingFolder = `${timestamp}_${sanitizedTitle}`;

    // Try to access month folder
    let monthHandle: FileSystemDirectoryHandle;
    try {
      monthHandle = await rootHandle.getDirectoryHandle(monthFolder);
    } catch {
      return null; // Month folder doesn't exist
    }

    // Try to access meeting folder
    let meetingHandle: FileSystemDirectoryHandle;
    try {
      meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder);
    } catch {
      return null; // Meeting folder doesn't exist
    }

    // Check for each expected file
    const files: MeetingFiles = {
      audio: false,
      transcript_json: false,
      transcript_docx: false,
      summary: false,
    };

    // Check audio.mp3
    try {
      await meetingHandle.getFileHandle('audio.mp3');
      files.audio = true;
    } catch {
      // File doesn't exist
    }

    // Check transcript.json
    try {
      await meetingHandle.getFileHandle('transcript.json');
      files.transcript_json = true;
    } catch {
      // File doesn't exist
    }

    // Check transcript.rtf
    try {
      await meetingHandle.getFileHandle('transcript.rtf');
      files.transcript_docx = true;
    } catch {
      // File doesn't exist
    }

    // Check summary.txt
    try {
      await meetingHandle.getFileHandle('summary.txt');
      files.summary = true;
    } catch {
      // File doesn't exist
    }

    return files;
  } catch (error) {
    console.error('Error scanning meeting files:', meeting.id, error);
    return null;
  }
}

/**
 * Update database with found files
 */
async function updateMeetingFiles(
  meetingId: string,
  files: MeetingFiles
): Promise<void> {
  const meeting = await db.meetings.get(meetingId);
  if (!meeting) return;
  
  const meetingDate = new Date(meeting.date);
  const monthFolder = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
  
  // Sanitize title (same logic as download process)
  let sanitizedTitle = meeting.title
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
    .replace(/\s+/g, '-')            // Replace spaces with hyphens
    .replace(/\.+$/g, '')            // Remove trailing periods
    .replace(/[-_\s]+$/g, '')        // Remove trailing hyphens, underscores, spaces
    .replace(/^[-_\s.]+/g, '');      // Remove leading hyphens, underscores, spaces, periods
  
  if (!sanitizedTitle) {
    sanitizedTitle = 'meeting';
  }
  
  const timestamp = meetingDate.toISOString().split('T')[0];
  const meetingFolder = `${timestamp}_${sanitizedTitle}`;
  const basePath = `${monthFolder}/${meetingFolder}`;

  const fileTypeMap: { [K in keyof MeetingFiles]: { type: FileType; filename: string } } = {
    audio: { type: 'audio', filename: 'audio.mp3' },
    transcript_json: { type: 'transcript_json', filename: 'transcript.json' },
    transcript_docx: { type: 'transcript_docx', filename: 'transcript.rtf' },
    summary: { type: 'summary', filename: 'summary.txt' },
  };

  for (const [key, present] of Object.entries(files)) {
    const fileInfo = fileTypeMap[key as keyof MeetingFiles];
    
    if (present) {
      // Check if file record exists
      const existing = await db.files
        .where(['meeting_id', 'file_type'])
        .equals([meetingId, fileInfo.type])
        .first();

      if (!existing) {
        // Add file record
        await db.files.add({
          meeting_id: meetingId,
          file_type: fileInfo.type,
          file_path: `${basePath}/${fileInfo.filename}`,
          file_size: 0, // We don't know the size from scanning
          status: 'downloaded',
          downloaded_at: Date.now(),
        });
      }
    }
  }
}

