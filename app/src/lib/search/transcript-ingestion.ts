// Bulk ingestion of existing transcripts into IndexedDB for search
import { db } from '../db';
import { fileSystem } from '../storage';
import { processTranscriptForSearch } from './content-extractor';
import { searchEngine } from './transcript-search-engine';
import type { FirefliesTranscript, Meeting } from '../../types';

export interface IngestionProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentMeeting?: string;
  errors: Array<{ meetingId: string; error: string }>;
}

export interface IngestionOptions {
  onProgress?: (progress: IngestionProgress) => void;
  batchSize?: number;
  skipExisting?: boolean; // Skip meetings already indexed
}

/**
 * Ingest all downloaded transcripts from filesystem into IndexedDB
 */
export async function ingestDownloadedTranscripts(
  options: IngestionOptions = {}
): Promise<IngestionProgress> {
  const {
    onProgress,
    batchSize = 5, // Reduced from 10 to handle large files better
    skipExisting = true
  } = options;

  console.log('🔄 Starting transcript ingestion...');

  // Verify directory handle is available
  const rootHandle = fileSystem.getRootHandle();
  if (!rootHandle) {
    throw new Error('No directory selected. Please select your download folder in the app settings first.');
  }
  
  console.log('✅ Directory handle verified');

  // Get all meetings from database
  const allMeetings = await db.meetings.toArray();
  const syncedMeetings = allMeetings.filter(m => m.sync_status === 'synced');

  console.log(`📊 Found ${syncedMeetings.length} synced meetings to process`);

  const progress: IngestionProgress = {
    total: syncedMeetings.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  // If skipping existing, check which meetings are already indexed
  let meetingsToProcess = syncedMeetings;
  if (skipExisting) {
    const existingContent = await db.transcriptContent.toCollection().primaryKeys();
    const existingIds = new Set(existingContent);
    meetingsToProcess = syncedMeetings.filter(m => !existingIds.has(m.id));
    progress.skipped = syncedMeetings.length - meetingsToProcess.length;
    progress.total = meetingsToProcess.length;
    console.log(`⏭️  Skipping ${progress.skipped} already indexed meetings`);
  }

  if (meetingsToProcess.length === 0) {
    console.log('✅ All transcripts already indexed');
    return progress;
  }

  // Process in batches
  for (let i = 0; i < meetingsToProcess.length; i += batchSize) {
    const batch = meetingsToProcess.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (meeting) => {
        progress.currentMeeting = meeting.title;
        
        try {
          await ingestSingleTranscript(meeting);
          progress.succeeded++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          
          // Only count as failed if it's not a "file not found" issue
          if (errorMsg.includes('No transcript_json file found') || 
              errorMsg.includes('Transcript not downloaded') ||
              errorMsg.includes('Failed to read transcript file')) {
            // These are expected for meetings that haven't been downloaded yet
            progress.skipped++;
            console.log(`⏭️  Skipped ${meeting.title}: ${errorMsg}`);
          } else {
            progress.failed++;
            progress.errors.push({
              meetingId: meeting.id,
              error: errorMsg
            });
            console.error(`❌ Failed to ingest ${meeting.title}:`, error);
          }
        } finally {
          progress.processed++;
          
          if (onProgress) {
            onProgress({ ...progress });
          }
        }
      })
    );
  }

  console.log(`✅ Ingestion complete: ${progress.succeeded} succeeded, ${progress.failed} failed, ${progress.skipped} skipped`);
  
  // Rebuild search index after ingestion
  console.log('🔍 Rebuilding search index...');
  await searchEngine.rebuild();
  console.log('✅ Search index rebuilt');

  return progress;
}

/**
 * Ingest a single transcript from filesystem
 */
