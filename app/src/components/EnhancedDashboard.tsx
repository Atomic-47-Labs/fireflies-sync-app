import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { db } from '../lib/db';
import { meetingDiscovery, apiClient } from '../lib/api';
import { downloadQueue } from '../lib/storage/enhanced-download-queue';
import type { Meeting, FileType } from '../types';
import type { DownloadJob } from '../lib/storage/enhanced-download-queue';
import { fileSystem, generateTranscriptJSON, generateTranscriptDOCX, scanDirectory } from '../lib/storage';
import { importFromLocalDirectory } from '../lib/storage/local-import';
import { processTranscriptForSearch } from '../lib/search/content-extractor';
import { searchEngine } from '../lib/search';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Checkbox } from './ui/Checkbox';
import { Pagination } from './ui/Pagination';
import { ProgressBar } from './ui/ProgressBar';
// import { IngestionPanel } from './IngestionPanel';
// import { DatabaseMigration } from './DatabaseMigration';
import { TranscriptSearch } from './TranscriptSearch';
import { Analytics } from './Analytics';
import { formatRelativeTime } from '../lib/utils';

interface DashboardProps {
  onResetSetup?: () => void;
}

export function EnhancedDashboard({ onResetSetup }: DashboardProps = {}) {
  const {
    meetings,
    setMeetings,
    userEmail,
    directoryPath,
    setDirectory,
    setError,
    getSyncStats,
    logout,
  } = useAppStore();

  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [activeJobs, setActiveJobs] = useState<DownloadJob[]>([]);

  // Pagination & filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration' | 'organizer_email'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'not_synced'>('all');

  // Selection state
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  
  // View state
  const [activeView, setActiveView] = useState<'meetings' | 'search' | 'analytics'>('meetings');

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    downloading: 0,
    paused: 0,
    overallProgress: 0,
  });

  // Rate limiting state
  const [requestsPerMinute, setRequestsPerMinute] = useState(() => {
    const settings = downloadQueue.getRateLimitSettings();
    return settings.requestsPerMinute;
  });
  const [showRateSettings, setShowRateSettings] = useState(false);

  // File status cache
  const [meetingFiles, setMeetingFiles] = useState<Map<string, any[]>>(new Map());

  // Load meetings from IndexedDB on mount and auto-scan directory
  useEffect(() => {
    const initializeApp = async () => {
      await loadMeetings();
      
      // Auto-scan directory if it's already selected
      const rootHandle = fileSystem.getRootHandle();
      if (rootHandle && meetings.length > 0) {
        console.log('Auto-scanning directory on app load...');
        setIsScanning(true);
        setScanProgress('Checking for existing files...');
        
        try {
          await scanDirectory(rootHandle, (message) => {
            setScanProgress(message);
          });
          await loadMeetings(); // Reload with updated statuses
        } catch (error) {
          console.warn('Auto-scan failed:', error);
        } finally {
          setIsScanning(false);
          setScanProgress('');
        }
      }
    };
    
    initializeApp();
  }, []);

  // Subscribe to download queue events
  useEffect(() => {
    const handleProgress = () => {
      const progress = downloadQueue.getProgress();
      setQueueStats(progress);
      setDownloadProgress(progress.overallProgress);
      
      // Update active jobs list
      const jobs = downloadQueue.getJobs();
      const downloading = jobs.filter(j => j.status === 'downloading');
      setActiveJobs(downloading);
    };

    const handleJobCompleted = async (job: DownloadJob) => {
      // Update meeting status in database
      try {
        await db.meetings.update(job.meetingId, {
          sync_status: 'synced',
          updated_at: Date.now(),
        });
        loadMeetings(); // Reload to update UI
      } catch (error) {
        console.error('Failed to update meeting status:', error);
      }
      handleProgress();
    };

    const handleComplete = () => {
      const progress = downloadQueue.getProgress();
      if (progress.pending === 0 && progress.downloading === 0) {
        setIsDownloading(false);
        loadMeetings(); // Final reload
      }
    };

    // Set up the download processor
    const processDownload = async (job: DownloadJob, onProgress: (progress: number) => void) => {
      try {
        console.log('Processing download job:', job);
        
        // Set initial operation
        job.currentOperation = 'Initializing...';
        
        // Get fresh meeting data from database instead of stale closure
        const meeting = await db.meetings.get(job.meetingId);
        if (!meeting) {
          console.error('Meeting not found in database:', job.meetingId);
          throw new Error(`Meeting not found: ${job.meetingId}`);
        }

        console.log('Meeting found:', meeting.title);

        // Check if this is a locally-imported meeting (not from Fireflies API)
        if (meeting.id.startsWith('local-')) {
          console.log('Skipping download - meeting imported from local directory');
          throw new Error('This meeting was imported from your local directory. Files already exist - no need to download.');
        }

        // Check if we have directory permission - get fresh from fileSystem
        const rootHandle = fileSystem.getRootHandle();
        if (!rootHandle) {
          console.error('No directory handle available');
          throw new Error('No directory selected. Please select a download directory in Settings first.');
        }

        console.log('Directory handle confirmed');

        // Get full transcript data
        job.currentOperation = 'Fetching transcript from Fireflies API...';
        onProgress(10);
        const transcript = await apiClient.getTranscript(meeting.id);
        console.log('Transcript fetched:', transcript.id);
        
        onProgress(30);

        // Create folder structure: YYYY-MM/YYYY-MM-DD_MeetingTitle/
        const meetingDate = new Date(meeting.date);
        const monthFolder = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Sanitize title and create meeting folder
        // Remove invalid chars, replace spaces with hyphens, trim trailing periods/spaces/hyphens
        let sanitizedTitle = meeting.title
          .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
          .replace(/\s+/g, '-')            // Replace spaces with hyphens
          .replace(/\.+$/g, '')            // Remove trailing periods
          .replace(/[-_\s]+$/g, '')        // Remove trailing hyphens, underscores, spaces
          .replace(/^[-_\s.]+/g, '');      // Remove leading hyphens, underscores, spaces, periods
        
        // Ensure we have something after sanitization
        if (!sanitizedTitle) {
          sanitizedTitle = 'meeting';
        }
        
        const timestamp = meetingDate.toISOString().split('T')[0];
        const meetingFolder = `${timestamp}_${sanitizedTitle}`;

        console.log('Writing to folder:', monthFolder, '/', meetingFolder);

        onProgress(50);

        // Download based on file type
        let filePath = '';
        let fileSize = 0;
        
        switch (job.fileType) {
          case 'audio':
            job.fileName = 'audio.mp3';
            job.currentOperation = 'Downloading audio file...';
            if (meeting.audio_url) {
              console.log('Downloading audio from:', meeting.audio_url);
              
              try {
                // Use proxy server to bypass CORS
                const proxyUrl = `http://localhost:3001/proxy/audio?url=${encodeURIComponent(meeting.audio_url)}`;
                console.log('Fetching through proxy:', proxyUrl);
                
                const response = await fetch(proxyUrl);
                console.log('Proxy response status:', response.status, response.statusText);
                console.log('Proxy response headers:', {
                  contentType: response.headers.get('content-type'),
                  contentLength: response.headers.get('content-length')
                });
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('Proxy error response:', errorText);
                  throw new Error(`Proxy request failed: ${response.status} ${response.statusText} - ${errorText}`);
                }
                
                const blob = await response.blob();
                filePath = `${monthFolder}/${meetingFolder}/audio.mp3`;
                fileSize = blob.size;
                
                console.log('Audio blob received - type:', blob.type, 'size:', fileSize, 'bytes');
                
                // Check if blob size is suspiciously small (likely an error message)
                if (fileSize < 10000) {
                  const text = await blob.text();
                  console.error('Blob too small, content:', text);
                  throw new Error(`Downloaded file too small (${fileSize} bytes). Possible error: ${text.substring(0, 200)}`);
                }
                
                console.log('Writing audio file:', filePath, 'size:', fileSize);
                await fileSystem.writeFile(
                  [monthFolder, meetingFolder],
                  'audio.mp3',
                  blob
                );
                console.log('Audio file written successfully');
                onProgress(100);
                
              } catch (error: any) {
                console.error('Audio download failed:', error);
                
                // Fallback: save download link
                console.warn('Falling back to download link file');
                const refContent = `Audio Download Failed - Manual Download Required\n`;
                const refContent2 = `Meeting: ${meeting.title}\n`;
                const refContent3 = `Date: ${new Date(meeting.date).toLocaleDateString()}\n\n`;
                const refContent4 = `Error: ${error.message}\n\n`;
                const refContent5 = `Please download manually from:\n${meeting.audio_url}\n\n`;
                const refContent6 = `Note: This link expires in 24 hours from when it was generated.\n`;
                const refContent7 = `Generated at: ${new Date().toLocaleString()}\n\n`;
                const refContent8 = `Tip: Make sure the proxy server is running on port 3001.`;
                
                const refBlob = new Blob([
                  refContent + refContent2 + refContent3 + refContent4 + 
                  refContent5 + refContent6 + refContent7 + refContent8
                ], { type: 'text/plain' });
                
                filePath = `${monthFolder}/${meetingFolder}/audio-download-link.txt`;
                fileSize = refBlob.size;
                
                await fileSystem.writeFile(
                  [monthFolder, meetingFolder],
                  'audio-download-link.txt',
                  refBlob
                );
                
                console.log('Download link file saved');
              }
            } else {
              console.warn('No audio URL for meeting:', meeting.id);
              throw new Error('No audio URL available for this meeting');
            }
            break;

          case 'transcript_json':
            job.fileName = 'transcript.json';
            job.currentOperation = 'Generating JSON transcript...';
            const jsonContent = generateTranscriptJSON(transcript);
            const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
            filePath = `${monthFolder}/${meetingFolder}/transcript.json`;
            fileSize = jsonBlob.size;
            job.currentOperation = 'Writing JSON file to disk...';
            console.log('Writing JSON file:', filePath, 'size:', fileSize);
            await fileSystem.writeFile(
              [monthFolder, meetingFolder],
              'transcript.json',
              jsonBlob
            );
            console.log('JSON file written successfully');
            break;

          case 'transcript_docx':
            job.fileName = 'transcript.rtf';
            job.currentOperation = 'Generating RTF transcript...';
            const docxBlob = await generateTranscriptDOCX(transcript);
            filePath = `${monthFolder}/${meetingFolder}/transcript.rtf`;
            fileSize = docxBlob.size;
            job.currentOperation = 'Writing RTF file to disk...';
            console.log('Writing RTF file:', filePath, 'size:', fileSize);
            await fileSystem.writeFile(
              [monthFolder, meetingFolder],
              'transcript.rtf',
              docxBlob
            );
            console.log('RTF file written successfully');
            break;

          case 'summary':
            job.fileName = 'summary.txt';
            job.currentOperation = 'Generating summary file...';
            // Generate summary text file from transcript summary
            let summaryContent = `Meeting: ${meeting.title}\n`;
            summaryContent += `Date: ${new Date(meeting.date).toLocaleString()}\n`;
            summaryContent += `Duration: ${meeting.duration} minutes\n`;
            summaryContent += `Organizer: ${meeting.organizer_email}\n`;
            summaryContent += `\n${'='.repeat(60)}\n\n`;
            
            if (transcript.summary) {
              // Overview
              if (transcript.summary.overview) {
                summaryContent += `OVERVIEW:\n${transcript.summary.overview}\n\n`;
              }
              
              // Action Items - handle both array and string formats
              if (transcript.summary.action_items) {
                summaryContent += `ACTION ITEMS:\n`;
                if (Array.isArray(transcript.summary.action_items)) {
                  transcript.summary.action_items.forEach((item, i) => {
                    summaryContent += `${i + 1}. ${item}\n`;
                  });
                } else if (typeof transcript.summary.action_items === 'string') {
                  summaryContent += `${transcript.summary.action_items}\n`;
                }
                summaryContent += `\n`;
              }
              
              // Keywords
              if (transcript.summary.keywords) {
                summaryContent += `KEYWORDS:\n`;
                if (Array.isArray(transcript.summary.keywords)) {
                  summaryContent += `${transcript.summary.keywords.join(', ')}\n\n`;
                } else if (typeof transcript.summary.keywords === 'string') {
                  summaryContent += `${transcript.summary.keywords}\n\n`;
                }
              }
              
              // Outline
              if (transcript.summary.outline) {
                summaryContent += `OUTLINE:\n`;
                if (Array.isArray(transcript.summary.outline)) {
                  transcript.summary.outline.forEach((item, i) => {
                    summaryContent += `${i + 1}. ${item}\n`;
                  });
                } else if (typeof transcript.summary.outline === 'string') {
                  summaryContent += `${transcript.summary.outline}\n`;
                }
                summaryContent += `\n`;
              }
              
              // Gist (one-line summary)
              if (transcript.summary.gist) {
                summaryContent += `SUMMARY:\n${transcript.summary.gist}\n\n`;
              }
              
              // Bullet Gist
              if (transcript.summary.bullet_gist) {
                summaryContent += `KEY POINTS:\n${transcript.summary.bullet_gist}\n\n`;
              }
              
              // Short Summary
              if (transcript.summary.shorthand_bullet) {
                summaryContent += `SHORT SUMMARY:\n${transcript.summary.shorthand_bullet}\n\n`;
              }
              
              // Detailed Notes
              if (transcript.summary.detailed_notes) {
                summaryContent += `DETAILED NOTES:\n${transcript.summary.detailed_notes}\n\n`;
              }
            } else {
              summaryContent += `No summary available for this meeting.\n`;
            }
            
            const summaryBlob = new Blob([summaryContent], { type: 'text/plain' });
            filePath = `${monthFolder}/${meetingFolder}/summary.txt`;
            fileSize = summaryBlob.size;
            console.log('Writing summary file:', filePath, 'size:', fileSize);
            await fileSystem.writeFile(
              [monthFolder, meetingFolder],
              'summary.txt',
              summaryBlob
            );
            console.log('Summary file written successfully');
            break;
        }

        // Save file record to database
        if (filePath) {
          console.log('Saving file record to database:', filePath);
          await db.files.add({
            meeting_id: meeting.id,
            file_type: job.fileType,
            file_path: filePath,
            file_size: fileSize,
            status: 'downloaded',
            downloaded_at: Date.now(),
          });
          console.log('File record saved to database');
        }

        onProgress(100);
      } catch (error) {
        console.error('Download failed for job:', job, 'error:', error);
        throw error;
      }
    };

    downloadQueue.setProcessor(processDownload);

    downloadQueue.on('job-progress', handleProgress);
    downloadQueue.on('job-completed', handleJobCompleted);
    downloadQueue.on('job-failed', handleProgress);
    downloadQueue.on('all-cancelled', handleComplete);

    return () => {
      downloadQueue.off('job-progress', handleProgress);
      downloadQueue.off('job-completed', handleJobCompleted);
      downloadQueue.off('job-failed', handleProgress);
      downloadQueue.off('all-cancelled', handleComplete);
      // Note: Don't remove processor on cleanup as it may be needed for queued jobs
    };
  }, []); // ✅ Empty deps - only run once on mount

  const loadMeetings = async () => {
    try {
      const allMeetings = await db.meetings.toArray();
      setMeetings(allMeetings);
      
      // Load file status for all meetings
      await loadMeetingFiles(allMeetings.map(m => m.id));
    } catch (error) {
      console.error('Failed to load meetings:', error);
    }
  };

  const loadMeetingFiles = async (meetingIds: string[]) => {
    try {
      const filesMap = new Map<string, any[]>();
      
      for (const meetingId of meetingIds) {
        const files = await db.getFilesByMeeting(meetingId);
        if (files.length > 0) {
          filesMap.set(meetingId, files);
        }
      }
      
      setMeetingFiles(filesMap);
    } catch (error) {
      console.error('Failed to load meeting files:', error);
    }
  };

  // Filter and sort meetings
  const filteredAndSortedMeetings = useMemo(() => {
    let filtered = [...meetings];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.organizer_email?.toLowerCase().includes(query) ||
          m.participants.some((p) => p.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((m) =>
        filterStatus === 'synced' ? m.sync_status === 'synced' : m.sync_status === 'not_synced'
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = a.date - b.date;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'organizer_email':
          comparison = (a.organizer_email || '').localeCompare(b.organizer_email || '');
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [meetings, searchQuery, sortBy, sortOrder, filterStatus]);

  // Paginate meetings
  const paginatedMeetings = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedMeetings.slice(startIndex, endIndex);
  }, [filteredAndSortedMeetings, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedMeetings.length / pageSize);

  // Selection handlers
  const toggleMeetingSelection = (meetingId: string) => {
    const newSelection = new Set(selectedMeetings);
    if (newSelection.has(meetingId)) {
      newSelection.delete(meetingId);
    } else {
      newSelection.add(meetingId);
    }
    setSelectedMeetings(newSelection);
  };

  const selectAll = () => {
    const allIds = new Set(paginatedMeetings.map((m) => m.id));
    setSelectedMeetings(allIds);
  };

  const selectNone = () => {
    setSelectedMeetings(new Set());
  };

  const selectAllPages = () => {
    const allIds = new Set(filteredAndSortedMeetings.map((m) => m.id));
    setSelectedMeetings(allIds);
  };

  const selectMeetingsWithNoFiles = () => {
    // Select all meetings that have no downloaded files
    const meetingsWithNoFiles = filteredAndSortedMeetings.filter((m) => {
      const files = meetingFiles.get(m.id) || [];
      return files.length === 0;
    });
    const noFilesIds = new Set(meetingsWithNoFiles.map((m) => m.id));
    setSelectedMeetings(noFilesIds);
  };

  // Column sorting handler
  const handleColumnSort = (column: 'date' | 'title' | 'duration' | 'organizer_email') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Sortable column header component
  const SortableHeader = ({ 
    column, 
    children 
  }: { 
    column: 'date' | 'title' | 'duration' | 'organizer_email'; 
    children: React.ReactNode;
  }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => handleColumnSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <span className="text-gray-700">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  // Discovery handler (full discovery)
  const handleDiscoverMeetings = async () => {
    setIsDiscovering(true);
    setLocalError(null);

    try {
      const discovered = await meetingDiscovery.discoverMeetings({
        years: 3,
        onProgress: (progress) => {
          setDiscoveryProgress(progress.message);
        },
      });

      await loadMeetings(); // Reload from DB
      setLocalError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to discover meetings';
      setLocalError(errorMessage);
      console.error('Discovery error:', error);
    } finally {
      setIsDiscovering(false);
      setDiscoveryProgress('');
    }
  };

  // Import from local directory
  const handleImportFromLocal = async () => {
    const rootHandle = fileSystem.getRootHandle();
    if (!rootHandle) {
      setLocalError('Please select your download directory first');
      return;
    }

    setIsImporting(true);
    setLocalError(null);

    try {
      const result = await importFromLocalDirectory(
        rootHandle,
        (message, current, total) => {
          setImportProgress(message);
        }
      );

      await loadMeetings(); // Reload from DB
      setLocalError(null);
      alert(`Import complete!\n\nImported: ${result.imported}\nSkipped: ${result.skipped}\nErrors: ${result.errors}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import from local directory';
      setLocalError(errorMessage);
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  // Incremental sync handler (check for new meetings only)
  const handleSyncNewMeetings = async () => {
    setIsDiscovering(true);
    setLocalError(null);

    try {
      setDiscoveryProgress('Checking for new meetings...');
      const result = await meetingDiscovery.checkForNewMeetings();
      
      await loadMeetings(); // Reload from DB
      
      if (result.newCount > 0 || result.updatedCount > 0) {
        setDiscoveryProgress(`Found ${result.newCount} new meeting(s) and ${result.updatedCount} updated meeting(s)`);
        setTimeout(() => setDiscoveryProgress(''), 3000);
      } else {
        setDiscoveryProgress('No new meetings found');
        setTimeout(() => setDiscoveryProgress(''), 3000);
      }
      
      setLocalError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync meetings';
      setLocalError(errorMessage);
      console.error('Sync error:', error);
    } finally {
      setTimeout(() => setIsDiscovering(false), 3000);
    }
  };

  // Scan directory for existing files
  const handleScanDirectory = async () => {
    const rootHandle = fileSystem.getRootHandle();
    if (!rootHandle) {
      alert('No download folder selected. Please select one first.');
      return;
    }

    setIsScanning(true);
    setScanProgress('Starting scan...');
    
    try {
      const result = await scanDirectory(rootHandle, (message) => {
        setScanProgress(message);
      });
      
      // Reload meetings to show updated statuses
      await loadMeetings();
      
      alert(
        `Directory scan complete!\n\n` +
        `Meetings scanned: ${result.meetingsScanned}\n` +
        `Files found: ${result.filesFound}\n` +
        `Statuses updated: ${result.meetingsUpdated}`
      );
    } catch (error) {
      console.error('Directory scan failed:', error);
      setLocalError(`Directory scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  // Select/Re-select download directory
  const handleSelectDirectory = async () => {
    try {
      const { handle, path } = await fileSystem.selectDirectory({
        startIn: 'documents',
      });
      
      setDirectory(handle, path);
      await db.setConfig('directory_path_display', path);
      await db.setConfig('directory_handle', handle);
      
      // Automatically scan the directory after selection
      setIsScanning(true);
      setScanProgress('Scanning directory for existing files...');
      
      try {
        const result = await scanDirectory(handle, (message) => {
          setScanProgress(message);
        });
        
        await loadMeetings();
        
        alert(
          `Download folder selected: ${path}\n\n` +
          `Scan Results:\n` +
          `Meetings scanned: ${result.meetingsScanned}\n` +
          `Files found: ${result.filesFound}\n` +
          `Statuses updated: ${result.meetingsUpdated}`
        );
      } catch (error) {
        console.warn('Directory scan failed:', error);
        alert(`Download folder selected: ${path}\n\n(Note: Directory scan failed, but folder is saved)`);
      } finally {
        setIsScanning(false);
        setScanProgress('');
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('cancel')) {
        setLocalError(`Failed to select directory: ${error.message}`);
      }
    }
  };

  // Check if directory is selected before downloading
  const ensureDirectorySelected = async (): Promise<boolean> => {
    const rootHandle = fileSystem.getRootHandle();
    if (!rootHandle) {
      const confirm = window.confirm('No download folder selected. Would you like to select one now?');
      if (confirm) {
        await handleSelectDirectory();
        return fileSystem.getRootHandle() !== null;
      }
      return false;
    }
    return true;
  };

  // Download handlers
  const handleDownloadSelected = async () => {
    if (selectedMeetings.size === 0) {
      alert('Please select at least one meeting');
      return;
    }

    // Ensure directory is selected
    if (!(await ensureDirectorySelected())) {
      return;
    }

    const meetingsToDownload = meetings.filter((m) => selectedMeetings.has(m.id));
    const fileTypes: FileType[] = ['audio', 'transcript_json', 'transcript_docx', 'summary'];

    setIsDownloading(true);
    downloadQueue.addJobs(meetingsToDownload, fileTypes);
  };

  const handleSyncAll = async () => {
    const unsyncedMeetings = meetings.filter((m) => m.sync_status !== 'synced');
    
    if (unsyncedMeetings.length === 0) {
      alert('All meetings are already synced!');
      return;
    }

    // Ensure directory is selected
    if (!(await ensureDirectorySelected())) {
      return;
    }

    const fileTypes: FileType[] = ['audio', 'transcript_json', 'transcript_docx', 'summary'];
    setIsDownloading(true);
    downloadQueue.addJobs(unsyncedMeetings, fileTypes);
  };

  const handlePauseResume = () => {
    if (downloadQueue.isPausedState()) {
      downloadQueue.resume();
    } else {
      downloadQueue.pause();
    }
  };

  const handleCancelAll = () => {
    if (confirm('Are you sure you want to cancel all pending downloads?')) {
      downloadQueue.cancelAll();
      setIsDownloading(false);
    }
  };

  const handleResetSetup = async () => {
    if (!confirm('This will clear your API key and settings. Continue?')) return;

    try {
      await db.setConfig('onboarding_completed', false);
      await db.setConfig('api_key_encrypted', null);
      await db.setConfig('api_key_valid', false);
      await db.setConfig('user_email', null);

      apiClient.clearApiKey();
      logout();

      if (onResetSetup) {
        onResetSetup();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to reset setup:', error);
      alert('Failed to reset setup. Please try again.');
    }
  };

  // Delete selected meetings
  const handleDeleteSelected = async () => {
    if (selectedMeetings.size === 0) {
      alert('Please select at least one meeting');
      return;
    }

    if (!confirm(`Delete ${selectedMeetings.size} selected meeting(s)?`)) return;

    try {
      await db.meetings.bulkDelete(Array.from(selectedMeetings));
      await loadMeetings();
      setSelectedMeetings(new Set());
    } catch (error) {
      console.error('Failed to delete meetings:', error);
      alert('Failed to delete meetings');
    }
  };

  // Resync single meeting
  const handleResyncMeeting = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    // Ensure directory is selected
    if (!(await ensureDirectorySelected())) {
      return;
    }

    const fileTypes: FileType[] = ['audio', 'transcript_json', 'transcript_docx', 'summary'];
    
    setIsDownloading(true);
    downloadQueue.addJobs([meeting], fileTypes);
  };

  // Handle rate limit change
  const handleRateLimitChange = (newRate: number) => {
    setRequestsPerMinute(newRate);
    downloadQueue.setRequestsPerMinute(newRate);
  };

  const stats = getSyncStats();
  const allSelected = paginatedMeetings.length > 0 && paginatedMeetings.every((m) => selectedMeetings.has(m.id));
  const someSelected = paginatedMeetings.some((m) => selectedMeetings.has(m.id)) && !allSelected;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">A47L - Fireflies Transcript Sync App</h1>
              <p className="text-sm text-gray-600">{userEmail}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm">
                <div className="text-gray-600">Storage Location</div>
                <div className="font-medium text-gray-900">{directoryPath || 'Not selected'}</div>
              </div>
              <Button 
                variant={directoryPath ? "outline" : "primary"} 
                size="sm" 
                onClick={handleSelectDirectory}
                title="Select or change download folder"
              >
                📁 {directoryPath ? 'Change' : 'Select'} Folder
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetSetup} title="Reset API key and settings">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Button>
            </div>
          </div>
          
          {/* View Tabs */}
          <div className="border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex gap-2 py-3">
                <button
                  onClick={() => setActiveView('meetings')}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    activeView === 'meetings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📋 Meetings & Downloads
                </button>
                <button
                  onClick={() => setActiveView('search')}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    activeView === 'search'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  🔍 Search Transcripts
                </button>
                <button
                  onClick={() => setActiveView('analytics')}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    activeView === 'analytics'
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📊 Analytics
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Show Different Views */}
        {activeView === 'search' ? (
          <TranscriptSearch />
        ) : activeView === 'analytics' ? (
          <Analytics />
        ) : (
          <>
            {/* Database Migration Panel - Hidden but functionality preserved */}
            {/* <div className="mb-8">
              <DatabaseMigration />
            </div> */}

            {/* Transcript Search Ingestion Panel - Hidden but functionality preserved */}
            {/* <div className="mb-8">
              <IngestionPanel />
            </div> */}

            {/* Status Bar */}
            {isDiscovering && (
          <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div>
                <div className="font-medium text-blue-900">Discovering Meetings...</div>
                <div className="text-sm text-blue-700">{discoveryProgress}</div>
              </div>
            </div>
          </Card>
        )}

        {isImporting && (
          <Card className="mb-6 p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              <div>
                <div className="font-medium text-green-900">Importing from Local Directory...</div>
                <div className="text-sm text-green-700">{importProgress}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Scanning Status */}
        {isScanning && (
          <Card className="mb-6 p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              <div>
                <div className="font-medium text-purple-900">Scanning Directory...</div>
                <div className="text-sm text-purple-700">{scanProgress}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Error Display */}
        {localError && (
          <Card className="mb-6 p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <div className="font-medium text-red-900">Error</div>
                <div className="text-sm text-red-800 mt-1">{localError}</div>
              </div>
              <button onClick={() => setLocalError(null)} className="text-red-600 hover:text-red-800">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </Card>
        )}

        {/* Download Progress */}
        {isDownloading && (
          <Card className="mb-6 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Download Progress</h3>
                  <p className="text-sm text-gray-600">
                    {queueStats.completed} of {queueStats.total} completed • {queueStats.failed} failed • {queueStats.downloading} downloading
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePauseResume}>
                    {downloadQueue.isPausedState() ? '▶ Resume' : '⏸ Pause'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCancelAll}>
                    ✕ Cancel
                  </Button>
                </div>
              </div>
              <ProgressBar value={downloadProgress} size="lg" showPercentage />
              
              {/* Active Downloads Detail */}
              {activeJobs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-gray-700">Currently Downloading:</div>
                  {activeJobs.map((job) => (
                    <div key={job.id} className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-sm text-gray-900">{job.meetingTitle}</div>
                        <div className="text-xs text-gray-500">{job.progress.toFixed(0)}%</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {job.fileName || job.fileType}
                        </span>
                        {job.currentOperation && (
                          <span className="text-gray-500">{job.currentOperation}</span>
                        )}
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={job.progress} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="mb-8 flex gap-3 flex-wrap">
          {meetings.length === 0 ? (
            <>
              <Button onClick={handleImportFromLocal} disabled={isImporting} size="lg" variant="primary">
                {isImporting ? 'Importing...' : '📂 Import from Local Directory'}
              </Button>
              <Button onClick={handleDiscoverMeetings} disabled={isDiscovering} size="lg" variant="outline">
                {isDiscovering ? 'Discovering...' : '☁️ Discover from API'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleImportFromLocal} disabled={isImporting} size="lg">
                {isImporting ? 'Importing...' : '📂 Import Local'}
              </Button>
              <Button onClick={handleSyncNewMeetings} disabled={isDiscovering} size="lg">
                {isDiscovering ? 'Syncing...' : '🔄 Check for New'}
              </Button>
              <Button onClick={handleDiscoverMeetings} disabled={isDiscovering} variant="outline" size="lg">
                {isDiscovering ? 'Discovering...' : 'Re-discover All'}
              </Button>
            </>
          )}
          <Button onClick={handleSyncAll} variant="secondary" disabled={stats.unsyncedCount === 0} size="lg">
            Download All ({stats.unsyncedCount})
          </Button>
          <Button
            onClick={handleDownloadSelected}
            variant="secondary"
            disabled={selectedMeetings.size === 0}
            size="lg"
          >
            Download Selected ({selectedMeetings.size})
          </Button>
          <Button
            onClick={() => setShowRateSettings(!showRateSettings)}
            variant="outline"
            size="lg"
            title="Adjust download speed to prevent throttling"
          >
            ⚙️ Rate Limit
          </Button>
          <Button
            onClick={handleScanDirectory}
            variant="outline"
            size="lg"
            disabled={!directoryPath || isScanning}
            title="Scan directory for existing files and update meeting statuses"
          >
            {isScanning ? '🔍 Scanning...' : '🔍 Scan Directory'}
          </Button>
        </div>

        {/* Rate Limit Settings */}
        {showRateSettings && (
          <Card className="p-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Download Rate Limit</h3>
                <span className="text-sm text-gray-600">
                  Adjust to prevent API throttling
                </span>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Requests per Minute: <span className="font-bold text-blue-600">{requestsPerMinute}</span>
                  <span className="text-gray-500 ml-2">
                    ({Math.round(downloadQueue.getRateLimitSettings().delayMs / 1000)}s between downloads)
                  </span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={requestsPerMinute}
                  onChange={(e) => handleRateLimitChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>5/min (slow, 12s delay)</span>
                  <span>30/min (balanced, 2s delay)</span>
                  <span>60/min (fast, 1s delay)</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleRateLimitChange(5)}
                  variant="outline"
                  size="sm"
                >
                  🐢 Very Slow (5/min)
                </Button>
                <Button
                  onClick={() => handleRateLimitChange(10)}
                  variant="outline"
                  size="sm"
                >
                  🐌 Slow (10/min)
                </Button>
                <Button
                  onClick={() => handleRateLimitChange(20)}
                  variant="outline"
                  size="sm"
                >
                  ⚡ Moderate (20/min)
                </Button>
                <Button
                  onClick={() => handleRateLimitChange(30)}
                  variant="outline"
                  size="sm"
                >
                  🚀 Fast (30/min)
                </Button>
              </div>

              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                <strong>💡 Tip:</strong> If you're getting throttled or rate limited errors, reduce this number. 
                Start with 10/min (current default) and adjust as needed.
              </div>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 text-center">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Meetings</div>
            <div className="text-4xl font-bold text-gray-900">{meetings.length}</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm font-medium text-gray-600 mb-2">Completion Rate</div>
            <div className="text-4xl font-bold text-gray-900">{stats.completionRate}%</div>
            <div className="text-sm text-gray-600 mt-1">{stats.syncedCount} of {stats.totalCount} synced</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm font-medium text-gray-600 mb-2">Ready to Download</div>
            <div className="text-4xl font-bold text-blue-600">{stats.unsyncedCount}</div>
            <div className="text-sm text-gray-600 mt-1">Meetings pending</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-sm font-medium text-gray-600 mb-2">Last Sync</div>
            <div className="text-2xl font-bold text-gray-900">{stats.lastSyncTime ? formatRelativeTime(stats.lastSyncTime) : 'Never'}</div>
            <div className="text-sm text-gray-600 mt-1">Most recent update</div>
          </Card>
        </div>

        {/* Meetings List */}
        <Card className="overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between gap-4 mb-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="synced">Synced</option>
                  <option value="not_synced">Not Synced</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">Sort by Date</option>
                  <option value="title">Sort by Title</option>
                  <option value="duration">Sort by Duration</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => (e.target.checked ? selectAll() : selectNone())}
                  label={`${selectedMeetings.size} selected`}
                />
                <Button variant="outline" size="sm" onClick={selectAllPages}>
                  Select All ({filteredAndSortedMeetings.length})
                </Button>
                <Button variant="outline" size="sm" onClick={selectMeetingsWithNoFiles}>
                  Select No Files ({filteredAndSortedMeetings.filter(m => (meetingFiles.get(m.id) || []).length === 0).length})
                </Button>
                {selectedMeetings.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={selectNone}>
                      Clear Selection
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleDeleteSelected}>
                      Delete Selected
                    </Button>
                  </>
                )}
              </div>

              <div className="text-sm text-gray-600">
                Showing {paginatedMeetings.length} of {filteredAndSortedMeetings.length} meetings
              </div>
            </div>
          </div>

          {/* Meetings Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <SortableHeader column="title">Meeting</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloaded</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Local Files</th>
                  <SortableHeader column="date">Date</SortableHeader>
                  <SortableHeader column="duration">Duration</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedMeetings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {meetings.length === 0 ? 'No meetings found. Click "Discover Meetings" to get started.' : 'No meetings match your filters.'}
                    </td>
                  </tr>
                ) : (
                  paginatedMeetings.map((meeting) => {
                    const files = meetingFiles.get(meeting.id) || [];
                    const audioFile = files.find(f => f.file_type === 'audio');
                    const jsonFile = files.find(f => f.file_type === 'transcript_json');
                    const docxFile = files.find(f => f.file_type === 'transcript_docx');
                    const summaryFile = files.find(f => f.file_type === 'summary');
                    
                    const hasAudio = audioFile?.status === 'downloaded';
                    const hasJSON = jsonFile?.status === 'downloaded';
                    const hasDOCX = docxFile?.status === 'downloaded';
                    const hasSummary = summaryFile?.status === 'downloaded';
                    
                    return (
                      <tr key={meeting.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedMeetings.has(meeting.id)}
                            onChange={() => toggleMeetingSelection(meeting.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-left">{meeting.title}</div>
                          <div className="text-xs text-gray-500 text-left mt-0.5">
                            {new Date(meeting.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })} • {meeting.duration} min
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 text-left">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${hasAudio ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`} title="Audio">
                              🎵
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${hasJSON ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`} title="JSON">
                              📄
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${hasDOCX ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`} title="Transcript">
                              📝
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${hasSummary ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`} title="Summary">
                              📋
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-xs text-left">
                            {audioFile && (
                              <div className="truncate max-w-[200px]" title={audioFile.file_path}>
                                🎵 {audioFile.file_path}
                              </div>
                            )}
                            {jsonFile && (
                              <div className="truncate max-w-[200px]" title={jsonFile.file_path}>
                                📄 {jsonFile.file_path}
                              </div>
                            )}
                            {docxFile && (
                              <div className="truncate max-w-[200px]" title={docxFile.file_path}>
                                📝 {docxFile.file_path}
                              </div>
                            )}
                            {summaryFile && (
                              <div className="truncate max-w-[200px]" title={summaryFile.file_path}>
                                📋 {summaryFile.file_path}
                              </div>
                            )}
                            {files.length === 0 && <span className="text-gray-400">No files downloaded</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-left whitespace-nowrap">
                          {new Date(meeting.date).toLocaleDateString('en-US', { 
                            month: '2-digit', 
                            day: '2-digit',
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-left">{meeting.duration} min</td>
                        <td className="px-4 py-3 text-left">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              meeting.sync_status === 'synced'
                                ? 'bg-green-100 text-green-800'
                                : meeting.sync_status === 'syncing'
                                ? 'bg-blue-100 text-blue-800'
                                : meeting.sync_status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {meeting.sync_status === 'not_synced' ? 'pending' : meeting.sync_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResyncMeeting(meeting.id)}
                                title="Re-download files"
                              >
                                🔄
                              </Button>
                              {files.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => alert(`Local files for: ${meeting.title}\n\nDirectory: ${directoryPath}\n\nFiles:\n${files.map(f => `• ${f.file_type}: ${f.file_path} (${(f.file_size! / 1024).toFixed(1)} KB)`).join('\n')}\n\nNote: You can access these files in your selected download folder.`)}
                                  title="Show file paths"
                                >
                                  📁
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {meeting.audio_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(meeting.audio_url, '_blank')}
                                  title="Download audio file (opens in new tab)"
                                >
                                  🎵
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(meeting.transcript_url, '_blank')}
                                title="View transcript in Fireflies"
                              >
                                📄
                              </Button>
                              {meeting.transcript_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(meeting.transcript_url.replace('/view/', '/summary/'), '_blank')}
                                  title="View summary in Fireflies"
                                >
                                  📝
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredAndSortedMeetings.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredAndSortedMeetings.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </Card>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pb-6 text-center text-xs text-gray-500">
        A47L - Fireflies Transcript Sync App v1.0.0 • made with heart by{' '}
        <a 
          href="https://atomic47.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline"
        >
          Atomic 47 Labs Inc
        </a>
      </div>
    </div>
  );
}

