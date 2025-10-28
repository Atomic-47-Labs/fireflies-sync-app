// Fix path mismatches: convert __ to _-_ in database paths
import { db } from './index';

export interface PathFixResult {
  total: number;
  fixed: number;
  unchanged: number;
  errors: Array<{ meetingId: string; error: string }>;
}

/**
 * Fix file paths in database to match actual folder structure
 * Converts double underscores (__) to (_-) pattern
 */
export async function fixPathUnderscores(): Promise<PathFixResult> {
  console.log('🔧 Starting path fix migration...');
  
  const result: PathFixResult = {
    total: 0,
    fixed: 0,
    unchanged: 0,
    errors: []
  };
  
  try {
    // Get all file records
    const allFiles = await db.files.toArray();
    result.total = allFiles.length;
    
    console.log(`Found ${allFiles.length} file records`);
    
    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      
      await db.transaction('rw', db.files, async () => {
        for (const file of batch) {
          try {
            if (!file.file_path) {
              result.unchanged++;
              continue;
            }
            
            // Check if path contains double underscores or wrong pattern
            const needsFix = file.file_path.includes('__') || file.file_path.includes('_-_-');
            
            if (needsFix) {
              // First fix any _-_- back to _-
              let fixedPath = file.file_path.replace(/_-_-/g, '_-');
              // Then convert remaining __ to _-
              fixedPath = fixedPath.replace(/__/g, '_-');
              
              console.log(`Fixing: ${file.file_path}`);
              console.log(`     → ${fixedPath}`);
              
              await db.files.update(file.id!, {
                file_path: fixedPath
              });
              
              result.fixed++;
            } else {
              result.unchanged++;
            }
            
          } catch (error) {
            result.errors.push({
              meetingId: file.meeting_id,
              error: error instanceof Error ? error.message : String(error)
            });
            console.error(`Error fixing path for ${file.meeting_id}:`, error);
          }
        }
      });
      
      console.log(`Progress: ${Math.min(i + batchSize, allFiles.length)}/${allFiles.length}`);
    }
    
    console.log('\n✅ Path fix complete:');
    console.log(`   Total files: ${result.total}`);
    console.log(`   Fixed: ${result.fixed}`);
    console.log(`   Unchanged: ${result.unchanged}`);
    console.log(`   Errors: ${result.errors.length}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Path fix migration failed:', error);
    throw error;
  }
}

/**
 * Preview what would be fixed without making changes
 */
export async function previewPathFixes(): Promise<Array<{ old: string; new: string }>> {
  const allFiles = await db.files.toArray();
  const fixes: Array<{ old: string; new: string }> = [];
  
  for (const file of allFiles) {
    if (file.file_path) {
      const needsFix = file.file_path.includes('__') || file.file_path.includes('_-_-');
      
      if (needsFix) {
        // First fix any _-_- back to _-
        let fixedPath = file.file_path.replace(/_-_-/g, '_-');
        // Then convert remaining __ to _-
        fixedPath = fixedPath.replace(/__/g, '_-');
        
        fixes.push({
          old: file.file_path,
          new: fixedPath
        });
      }
    }
  }
  
  console.log(`\n📋 Preview: Would fix ${fixes.length} paths`);
  console.log('Examples (first 10):\n');
  fixes.slice(0, 10).forEach(fix => {
    console.log(`  OLD: ${fix.old}`);
    console.log(`  NEW: ${fix.new}`);
    console.log('');
  });
  
  return fixes;
}

