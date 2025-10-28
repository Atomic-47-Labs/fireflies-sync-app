// Analyze transcript file sizes to identify large files
import { db } from '../db';
import { fileSystem } from '../storage';

export interface FileAnalysis {
  meetingId: string;
  meetingTitle: string;
  filePath: string;
  sizeKB: number;
  sentenceCount?: number;
  status: 'readable' | 'error';
  errorMessage?: string;
}

/**
 * Analyze file sizes of unindexed transcripts
 */
export async function analyzeLargeFiles(): Promise<FileAnalysis[]> {
  console.log('🔍 Analyzing transcript file sizes...');
  
  const results: FileAnalysis[] = [];
  
  // Get all meetings
  const allMeetings = await db.meetings.where('sync_status').equals('synced').toArray();
  
  // Get all indexed meetings
  const indexedMeetings = await db.transcriptContent.toCollection().primaryKeys();
  const indexedSet = new Set(indexedMeetings);
  
  // Find unindexed meetings
  const unindexedMeetings = allMeetings.filter(m => !indexedSet.has(m.id));
  
  console.log(`Analyzing ${unindexedMeetings.length} unindexed meetings...`);
  
  const rootHandle = fileSystem.getRootHandle();
  if (!rootHandle) {
    throw new Error('No directory handle available. Please select your download folder first.');
  }
  
  for (const meeting of unindexedMeetings.slice(0, 50)) { // Limit to first 50 for performance
    try {
      // Get file record
      const files = await db.files
        .where('[meeting_id+file_type]')
        .equals([meeting.id, 'transcript_json'])
        .toArray();
      
      if (files.length === 0) {
        continue;
      }
      
      const file = files[0];
      if (!file.file_path || file.status !== 'downloaded') {
        continue;
      }
      
      // Parse path
      const parts = file.file_path.split('/');
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
        continue;
      }
      
      // Try to read the file and get size
      try {
        const monthHandle = await rootHandle.getDirectoryHandle(monthFolder, { create: false });
        const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder, { create: false });
        const fileHandle = await meetingHandle.getFileHandle('transcript.json', { create: false });
        
        const fileObj = await fileHandle.getFile();
        const sizeKB = Math.round(fileObj.size / 1024);
        
        // Try to read and parse to get sentence count
        let sentenceCount: number | undefined;
        let status: 'readable' | 'error' = 'readable';
        let errorMessage: string | undefined;
        
        try {
          const text = await fileObj.text();
          const data = JSON.parse(text);
          sentenceCount = data.sentences?.length || 0;
        } catch (parseError) {
          status = 'error';
          errorMessage = parseError instanceof Error ? parseError.message : 'Parse error';
        }
        
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          filePath: file.file_path,
          sizeKB,
          sentenceCount,
          status,
          errorMessage
        });
        
      } catch (fileError) {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          filePath: file.file_path,
          sizeKB: 0,
          status: 'error',
          errorMessage: fileError instanceof Error ? fileError.message : 'File access error'
        });
      }
      
    } catch (error) {
      console.error(`Error analyzing ${meeting.title}:`, error);
    }
  }
  
  // Sort by size (largest first)
  results.sort((a, b) => b.sizeKB - a.sizeKB);
  
  // Log summary
  console.log(`\n📊 File Size Analysis:`);
  console.log(`Total analyzed: ${results.length}`);
  console.log(`Readable: ${results.filter(r => r.status === 'readable').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
  console.log(`\nLargest files:`);
  results.slice(0, 10).forEach(r => {
    console.log(`  ${r.sizeKB}KB - ${r.meetingTitle} - ${r.status}`);
  });
  
  const avgSize = results.reduce((sum, r) => sum + r.sizeKB, 0) / results.length;
  console.log(`\nAverage size: ${Math.round(avgSize)}KB`);
  
  return results;
}