export async function ingestSingleTranscript(meeting: Meeting): Promise<void> {
  // Find the transcript file
  const files = await db.files
    .where('[meeting_id+file_type]')
    .equals([meeting.id, 'transcript_json'])
    .toArray();

  if (files.length === 0) {
    // No transcript file record - meeting hasn't been synced yet
    throw new Error('No transcript_json file found');
  }

  const transcriptFile = files[0];
  
  if (transcriptFile.status !== 'downloaded') {
    // File not downloaded yet - skip
    throw new Error(`Transcript not downloaded (status: ${transcriptFile.status})`);
  }
  
  console.log(`📄 Processing: ${meeting.title}`);
  console.log(`   Path: ${transcriptFile.file_path}`);

  // Read the transcript from filesystem
  const transcript = await readTranscriptFromFile(transcriptFile.file_path);
  
  if (!transcript) {
    // File couldn't be read - might not exist on filesystem
    throw new Error('Failed to read transcript file');
  }

  // Also try to read summary.txt if it exists
  const summaryText = await readSummaryFile(transcriptFile.file_path);
  if (summaryText) {
    // Merge summary into transcript object if we read it from file
    if (!transcript.summary) {
      transcript.summary = {
        overview: summaryText,
        action_items: [],
        outline: [],
        shorthand_bullet: []
      };
    }
  }

  // Process and store
  const { transcriptContent, summaryContent, searchMetadata } = 
    processTranscriptForSearch(meeting.id, transcript);

  // Store in IndexedDB
  await db.transaction('rw', 
    [db.transcriptContent, db.summaryContent, db.searchMetadata], 
    async () => {
      await db.transcriptContent.put(transcriptContent);
      await db.summaryContent.put(summaryContent);
      await db.searchMetadata.put(searchMetadata);
    }
  );

  console.log(`✅ Indexed: ${meeting.title}`);
}

/**
 * Read summary.txt file if it exists
 */
async function readSummaryFile(transcriptPath: string): Promise<string | null> {
  try {
    // Replace transcript.json with summary.txt in the path
    const summaryPath = transcriptPath.replace('transcript.json', 'summary.txt');
    
    const parts = summaryPath.split('/');
    let monthFolder: string | null = null;
    let meetingFolder: string | null = null;
    
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{4}-\d{2}$/.test(parts[i])) {
        monthFolder = parts[i];
        if (i + 1 < parts.length) {
          meetingFolder = parts[i + 1];
        }
        break;
      }
    }
    
    if (!monthFolder || !meetingFolder) {
      return null;
    }
    
    const rootHandle = fileSystem.getRootHandle();
    if (!rootHandle) {
      return null;
    }

    const monthHandle = await rootHandle.getDirectoryHandle(monthFolder, { create: false });
    const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder, { create: false });
    
    // Try to get summary.txt
    const fileHandle = await meetingHandle.getFileHandle('summary.txt', { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    
    console.log(`   ✅ Read summary.txt (${Math.round(file.size / 1024)}KB)`);
    return text;
  } catch (error) {
    // Summary file doesn't exist or can't be read - that's okay
    console.log(`   ℹ️  No summary.txt found (this is okay)`);
    return null;
  }
}

/**
 * Read and parse transcript JSON from filesystem with support for large files
 */
