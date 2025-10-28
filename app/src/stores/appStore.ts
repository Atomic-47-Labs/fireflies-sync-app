// Main application state store using Zustand
import { create } from 'zustand';
import { fileSystem } from '../lib/storage';
import type { 
  Meeting, 
  SyncStatus, 
  DownloadProgress,
  FileTypePreferences 
} from '../types';

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  apiKey: string | null;
  userEmail: string | null;
  
  // Directory
  directoryHandle: FileSystemDirectoryHandle | null;
  hasDirectoryPermission: boolean;
  directoryPath: string | null;
  
  // Meetings
  meetings: Meeting[];
  filteredMeetings: Meeting[];
  selectedMeetingIds: Set<string>;
  
  // Download Queue
  downloadQueue: string[]; // Meeting IDs
  activeDownloads: Map<string, DownloadProgress>;
  
  // UI State
  searchQuery: string;
  dateFilter: { from: Date | null; to: Date | null };
  statusFilter: SyncStatus | 'all';
  isLoading: boolean;
  error: string | null;
  
  // Settings
  fileTypePreferences: FileTypePreferences;
  concurrentDownloads: number;
  
  // Actions - Auth
  setAuthenticated: (apiKey: string, email: string) => void;
  logout: () => void;
  
  // Actions - Directory
  setDirectory: (handle: FileSystemDirectoryHandle, path: string) => void;
  setDirectoryPermission: (hasPermission: boolean) => void;
  
  // Actions - Meetings
  setMeetings: (meetings: Meeting[]) => void;
  addMeetings: (meetings: Meeting[]) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  toggleMeetingSelection: (id: string) => void;
  selectAllMeetings: () => void;
  clearSelection: () => void;
  
  // Actions - Downloads
  addToQueue: (meetingIds: string[]) => void;
  removeFromQueue: (meetingId: string) => void;
  clearQueue: () => void;
  updateDownloadProgress: (meetingId: string, progress: DownloadProgress) => void;
  removeDownloadProgress: (meetingId: string) => void;
  
  // Actions - UI
  setSearchQuery: (query: string) => void;
  setDateFilter: (from: Date | null, to: Date | null) => void;
  setStatusFilter: (status: SyncStatus | 'all') => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Actions - Settings
  setFileTypePreferences: (preferences: FileTypePreferences) => void;
  setConcurrentDownloads: (count: number) => void;
  
  // Computed/Helper Actions
  getFilteredMeetings: () => Meeting[];
  getSyncStats: () => {
    total: number;
    synced: number;
    failed: number;
    syncing: number;
    not_synced: number;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  isAuthenticated: false,
  apiKey: null,
  userEmail: null,
  
  directoryHandle: null,
  hasDirectoryPermission: false,
  directoryPath: null,
  
  meetings: [],
  filteredMeetings: [],
  selectedMeetingIds: new Set<string>(),
  
  downloadQueue: [],
  activeDownloads: new Map<string, DownloadProgress>(),
  
  searchQuery: '',
  dateFilter: { from: null, to: null },
  statusFilter: 'all',
  isLoading: false,
  error: null,
  
  fileTypePreferences: {
    audio: true,
    transcript_docx: true,
    transcript_json: true,
    summary: true,
  },
  concurrentDownloads: 3,
  
  // Auth Actions
  setAuthenticated: (apiKey, email) => set({ 
    isAuthenticated: true, 
    apiKey, 
    userEmail: email,
    error: null 
  }),
  
  logout: () => set({ 
    isAuthenticated: false, 
    apiKey: null, 
    userEmail: null 
  }),
  
  // Directory Actions
  setDirectory: (handle, path) => {
    // Set in fileSystem manager so it can be used
    fileSystem.setRootHandle(handle);
    // Set in store
    set({ 
      directoryHandle: handle, 
      directoryPath: path,
      hasDirectoryPermission: true 
    });
  },
  
  setDirectoryPermission: (hasPermission) => set({ 
    hasDirectoryPermission: hasPermission 
  }),
  
  // Meeting Actions
  setMeetings: (meetings) => {
    set({ meetings });
    get().getFilteredMeetings();
  },
  
  addMeetings: (newMeetings) => {
    const existing = get().meetings;
    const existingIds = new Set(existing.map(m => m.id));
    const toAdd = newMeetings.filter(m => !existingIds.has(m.id));
    set({ meetings: [...existing, ...toAdd] });
    get().getFilteredMeetings();
  },
  
  updateMeeting: (id, updates) => {
    const meetings = get().meetings.map(m => 
      m.id === id ? { ...m, ...updates } : m
    );
    set({ meetings });
    get().getFilteredMeetings();
  },
  
  toggleMeetingSelection: (id) => {
    const selected = new Set(get().selectedMeetingIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    set({ selectedMeetingIds: selected });
  },
  
  selectAllMeetings: () => {
    const allIds = new Set(get().filteredMeetings.map(m => m.id));
    set({ selectedMeetingIds: allIds });
  },
  
  clearSelection: () => {
    set({ selectedMeetingIds: new Set() });
  },
  
  // Download Actions
  addToQueue: (meetingIds) => {
    const queue = [...get().downloadQueue];
    meetingIds.forEach(id => {
      if (!queue.includes(id)) {
        queue.push(id);
      }
    });
    set({ downloadQueue: queue });
  },
  
  removeFromQueue: (meetingId) => {
    set({ 
      downloadQueue: get().downloadQueue.filter(id => id !== meetingId) 
    });
  },
  
  clearQueue: () => {
    set({ downloadQueue: [], activeDownloads: new Map() });
  },
  
  updateDownloadProgress: (meetingId, progress) => {
    const downloads = new Map(get().activeDownloads);
    downloads.set(meetingId, progress);
    set({ activeDownloads: downloads });
  },
  
  removeDownloadProgress: (meetingId) => {
    const downloads = new Map(get().activeDownloads);
    downloads.delete(meetingId);
    set({ activeDownloads: downloads });
  },
  
  // UI Actions
  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().getFilteredMeetings();
  },
  
  setDateFilter: (from, to) => {
    set({ dateFilter: { from, to } });
    get().getFilteredMeetings();
  },
  
  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().getFilteredMeetings();
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // Settings Actions
  setFileTypePreferences: (preferences) => set({ 
    fileTypePreferences: preferences 
  }),
  
  setConcurrentDownloads: (count) => set({ 
    concurrentDownloads: Math.max(1, Math.min(10, count)) 
  }),
  
  // Helper Actions
  getFilteredMeetings: () => {
    const { 
      meetings, 
      searchQuery, 
      dateFilter, 
      statusFilter 
    } = get();
    
    let filtered = [...meetings];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(query)
      );
    }
    
    // Apply date filter
    if (dateFilter.from) {
      filtered = filtered.filter(m => m.date >= dateFilter.from!.getTime());
    }
    if (dateFilter.to) {
      filtered = filtered.filter(m => m.date <= dateFilter.to!.getTime());
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.sync_status === statusFilter);
    }
    
    set({ filteredMeetings: filtered });
    return filtered;
  },
  
  getSyncStats: () => {
    const meetings = get().meetings;
    const total = meetings.length;
    const synced = meetings.filter(m => m.sync_status === 'synced').length;
    const failed = meetings.filter(m => m.sync_status === 'failed').length;
    const syncing = meetings.filter(m => m.sync_status === 'syncing').length;
    const not_synced = total - synced - failed - syncing;
    
    return { total, synced, failed, syncing, not_synced };
  },
}));

