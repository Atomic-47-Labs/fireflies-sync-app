// Debug utility to check file paths in database
import { db } from '../db';

export async function debugFilePaths() {
  // Get a sample of transcript files
  const files = await db.files
    .where('file_type')
    .equals('transcript_json')
    .limit(10)
    .toArray();

  console.log('Sample transcript file paths:');
  files.forEach(file => {
    console.log(`Meeting ID: ${file.meeting_id}`);
    console.log(`File path: ${file.file_path}`);
    console.log(`Status: ${file.status}`);
    console.log('---');
  });

  return files;
}

export async function testReadOneFile() {
  const files = await db.files
    .where('file_type')
    .equals('transcript_json')
    .and(f => f.status === 'downloaded')
    .limit(1)
    .toArray();

  if (files.length === 0) {
    console.log('No downloaded transcript files found');
    return null;
  }

  const file = files[0];
  console.log('Testing file:', file.file_path);
  
  // Try to parse the path
  const parts = file.file_path.split('/');
  console.log('Path parts:', parts);
  
  // Look for month folder pattern
  for (let i = 0; i < parts.length; i++) {
    console.log(`Part ${i}: "${parts[i]}" - matches YYYY-MM?`, /^\d{4}-\d{2}$/.test(parts[i]));
  }
  
  return file;
}

