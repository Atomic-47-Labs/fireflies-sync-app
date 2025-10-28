/**
 * Sanitize a meeting title for use as a folder/file name
 * 
 * Rules:
 * - Replace invalid filesystem characters with underscores
 * - Replace spaces with hyphens
 * - Remove trailing periods, spaces, hyphens, underscores
 * - Remove leading periods, spaces, hyphens, underscores
 * - Fallback to 'meeting' if nothing remains
 * 
 * @param title The meeting title to sanitize
 * @returns A safe folder/file name
 */
export function sanitizeMeetingTitle(title: string): string {
  let sanitized = title
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
    .replace(/\s+/g, '-')            // Replace spaces with hyphens
    .replace(/\.+$/g, '')            // Remove trailing periods
    .replace(/[-_\s]+$/g, '')        // Remove trailing hyphens, underscores, spaces
    .replace(/^[-_\s.]+/g, '');      // Remove leading hyphens, underscores, spaces, periods
  
  // Ensure we have something after sanitization
  if (!sanitized) {
    sanitized = 'meeting';
  }
  
  return sanitized;
}

/**
 * Generate folder structure for a meeting
 * 
 * @param meetingDate The meeting date
 * @param meetingTitle The meeting title
 * @returns Object with monthFolder and meetingFolder
 */
export function generateMeetingFolders(meetingDate: Date, meetingTitle: string): {
  monthFolder: string;
  meetingFolder: string;
} {
  const monthFolder = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
  const sanitizedTitle = sanitizeMeetingTitle(meetingTitle);
  const timestamp = meetingDate.toISOString().split('T')[0];
  const meetingFolder = `${timestamp}_${sanitizedTitle}`;
  
  return { monthFolder, meetingFolder };
}


