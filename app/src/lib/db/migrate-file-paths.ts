// Utility to update file paths in database after moving files
import { db } from './index';

/**
 * Update all file paths in the database
 * This is useful when you move your download directory to a new location
 */
export async function migrateFilePaths() {
  console.log('🔄 Starting file path migration...');
  
  try {
    // Get all file records
    const allFiles = await db.files.toArray();
    console.log(`📊 Found ${allFiles.length} file records to update`);
    
    let updated = 0;
    const batchSize = 100;
    
    // Process in batches
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      
      await db.transaction('rw', db.files, async () => {
        for (const file of batch) {
          // File paths should already be relative (e.g., "2024-03/2024-03-18_Meeting/transcript.json")
          // No changes needed - they're already relative to the download directory
          // The File System Access API handles the root directory dynamically
          
          // Just verify the format is correct
          if (file.file_path && !file.file_path.startsWith('/')) {
            // Path is already relative - perfect!
            updated++;
          } else if (file.file_path && file.file_path.startsWith('/')) {
            // Convert absolute path to relative
            const parts = file.file_path.split('/');
            const monthFolderIndex = parts.findIndex(p => /^\d{4}-\d{2}$/.test(p));
            
            if (monthFolderIndex >= 0) {
              // Extract relative path from month folder onwards
              const relativePath = parts.slice(monthFolderIndex).join('/');
              await db.files.update(file.id!, { file_path: relativePath });
              updated++;
              console.log(`Updated: ${file.file_path} → ${relativePath}`);
            }
          }
        }
      });
      
      console.log(`Progress: ${Math.min(i + batchSize, allFiles.length)}/${allFiles.length}`);
    }
    
    console.log(`✅ Migration complete: ${updated} file paths verified/updated`);
    return { total: allFiles.length, updated };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Check current file path formats
 */
export async function checkFilePathFormats() {
  const files = await db.files.limit(10).toArray();
  
  console.log('Sample file paths:');
  files.forEach(file => {
    console.log(`${file.meeting_id}: ${file.file_path}`);
  });
  
  return files;
}

