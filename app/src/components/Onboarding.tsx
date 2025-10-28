import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardHeader, CardContent } from './ui/Card';
import { apiClient } from '../lib/api';
import { fileSystem } from '../lib/storage';
import { db } from '../lib/db';
import { encryptValue } from '../lib/utils/crypto';
import { useAppStore } from '../stores/appStore';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [directoryPath, setDirectoryPath] = useState('');
  
  const { setAuthenticated, setDirectory, setFileTypePreferences } = useAppStore();

  const totalSteps = 4;

  // Step 1: Welcome
  const renderWelcome = () => (
    <div className="text-center">
      <div className="text-6xl mb-6">🎯</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        A47L - Fireflies Transcript Sync App
      </h2>
      <p className="text-sm text-gray-500 mb-2">
        Made with ❤️ by{' '}
        <a 
          href="https://atomic47.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline"
        >
          Atomic 47 Labs Inc
        </a>
      </p>
      <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
        Download and manage your Fireflies transcripts from your desktop!
      </p>
      <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-md mx-auto">
        <div className="flex items-start gap-2 text-amber-900">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-left">
            <div className="font-semibold mb-1">Fireflies API Key Required</div>
            <div>You'll need your Fireflies API key to get started. Don't worry, we'll show you how to get it!</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 text-left max-w-md mx-auto mb-8">
        <div className="flex items-start gap-3">
          <div className="text-2xl">✓</div>
          <div>
            <div className="font-medium">Secure Local Storage</div>
            <div className="text-sm text-gray-600">Your data stays on your computer</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-2xl">⚡</div>
          <div>
            <div className="font-medium">Bulk Downloads</div>
            <div className="text-sm text-gray-600">Download all your meetings at once</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-2xl">📁</div>
          <div>
            <div className="font-medium">Smart Organization</div>
            <div className="text-sm text-gray-600">Automatic folder structure by date</div>
          </div>
        </div>
      </div>
      <Button onClick={() => setStep(2)} size="lg">
        Get Started →
      </Button>
    </div>
  );

  // Step 2: API Key
  const handleValidateApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      apiClient.setApiKey(apiKey);
      const result = await apiClient.testConnection();

      if (result.success && result.user) {
        // Encrypt and store API key
        const encrypted = await encryptValue(apiKey);
        await db.setConfig('api_key_encrypted', encrypted);
        await db.setConfig('api_key_valid', true);
        await db.setConfig('user_email', result.user.email);

        setAuthenticated(apiKey, result.user.email);
        setStep(3);
      } else {
        setError(result.message || 'Failed to validate API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const renderApiKey = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect to Fireflies</h2>
      <p className="text-gray-600 mb-6">
        Enter your Fireflies API key to access your meetings. You can find this in your 
        Fireflies account settings under API Keys.
      </p>
      
      <Input
        label="API Key"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        error={error}
        helperText="Your API key is encrypted before storage"
        placeholder="Enter your Fireflies API key"
        onKeyPress={(e) => e.key === 'Enter' && handleValidateApiKey()}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="font-medium text-blue-900 mb-1">How to get your API key:</div>
        <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
          <li>Log in to your Fireflies account</li>
          <li>Navigate to Settings → Integrations → API</li>
          <li>Generate a new API key if you don't have one</li>
          <li>Copy and paste it here</li>
        </ol>
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)}>
          ← Back
        </Button>
        <Button 
          onClick={handleValidateApiKey} 
          isLoading={isValidating}
          className="flex-1"
        >
          {isValidating ? 'Validating...' : 'Continue →'}
        </Button>
      </div>
    </div>
  );

  // Step 3: Directory Selection
  const handleSelectDirectory = async () => {
    try {
      const { handle, path } = await fileSystem.selectDirectory({
        startIn: 'documents',
      });

      setDirectoryPath(path);
      setDirectory(handle, path);
      
      // Save to config (IndexedDB can store FileSystemDirectoryHandle!)
      await db.setConfig('directory_path_display', path);
      await db.setConfig('directory_handle', handle);
      
      setStep(4);
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        // User cancelled, that's okay
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to select directory');
    }
  };

  const renderDirectory = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Download Location</h2>
      <p className="text-gray-600 mb-6">
        Select where you'd like to save your downloaded meetings. 
        We'll create an organized folder structure for you.
      </p>

      {directoryPath ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <div className="flex items-center gap-2 text-green-900">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Selected: {directoryPath}</span>
          </div>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center mb-6">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-gray-600 mb-4">No directory selected</p>
          <Button onClick={handleSelectDirectory}>
            Select Download Folder
          </Button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-red-800">
          {error}
        </div>
      )}

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
        <div className="font-medium text-gray-900 mb-2">Folder structure:</div>
        <div className="text-sm text-gray-600 font-mono space-y-1">
          <div>{directoryPath || '[Your Folder]'}/</div>
          <div className="ml-4">└── 2025/</div>
          <div className="ml-8">└── 09/</div>
          <div className="ml-12">└── 2025-09-30_meeting-title/</div>
          <div className="ml-16">├── audio.mp3</div>
          <div className="ml-16">├── transcript.json</div>
          <div className="ml-16">├── summary.md</div>
          <div className="ml-16">└── metadata.json</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(2)}>
          ← Back
        </Button>
        {directoryPath && (
          <Button onClick={() => setStep(4)} className="flex-1">
            Continue →
          </Button>
        )}
      </div>
    </div>
  );

  // Step 4: File Type Preferences
  const [fileTypes, setFileTypes] = useState({
    audio: true,
    transcript_docx: true,
    transcript_json: true,
    summary: true,
  });

  const handleComplete = async () => {
    // Save preferences
    await db.setConfig('file_types', fileTypes);
    await db.setConfig('onboarding_completed', true);
    setFileTypePreferences(fileTypes);
    
    onComplete();
  };

  const renderFileTypes = () => (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose File Types</h2>
      <p className="text-gray-600 mb-6">
        Select which file types you'd like to download. You can change this later in settings.
      </p>

      <div className="space-y-4 mb-8">
        {[
          { key: 'audio' as const, label: 'Audio Files (MP3)', desc: 'Original audio recordings', size: '~60MB per hour' },
          { key: 'transcript_json' as const, label: 'Transcript (JSON)', desc: 'Structured transcript data', size: '~150KB typical' },
          { key: 'transcript_docx' as const, label: 'Transcript (Word)', desc: 'Formatted document', size: '~200KB typical' },
          { key: 'summary' as const, label: 'Summary (Markdown)', desc: 'AI-generated summary', size: '~3KB typical' },
        ].map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ borderColor: fileTypes[item.key] ? '#3b82f6' : '#e5e7eb' }}
          >
            <input
              type="checkbox"
              checked={fileTypes[item.key]}
              onChange={(e) => setFileTypes({ ...fileTypes, [item.key]: e.target.checked })}
              className="mt-1 w-5 h-5"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{item.label}</div>
              <div className="text-sm text-gray-600">{item.desc}</div>
              <div className="text-xs text-gray-500 mt-1">{item.size}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
        <div className="font-medium text-blue-900 mb-1">💡 Tip</div>
        <div className="text-sm text-blue-800">
          Audio files are the largest. If you're limited on storage, you can skip them and 
          download only the transcripts and summaries.
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(3)}>
          ← Back
        </Button>
        <Button onClick={handleComplete} className="flex-1" size="lg">
          Complete Setup ✓
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-2xl">
        <CardHeader>
          {step > 1 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Step {step} of {totalSteps}</span>
                <span>{Math.round((step / totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(step / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {step === 1 && renderWelcome()}
          {step === 2 && renderApiKey()}
          {step === 3 && renderDirectory()}
          {step === 4 && renderFileTypes()}
        </CardContent>
      </Card>
    </div>
  );
}

