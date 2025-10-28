// Diagnostic tools for transcript ingestion issues
import { db } from '../db';
import type { Meeting } from '../../types';

export interface DiagnosticResult {
  meetingId: string;
  meetingTitle: string;
  issue: string;
  details: string;
}

/**
 * Diagnose why meetings weren't indexed
 */
export async function diagnoseUnindexedMeetings(): Promise<DiagnosticResult[]> {
  console.log('🔍 Diagnosing unindexed meetings...');
  
  const results: DiagnosticResult[] = [];
  
  // Get all meetings
  const allMeetings = await db.meetings.where('sync_status').equals('synced').toArray();
  
  // Get all indexed meetings
  const indexedMeetings = await db.transcriptContent.toCollection().primaryKeys();
  const indexedSet = new Set(indexedMeetings);
  
  // Find unindexed meetings
  const unindexedMeetings = allMeetings.filter(m => !indexedSet.has(m.id));
  
  console.log(`Found ${unindexedMeetings.length} unindexed meetings to diagnose`);
  
  for (const meeting of unindexedMeetings) {
    try {
      // Check if transcript file record exists
      const files = await db.files
        .where('[meeting_id+file_type]')
        .equals([meeting.id, 'transcript_json'])
        .toArray();
      
      if (files.length === 0) {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: 'No transcript file record',
          details: 'No transcript_json file record in database'
        });
        continue;
      }
      
      const file = files[0];
      
      // Check file status
      if (file.status !== 'downloaded') {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: `File not downloaded`,
          details: `Status: ${file.status}`
        });
        continue;
      }
      
      // Check if file path is valid
      if (!file.file_path) {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: 'Missing file path',
          details: 'File record has no file_path'
        });
        continue;
      }
      
      // Check file path format
      const parts = file.file_path.split('/');
      const hasMonthFolder = parts.some(p => /^\d{4}-\d{2}$/.test(p));
      
      if (!hasMonthFolder) {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: 'Invalid file path format',
          details: `Path: ${file.file_path} (no month folder found)`
        });
        continue;
      }
      
      // Try to actually read the file to get more specific error
      try {
        const { ingestSingleTranscript } = await import('./transcript-ingestion');
        await ingestSingleTranscript(meeting);
        // If we get here, it succeeded! Update the diagnostic
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: 'Now indexed',
          details: 'File was successfully indexed during diagnostic'
        });
      } catch (readError) {
        // Capture the actual read error
        const errorMsg = readError instanceof Error ? readError.message : String(readError);
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          issue: 'Read/Parse error',
          details: `${errorMsg} (Path: ${file.file_path})`
        });
      }
      
    } catch (error) {
      results.push({
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        issue: 'Diagnostic error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Summarize issues
  const summary = results.reduce((acc, r) => {
    acc[r.issue] = (acc[r.issue] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 FULL DIAGNOSTIC RESULTS');
  console.log('='.repeat(80));
  console.log('\nIssue Summary:');
  Object.entries(summary).forEach(([issue, count]) => {
    console.log(`  ${issue}: ${count}`);
  });
  
  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED RESULTS (All ' + results.length + ' issues):');
  console.log('-'.repeat(80) + '\n');
  
  // Log all results
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.meetingTitle}`);
    console.log(`   Issue: ${result.issue}`);
    console.log(`   Details: ${result.details}`);
    console.log(`   Meeting ID: ${result.meetingId}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log(`END OF DIAGNOSTICS (${results.length} total issues)`);
  console.log('='.repeat(80) + '\n');
  
  return results;
}

/**
 * Get detailed stats about indexing status
 */
export async function getIndexingStats() {
  const [
    totalMeetings,
    syncedMeetings,
    indexedMeetings,
    filesWithTranscripts,
    downloadedTranscripts
  ] = await Promise.all([
    db.meetings.count(),
    db.meetings.where('sync_status').equals('synced').count(),
    db.transcriptContent.count(),
    db.files.where('file_type').equals('transcript_json').count(),
    db.files.where('[file_type+status]').equals(['transcript_json', 'downloaded']).count()
  ]);
  
  return {
    totalMeetings,
    syncedMeetings,
    indexedMeetings,
    filesWithTranscripts,
    downloadedTranscripts,
    unindexed: syncedMeetings - indexedMeetings
  };
}

/**
 * Try to re-index specific failed meetings
 */
export async function retryFailedMeetings(meetingIds: string[]): Promise<{
  succeeded: string[];
  failed: { id: string; error: string }[];
}> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  
  const { ingestSingleTranscript } = await import('./transcript-ingestion');
  
  for (const id of meetingIds) {
    try {
      const meeting = await db.meetings.get(id);
      if (!meeting) {
        failed.push({ id, error: 'Meeting not found' });
        continue;
      }
      
      await ingestSingleTranscript(meeting);
      succeeded.push(id);
      console.log(`✅ Successfully indexed: ${meeting.title}`);
    } catch (error) {
      failed.push({ 
        id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.error(`❌ Failed to index ${id}:`, error);
    }
  }
  
  return { succeeded, failed };
}

