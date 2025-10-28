// Quick component to verify directory access
import { useState } from 'react';
import { fileSystem } from '../lib/storage';
import { Button } from './ui/Button';

export function DirectoryCheck() {
  const [status, setStatus] = useState<string>('');

  const checkDirectory = async () => {
    try {
      const rootHandle = fileSystem.getRootHandle();
      if (!rootHandle) {
        setStatus('❌ No directory selected');
        return;
      }

      setStatus('✅ Directory handle exists, checking access...');

      // Try to list directories
      const entries = [];
      for await (const entry of (rootHandle as any).values()) {
        entries.push(entry.name);
        if (entries.length >= 5) break; // Just check first 5
      }

      setStatus(`✅ Directory access works! Found folders: ${entries.join(', ')}`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="p-4 border rounded bg-gray-50">
      <h3 className="font-semibold mb-2">Directory Access Test</h3>
      <Button onClick={checkDirectory} size="sm">
        Test Directory Access
      </Button>
      {status && (
        <div className="mt-2 text-sm">
          {status}
        </div>
      )}
    </div>
  );
}

