// General Utility Functions
import { INVALID_FILENAME_CHARS, MAX_PATH_LENGTH } from '../../constants';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize filename by removing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(INVALID_FILENAME_CHARS, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

/**
 * Truncate string if it exceeds max length
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Ensure path doesn't exceed Windows MAX_PATH limit
 */
export function ensurePathLength(path: string, maxLength: number = MAX_PATH_LENGTH): string {
  if (path.length <= maxLength) return path;
  
  // Try to shorten by truncating the last component
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  const pathWithoutLast = parts.slice(0, -1).join('/');
  const availableLength = maxLength - pathWithoutLast.length - 1; // -1 for the /
  
  if (availableLength > 20) {
    const truncated = truncateString(lastPart, availableLength);
    return `${pathWithoutLast}/${truncated}`;
  }
  
  // If still too long, just truncate from the end
  return path.slice(0, maxLength);
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format duration for display (minutes only if less than hour)
 */
export function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}min`;
  }
}

/**
 * Format timestamp to date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp to datetime string
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Calculate download speed
 */
export function calculateSpeed(bytes: number, milliseconds: number): number {
  if (milliseconds === 0) return 0;
  return (bytes / milliseconds) * 1000; // bytes per second
}

/**
 * Format speed to human-readable format
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Estimate time remaining
 */
export function estimateTimeRemaining(
  bytesRemaining: number,
  bytesPerSecond: number
): number {
  if (bytesPerSecond === 0) return Infinity;
  return Math.ceil(bytesRemaining / bytesPerSecond);
}

/**
 * Format ETA
 */
export function formatETA(seconds: number): string {
  if (!isFinite(seconds)) return 'calculating...';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  multiplier: number = 2
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate meeting folder path
 * Format: {year}/{month}/{date}_{title}/
 */
export function generateMeetingFolderPath(date: number, title: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  const sanitizedTitle = sanitizeFilename(title);
  const folderName = `${year}-${month}-${day}_${sanitizedTitle}`;
  
  return `${year}/${month}/${folderName}`;
}

/**
 * Parse date range for queries
 */
export function getDateRange(years: number): { fromDate: number; toDate: number } {
  const toDate = Date.now();
  const fromDate = toDate - (years * 365 * 24 * 60 * 60 * 1000);
  
  return { fromDate, toDate };
}

/**
 * Check if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Create a unique ID
 */
export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Download text as file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export filename utilities
export { sanitizeMeetingTitle, generateMeetingFolders } from './filename';

