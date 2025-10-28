import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { db } from '../lib/db';
import { meetingDiscovery } from '../lib/api';
import { downloadQueue } from '../lib/storage';
import { apiClient } from '../lib/api';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { formatRelativeTime } from '../lib/utils';

interface DashboardProps {
  onResetSetup?: () => void;
}

export function Dashboard({ onResetSetup }: DashboardProps = {}) {
  const {
    meetings,
    setMeetings,
    userEmail,
    directoryPath,
    isLoading,
    setLoading,
    setError,
    getSyncStats,
    logout,
  } = useAppStore();

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Load meetings from database on mount
  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      const allMeetings = await db.meetings.toArray();
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    }
  };

  const handleDiscoverMeetings = async () => {
    setIsDiscovering(true);
    setLoading(true);
    setError(null);
    setLocalError(null);

    try {
      const discovered = await meetingDiscovery.discoverMeetings({
        years: 3,
        onProgress: (progress) => {
          setDiscoveryProgress(progress.message);
        },
      });

      setMeetings(discovered);
      setError(null);
      setLocalError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to discover meetings';
      setError(errorMessage);
      setLocalError(errorMessage);
      console.error('Discovery error:', error);
    } finally {
      setIsDiscovering(false);
      setLoading(false);
      setDiscoveryProgress('');
    }
  };

  const handleSyncAll = async () => {
    const unsynced = meetings.filter(m => m.sync_status === 'not_synced');
    
    if (unsynced.length === 0) {
      alert('All meetings are already synced!');
      return;
    }

    const confirm = window.confirm(
      `Start downloading ${unsynced.length} meetings? This may take a while.`
    );

    if (!confirm) return;

    try {
      await downloadQueue.addMultipleToQueue(
        unsynced,
        ['audio', 'transcript_json', 'transcript_docx', 'summary']
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start downloads');
    }
  };

  const handleResetSetup = async () => {
    const confirm = window.confirm(
      'This will clear your API key and settings. You will need to complete setup again. Continue?'
    );

    if (!confirm) return;

    try {
      // Clear all config
      await db.setConfig('onboarding_completed', false);
      await db.setConfig('api_key_encrypted', null);
      await db.setConfig('api_key_valid', false);
      await db.setConfig('user_email', null);
      
      // Clear API client
      apiClient.clearApiKey();
      
      // Logout from store
      logout();

      // Trigger parent to reset
      if (onResetSetup) {
        onResetSetup();
      } else {
        // Fallback: reload page
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to reset setup:', error);
      alert('Failed to reset setup. Please try again.');
    }
  };

  const stats = getSyncStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fireflies Downloader</h1>
              <p className="text-sm text-gray-600">{userEmail}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <div className="text-gray-600">Storage Location</div>
                <div className="font-medium text-gray-900">{directoryPath || 'Not selected'}</div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetSetup}
                title="Reset API key and settings"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <div className="text-sm text-blue-700">Total Meetings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">{stats.synced}</div>
              <div className="text-sm text-green-700">Synced</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-900">{stats.syncing}</div>
              <div className="text-sm text-yellow-700">In Progress</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-900">{stats.failed}</div>
              <div className="text-sm text-red-700">Failed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-8 flex gap-4">
          <Button
            onClick={handleDiscoverMeetings}
            isLoading={isDiscovering}
            disabled={isLoading}
            size="lg"
          >
            {isDiscovering ? 'Discovering...' : 'Discover Meetings'}
          </Button>
          <Button
            onClick={handleSyncAll}
            variant="primary"
            disabled={isLoading || meetings.length === 0 || stats.not_synced === 0}
            size="lg"
          >
            Sync All ({stats.not_synced})
          </Button>
        </div>

        {isDiscovering && discoveryProgress && (
          <Card className="mb-8 p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-gray-700">{discoveryProgress}</span>
            </div>
          </Card>
        )}

        {localError && (
          <Card className="mb-8 p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <div className="font-medium text-red-900">Error</div>
                <div className="text-sm text-red-800 mt-1">{localError}</div>
                {localError.includes('API key') && (
                  <div className="mt-3">
                    <div className="text-sm text-red-700 mb-2">
                      💡 Your API key may be invalid or expired. Click below to enter a new one.
                    </div>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={handleResetSetup}
                    >
                      Reset & Enter New API Key
                    </Button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setLocalError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </Card>
        )}

        {/* Meeting Stats */}
        {meetings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6">
              <div className="text-gray-600 text-sm mb-1">Completion Rate</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.total > 0 ? Math.round((stats.synced / stats.total) * 100) : 0}%
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {stats.synced} of {stats.total} meetings synced
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-gray-600 text-sm mb-1">Ready to Download</div>
              <div className="text-3xl font-bold text-blue-600">{stats.not_synced}</div>
              <div className="mt-2 text-sm text-gray-500">
                Meetings pending download
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-gray-600 text-sm mb-1">Last Sync</div>
              <div className="text-xl font-medium text-gray-900">
                {meetings.length > 0 
                  ? formatRelativeTime(Math.max(...meetings.map(m => m.updated_at)))
                  : 'Never'}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Most recent update
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📥</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Meetings Yet</h2>
            <p className="text-gray-600 mb-6">
              Click "Discover Meetings" to fetch your meeting history from Fireflies.
            </p>
            <Button onClick={handleDiscoverMeetings} isLoading={isDiscovering} size="lg">
              {isDiscovering ? 'Discovering...' : 'Get Started'}
            </Button>
          </Card>
        )}

        {/* Recent Meetings Preview */}
        {meetings.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Meetings</h2>
            <div className="space-y-3">
              {meetings.slice(0, 5).map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{meeting.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(meeting.date).toLocaleDateString()} • {Math.round(meeting.duration / 60)} min
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        meeting.sync_status === 'synced'
                          ? 'bg-green-100 text-green-800'
                          : meeting.sync_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : meeting.sync_status === 'syncing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {meeting.sync_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {meetings.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="ghost">View All Meetings →</Button>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

