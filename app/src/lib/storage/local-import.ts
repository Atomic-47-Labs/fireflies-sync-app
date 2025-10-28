/**
 * Local Directory Import
 * Import meetings from existing local fireflies directory structure
 */

import { db } from '../db';
import type { Meeting } from '../../types';

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}

/**
 * Parse meeting metadata from directory structure
 * Format: YYYY-MM/YYYY-MM-DD_Meeting-Title/
 */
function parseMeetingFromPath(monthFolder: string, meetingFolder: string): Partial<Meeting> | null {
  try {
    // Extract date from meeting folder name
    // Format: 2025-10-15_Meeting-Title
    const match = meetingFolder.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
    if (!match) {
      console.warn(`Could not parse meeting folder: ${meetingFolder}`);
      return null;
    }

    const [, dateStr, title] = match;
    const date = new Date(dateStr).getTime();

    // Generate a pseudo-ID from the path
    const id = `local-${monthFolder}-${meetingFolder}`;

    return {
      id,
      title: title.replace(/-/g, ' '), // Convert hyphens back to spaces
      date,
      duration: 0, // Will need to calculate from files if needed
      organizer_email: '',
      participants: [],
      transcript_url: '',
      audio_url: '',
      fireflies_users: [],
      sync_status: 'synced', // Already downloaded
      created_at: Date.now(),
      updated_at: Date.now(),
    };
  } catch (error) {
    console.error(`Error parsing meeting path: ${monthFolder}/${meetingFolder}`, error);
    return null;
  }
}

/**
 * Check if a directory contains meeting files and get file list
 */
async function getMeetingFiles(dirHandle: FileSystemDirectoryHandle): Promise<{
  hasFiles: boolean;
  files: { name: string; size: number }[];
}> {
  try {
    const files: { name: string; size: number }[] = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const fileHandle = await dirHandle.getFileHandle(entry.name);
        const file = await fileHandle.getFile();
        files.push({ name: entry.name, size: file.size });
      }
    }
    
    // Check for at least one expected file
    const hasFiles = files.some(f => 
      f.name === 'audio.mp3' || 
      f.name === 'transcript.json' || 
      f.name === 'transcript.rtf' ||
      f.name === 'summary.md' ||
      f.name === 'summary.txt'
    );
    
    return { hasFiles, files };
  } catch (error) {
    return { hasFiles: false, files: [] };
  }
}

/**
 * Import meetings from local directory structure
 */
export async function importFromLocalDirectory(
  rootHandle: FileSystemDirectoryHandle,
  onProgress?: (message: string, current: number, total?: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  onProgress?.('Scanning local directory...', 0);

  try {
    // Get all month folders (YYYY-MM format)
    const monthFolders: string[] = [];
    for await (const entry of rootHandle.values()) {
      if (entry.kind === 'directory' && /^\d{4}-\d{2}$/.test(entry.name)) {
        monthFolders.push(entry.name);
      }
    }

    monthFolders.sort(); // Sort chronologically
    onProgress?.(`Found ${monthFolders.length} month folders`, 0);

    // Scan each month folder
    for (const monthFolder of monthFolders) {
      try {
        const monthHandle = await rootHandle.getDirectoryHandle(monthFolder);
        
        // Get all meeting folders in this month
        const meetingFolders: string[] = [];
        for await (const entry of monthHandle.values()) {
          if (entry.kind === 'directory') {
            meetingFolders.push(entry.name);
          }
        }

        // Process each meeting folder
        for (const meetingFolder of meetingFolders) {
          result.total++;
          
          try {
            const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder);
            
            // Check if it has meeting files
            const { hasFiles, files } = await getMeetingFiles(meetingHandle);
            if (!hasFiles) {
              console.log(`Skipping ${meetingFolder} - no meeting files found`);
              result.skipped++;
              continue;
            }

            // Parse meeting metadata from folder name
            const meetingData = parseMeetingFromPath(monthFolder, meetingFolder);
            if (!meetingData) {
              result.errors++;
              continue;
            }

            // Check if meeting already exists in database
            const existing = await db.meetings.get(meetingData.id!);
            if (existing) {
              result.skipped++;
              continue;
            }

            // Add meeting to database
            await db.meetings.add(meetingData as Meeting);
            
            // Register existing files in the database
            const filePath = `${monthFolder}/${meetingFolder}`;
            for (const file of files) {
              let fileType: string | null = null;
              
              if (file.name === 'audio.mp3') fileType = 'audio';
              else if (file.name === 'transcript.json') fileType = 'transcript_json';
              else if (file.name === 'transcript.rtf') fileType = 'transcript_docx';
              else if (file.name === 'summary.md' || file.name === 'summary.txt') fileType = 'summary';
              
              if (fileType) {
                await db.files.add({
                  meeting_id: meetingData.id!,
                  file_type: fileType,
                  file_path: `${filePath}/${file.name}`,
                  file_size: file.size,
                  created_at: Date.now(),
                });
              }
            }
            
            result.imported++;

            onProgress?.(
              `Imported: ${meetingData.title} (${files.length} files)`,
              result.imported,
              result.total
            );

          } catch (error) {
            console.error(`Error processing ${meetingFolder}:`, error);
            result.errors++;
          }
        }
      } catch (error) {
        console.error(`Error processing month ${monthFolder}:`, error);
      }
    }

    onProgress?.(
      `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`,
      result.imported,
      result.total
    );

    return result;

  } catch (error) {
    console.error('Error importing from local directory:', error);
    throw error;
  }
}