async function readTranscriptFromFile(filePath: string): Promise<FirefliesTranscript | null> {
  try {
    // Parse the file path to get folder structure
    // Format examples:
    // "2024-07/2024-07-04_Meeting-Title/transcript.json"
    // "2025-01/2025-01-15_Another-Meeting/transcript.json"
    
    const parts = filePath.split('/');
    
    // Find month folder and meeting folder from path
    let monthFolder: string | null = null;
    let meetingFolder: string | null = null;
    
    // Look for pattern YYYY-MM for month folder
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{4}-\d{2}$/.test(parts[i])) {
        monthFolder = parts[i];
        if (i + 1 < parts.length) {
          meetingFolder = parts[i + 1];
        }
        break;
      }
    }
    
    if (!monthFolder || !meetingFolder) {
      throw new Error(`Invalid file path format: ${filePath}`);
    }
    
    // Read the file
    const rootHandle = fileSystem.getRootHandle();
    if (!rootHandle) {
      throw new Error('No directory handle available');
    }

    // Navigate to month folder
    const monthHandle = await rootHandle.getDirectoryHandle(monthFolder, { create: false })
      .catch(err => {
        throw new Error(`Month folder "${monthFolder}" not found: ${err.message}`);
      });
    
    // Navigate to meeting folder
    const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder, { create: false })
      .catch(err => {
        throw new Error(`Meeting folder "${meetingFolder}" not found in ${monthFolder}: ${err.message}`);
      });
    
    // Get the transcript file
    const fileHandle = await meetingHandle.getFileHandle('transcript.json', { create: false })
      .catch(err => {
        throw new Error(`transcript.json not found in ${monthFolder}/${meetingFolder}: ${err.message}`);
      });
      
    const file = await fileHandle.getFile();
    const fileSizeKB = Math.round(file.size / 1024);
    
    // Log large files
    if (fileSizeKB > 100) {
      console.log(`   📦 Large file: ${fileSizeKB}KB`);
    }
    
    // Read file with timeout protection for very large files
    const readPromise = file.text();
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('File read timeout (>30s)')), 30000)
    );
    
    const text = await Promise.race([readPromise, timeoutPromise]);
    
    // Parse JSON with better error handling for large files
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ JSON parse error for ${filePath}:`, parseError);
      throw new Error(`Failed to parse JSON (file size: ${fileSizeKB}KB)`);
    }
    
    // Validate that we have essential data
    if (!data.sentences || !Array.isArray(data.sentences)) {
      throw new Error(`Invalid transcript format: missing or invalid sentences array`);
    }
    
    // Convert to FirefliesTranscript format
    // The file contains our generated format, need to reconstruct full transcript
    const transcript: FirefliesTranscript = {
      id: data.meeting_id || data.id || '',
      title: data.title || 'Untitled Meeting',
      date: data.date || Date.now(),
      dateString: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      duration: data.duration || 0,
      organizer_email: data.organizer || data.organizer_email || '',
      participants: data.participants || [],
      transcript_url: '',
      fireflies_users: [],
      sentences: data.sentences || []
    };
    
    // Log successful parsing of large files
    if (fileSizeKB > 100) {
      console.log(`   ✅ Parsed ${fileSizeKB}KB file (${data.sentences?.length || 0} sentences)`);
    }

    return transcript;
  } catch (error) {
    // Log the specific error for debugging
    console.error(`   ❌ Error reading ${filePath}:`, error instanceof Error ? error.message : String(error));
    // File doesn't exist or can't be read - return null to signal skip
    return null;
  }
}

/**
 * Get ingestion statistics
 */
export async function getIngestionStats(): Promise<{
  totalMeetings: number;
  indexedMeetings: number;
  notIndexed: number;
  indexedPercentage: number;
}> {
  const [totalMeetings, indexedMeetings] = await Promise.all([
    db.meetings.where('sync_status').equals('synced').count(),
    db.transcriptContent.count()
  ]);

  const notIndexed = Math.max(0, totalMeetings - indexedMeetings);
  const indexedPercentage = totalMeetings > 0 
    ? Math.round((indexedMeetings / totalMeetings) * 100) 
    : 0;

  return {
    totalMeetings,
    indexedMeetings,
    notIndexed,
    indexedPercentage
  };
}

/**
 * Clear all indexed content (for testing/rebuild)
 */
export async function clearIndexedContent(): Promise<void> {
  console.log('🗑️  Clearing indexed content...');
  
  await db.transaction('rw', 
    [db.transcriptContent, db.summaryContent, db.searchMetadata], 
    async () => {
      await db.transcriptContent.clear();
      await db.summaryContent.clear();
      await db.searchMetadata.clear();
    }
  );
  
  console.log('✅ Indexed content cleared');
}

