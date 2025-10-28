// Debug path mismatches between database and filesystem
import { db } from '../db';
import { fileSystem } from '../storage';

export interface PathMismatch {
  meetingId: string;
  meetingTitle: string;
  dbPath: string;
  actualFolders?: string[];
  monthExists: boolean;
  meetingFolderExists: boolean;
  fileExists: boolean;
}

/**
 * Compare database paths with actual filesystem to find mismatches
 */
export async function debugPathMismatches(): Promise<PathMismatch[]> {
  console.log('🔍 Debugging path mismatches...');
  
  const results: PathMismatch[] = [];
  
  // Get root handle
  const rootHandle = fileSystem.getRootHandle();
  if (!rootHandle) {
    throw new Error('No directory handle available');
  }
  
  // Get all meetings with transcript files
  const allMeetings = await db.meetings.where('sync_status').equals('synced').toArray();
  const indexedMeetings = await db.transcriptContent.toCollection().primaryKeys();
  const indexedSet = new Set(indexedMeetings);
  const unindexedMeetings = allMeetings.filter(m => !indexedSet.has(m.id));
  
  console.log(`Checking ${unindexedMeetings.length} unindexed meetings...`);
  
  for (const meeting of unindexedMeetings.slice(0, 20)) { // Limit to first 20
    try {
      // Get file record
      const files = await db.files
        .where('[meeting_id+file_type]')
        .equals([meeting.id, 'transcript_json'])
        .toArray();
      
      if (files.length === 0) continue;
      
      const file = files[0];
      if (!file.file_path) continue;
      
      const dbPath = file.file_path;
      const parts = dbPath.split('/');
      
      // Find month and meeting folders
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
      
      if (!monthFolder || !meetingFolder) continue;
      
      // Check what actually exists
      let monthExists = false;
      let meetingFolderExists = false;
      let fileExists = false;
      let actualFolders: string[] = [];
      
      try {
        // Check month folder
        const monthHandle = await rootHandle.getDirectoryHandle(monthFolder, { create: false });
        monthExists = true;
        
        // List actual folders in month directory
        for await (const entry of monthHandle.values()) {
          if (entry.kind === 'directory') {
            actualFolders.push(entry.name);
          }
        }
        
        // Check if our expected meeting folder exists
        try {
          const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder, { create: false });
          meetingFolderExists = true;
          
          // Check if transcript.json exists
          try {
            await meetingHandle.getFileHandle('transcript.json', { create: false });
            fileExists = true;
          } catch {
            fileExists = false;
          }
        } catch {
          meetingFolderExists = false;
        }
        
      } catch {
        monthExists = false;
      }
      
      // Only add to results if there's a problem
      if (!fileExists) {
        results.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          dbPath,
          actualFolders: actualFolders.slice(0, 5), // First 5 folders
          monthExists,
          meetingFolderExists,
          fileExists
        });
        
        // Log detailed info
        console.log(`\n📁 ${meeting.title}`);
        console.log(`   DB Path: ${dbPath}`);
        console.log(`   Month exists: ${monthExists}`);
        console.log(`   Meeting folder exists: ${meetingFolderExists}`);
        console.log(`   File exists: ${fileExists}`);
        if (actualFolders.length > 0) {
          console.log(`   Actual folders in ${monthFolder}:`, actualFolders.slice(0, 3));
        }
      }
      
    } catch (error) {
      console.error(`Error checking ${meeting.title}:`, error);
    }
  }
  
  return results;
}

/**
 * List actual month folders and sample meeting folders
 */
