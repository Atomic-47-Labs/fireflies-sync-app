// UI Component for database migration
import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { migrateFilePaths, checkFilePathFormats } from '../lib/db/migrate-file-paths';
import { fixPathUnderscores, previewPathFixes } from '../lib/db/fix-path-underscores';

export function DatabaseMigration() {
  const [status, setStatus] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  const handleCheckPaths = async () => {
    setStatus('Checking file paths...');
    try {
      const files = await checkFilePathFormats();
      setStatus(`Found ${files.length} sample files. Check console for details.`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handlePreview = async () => {
    setStatus('Previewing fixes...');
    try {
      const fixes = await previewPathFixes();
      setStatus(`Found ${fixes.length} paths to fix. Check console for details.`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleFixPaths = async () => {
    if (!confirm('This will fix all file paths with __ to _-_ pattern. Continue?')) {
      return;
    }

    setIsRunning(true);
    setStatus('Fixing file paths...');

    try {
      const result = await fixPathUnderscores();
      setStatus(`✅ Success! Fixed ${result.fixed} paths, ${result.unchanged} unchanged, ${result.errors.length} errors.`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('This will update all file paths in the database. Continue?')) {
      return;
    }

    setIsRunning(true);
    setStatus('Migrating file paths...');

    try {
      const result = await migrateFilePaths();
      setStatus(`✅ Success! Checked ${result.total} files, updated ${result.updated} paths.`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Database Migration</h3>
          <p className="text-sm text-gray-600 mt-1">
            Update file paths after moving your download directory
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <div className="font-semibold text-yellow-900 mb-1">⚠️ Path Mismatch Detected</div>
            <div className="text-yellow-800">
              Your database has paths with <code className="bg-yellow-100 px-1 rounded">__</code> but 
              folders use <code className="bg-yellow-100 px-1 rounded">_-</code> pattern. 
              Click "Fix Paths" to update the database.
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handlePreview} variant="outline" size="sm" disabled={isRunning}>
              Preview Fixes
            </Button>
            
            <Button onClick={handleFixPaths} variant="primary" size="sm" disabled={isRunning}>
              {isRunning ? 'Fixing...' : '🔧 Fix Paths'}
            </Button>
            
            <Button onClick={handleCheckPaths} variant="outline" size="sm" disabled={isRunning}>
              Check Paths
            </Button>
          </div>
        </div>

        {status && (
          <div className={`text-sm p-3 rounded ${
            status.includes('Error') || status.includes('❌') 
              ? 'bg-red-50 text-red-800' 
              : status.includes('Success') || status.includes('✅')
              ? 'bg-green-50 text-green-800'
              : 'bg-blue-50 text-blue-800'
          }`}>
            {status}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <p>
            <strong>Good news:</strong> File paths in the database are already relative (e.g., "2024-03/Meeting-Name/file.json")
          </p>
          <p>
            <strong>Action needed:</strong> Just select your new download directory using the "📁 Select Folder" button at the top of the page
          </p>
          <p>
            The app uses the File System Access API, which means you just need to grant permission to the new folder location.
          </p>
        </div>
      </div>
    </Card>
  );
}