export async function listActualFolders(): Promise<void> {
  const rootHandle = fileSystem.getRootHandle();
  if (!rootHandle) {
    throw new Error('No directory handle available');
  }
  
  console.log('\n📂 Actual folder structure:');
  
  // List month folders
  const monthFolders: string[] = [];
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'directory' && /^\d{4}-\d{2}$/.test(entry.name)) {
      monthFolders.push(entry.name);
    }
  }
  
  monthFolders.sort();
  console.log(`\nMonth folders: ${monthFolders.slice(0, 5).join(', ')}...`);
  
  // Sample one month folder
  if (monthFolders.length > 0) {
    const sampleMonth = monthFolders[0];
    const monthHandle = await rootHandle.getDirectoryHandle(sampleMonth, { create: false });
    
    const meetingFolders: string[] = [];
    for await (const entry of monthHandle.values()) {
      if (entry.kind === 'directory') {
        meetingFolders.push(entry.name);
        if (meetingFolders.length >= 3) break;
      }
    }
    
    console.log(`\nSample meeting folders in ${sampleMonth}:`);
    meetingFolders.forEach(f => console.log(`   ${f}`));
  }
}

/**
 * Compare database filenames with actual filenames
 */
export async function comparePaths(): Promise<void> {
  const rootHandle = fileSystem.getRootHandle();
  if (!rootHandle) {
    throw new Error('No directory handle available');
  }
  
  console.log('\n🔍 Comparing database paths with actual filesystem...\n');
  
  // Get sample unindexed meeting
  const allMeetings = await db.meetings.where('sync_status').equals('synced').toArray();
  const indexedMeetings = await db.transcriptContent.toCollection().primaryKeys();
  const indexedSet = new Set(indexedMeetings);
  const unindexedMeetings = allMeetings.filter(m => !indexedSet.has(m.id));
  
  const sampleMeeting = unindexedMeetings[0];
  if (!sampleMeeting) {
    console.log('No unindexed meetings found');
    return;
  }
  
  const files = await db.files
    .where('[meeting_id+file_type]')
    .equals([sampleMeeting.id, 'transcript_json'])
    .toArray();
  
  if (files.length === 0) return;
  
  const dbPath = files[0].file_path;
  console.log(`Sample meeting: ${sampleMeeting.title}`);
  console.log(`Database path: ${dbPath}`);
  
  // Extract parts
  const parts = dbPath.split('/');
  let monthFolder = '';
  let meetingFolder = '';
  
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{4}-\d{2}$/.test(parts[i])) {
      monthFolder = parts[i];
      if (i + 1 < parts.length) {
        meetingFolder = parts[i + 1];
      }
      break;
    }
  }
  
  console.log(`\nExtracted from DB path:`);
  console.log(`  Month folder: "${monthFolder}"`);
  console.log(`  Meeting folder: "${meetingFolder}"`);
  
  // Check what actually exists
  try {
    const monthHandle = await rootHandle.getDirectoryHandle(monthFolder, { create: false });
    console.log(`\n✅ Month folder "${monthFolder}" exists`);
    
    // List actual meeting folders
    const actualFolders: string[] = [];
    for await (const entry of monthHandle.values()) {
      if (entry.kind === 'directory') {
        actualFolders.push(entry.name);
      }
    }
    
    console.log(`\nActual meeting folders in this month (first 10):`);
    actualFolders.slice(0, 10).forEach(f => console.log(`  "${f}"`));
    
    // Try to find a similar folder
    const similar = actualFolders.filter(f => 
      f.toLowerCase().includes(sampleMeeting.title.substring(0, 10).toLowerCase()) ||
      meetingFolder.toLowerCase().includes(f.substring(0, 10).toLowerCase())
    );
    
    if (similar.length > 0) {
      console.log(`\n🔎 Possibly similar folders:`);
      similar.forEach(f => console.log(`  "${f}"`));
    }
    
    // Try the exact folder
    try {
      await monthHandle.getDirectoryHandle(meetingFolder, { create: false });
      console.log(`\n✅ Meeting folder "${meetingFolder}" exists!`);
    } catch {
      console.log(`\n❌ Meeting folder "${meetingFolder}" NOT FOUND`);
    }
    
  } catch {
    console.log(`\n❌ Month folder "${monthFolder}" NOT FOUND`);
  }
}

