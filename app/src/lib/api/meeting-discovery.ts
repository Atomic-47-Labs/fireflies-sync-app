// Meeting Discovery Engine
import { apiClient } from './client';
import { db } from '../db';
import type { Meeting, FirefliesTranscript } from '../../types';
import { getDateRange } from '../utils';

export interface DiscoveryProgress {
  phase: 'fetching' | 'storing' | 'complete';
  current: number;
  total?: number;
  message: string;
}

export class MeetingDiscoveryEngine {
  private abortController: AbortController | null = null;

  /**
   * Convert Fireflies transcript to Meeting entity
   */
  private convertToMeeting(transcript: FirefliesTranscript): Meeting {
    return {
      id: transcript.id,
      title: transcript.title,
      date: new Date(transcript.date).getTime(),
      duration: transcript.duration,
      organizer_email: transcript.organizer_email,
      participants: transcript.participants || [],
      transcript_url: transcript.transcript_url,
      audio_url: transcript.audio_url,
      fireflies_users: transcript.fireflies_users || [],
      created_at: Date.now(),
      updated_at: Date.now(),
      sync_status: 'not_synced',
    };
  }

  /**
   * Discover all meetings in date range
   */
  async discoverMeetings(options: {
    years?: number;
    fromDate?: Date;
    toDate?: Date;
    onProgress?: (progress: DiscoveryProgress) => void;
  } = {}): Promise<Meeting[]> {
    // Create abort controller for cancellation
    this.abortController = new AbortController();

    try {
      // Report progress
      if (options.onProgress) {
        options.onProgress({
          phase: 'fetching',
          current: 0,
          message: 'Fetching meetings from Fireflies...',
        });
      }

      // Fetch all transcripts without date filtering
      // Fireflies API has issues with date parameters, so we fetch all and filter locally
      const transcripts = await apiClient.getAllTranscripts({
        onProgress: (p) => {
          if (options.onProgress) {
            options.onProgress({
              phase: 'fetching',
              current: p.current,
              total: p.total,
              message: `Fetched ${p.current} meetings...`,
            });
          }
        },
      });

      // Check if aborted
      if (this.abortController.signal.aborted) {
        throw new Error('Discovery cancelled');
      }

      // Convert to Meeting entities
      let meetings = transcripts.map(t => this.convertToMeeting(t));

      // Filter by date range if provided
      if (options.fromDate && options.toDate) {
        const fromTimestamp = options.fromDate.getTime();
        const toTimestamp = options.toDate.getTime();
        meetings = meetings.filter(m => m.date >= fromTimestamp && m.date <= toTimestamp);
        console.log(`Filtered to ${meetings.length} meetings in date range`);
      } else if (options.years) {
        const { fromDate, toDate } = getDateRange(options.years);
        meetings = meetings.filter(m => m.date >= fromDate && m.date <= toDate);
        console.log(`Filtered to ${meetings.length} meetings in last ${options.years} years`);
      }

      // Report progress
      if (options.onProgress) {
        options.onProgress({
          phase: 'storing',
          current: 0,
          total: meetings.length,
          message: 'Storing meetings in database...',
        });
      }

      // Store in database (bulk insert)
      await this.storeMeetings(meetings, (progress) => {
        if (options.onProgress) {
          options.onProgress({
            phase: 'storing',
            current: progress.current,
            total: progress.total,
            message: `Stored ${progress.current} of ${progress.total} meetings`,
          });
        }
      });

      // Report complete
      if (options.onProgress) {
        options.onProgress({
          phase: 'complete',
          current: meetings.length,
          total: meetings.length,
          message: `Discovery complete: ${meetings.length} meetings found`,
        });
      }

      // Log event - calculate date strings for logging
      let fromDateStr: string | undefined;
      let toDateStr: string | undefined;
      
      if (options.fromDate && options.toDate) {
        fromDateStr = options.fromDate.toISOString();
        toDateStr = options.toDate.toISOString();
      } else if (options.years) {
        const { fromDate, toDate } = getDateRange(options.years);
        fromDateStr = new Date(fromDate).toISOString();
        toDateStr = new Date(toDate).toISOString();
      }

      await db.logEvent('sync_started', undefined, {
        total_meetings: meetings.length,
        from_date: fromDateStr,
        to_date: toDateStr,
      });

      return meetings;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Store meetings in database
   */
  private async storeMeetings(
    meetings: Meeting[],
    onProgress?: (progress: { current: number; total: number }) => void
  ): Promise<void> {
    const batchSize = 100;
    let stored = 0;

    for (let i = 0; i < meetings.length; i += batchSize) {
      const batch = meetings.slice(i, i + batchSize);

      // Use transaction for atomic operation
      await db.transaction('rw', db.meetings, async () => {
        for (const meeting of batch) {
          // Check if meeting already exists
          const existing = await db.meetings.get(meeting.id);
          
          if (existing) {
            // Update only if not synced or failed
            if (existing.sync_status === 'not_synced' || existing.sync_status === 'failed') {
              await db.meetings.update(meeting.id, {
                ...meeting,
                updated_at: Date.now(),
              });
            }
          } else {
            // Add new meeting
            await db.meetings.add(meeting);
          }
        }
      });

      stored += batch.length;
      
      if (onProgress) {
        onProgress({ current: stored, total: meetings.length });
      }
    }
  }

  /**
   * Check for new meetings since last sync
   */
  async checkForNewMeetings(): Promise<{
    newCount: number;
    updatedCount: number;
    meetings: Meeting[];
  }> {
    // Get last sync timestamp from config
    const lastSync = await db.getConfig<number>('last_sync_timestamp');
    
    console.log('Checking for new meetings since last sync:', { lastSync });

    // Fetch all transcripts (Fireflies API doesn't support filtering)
    // We'll filter locally by comparing with lastSync timestamp
    const transcripts = await apiClient.getTranscripts();

    const meetings = transcripts.map(t => this.convertToMeeting(t));

    // Filter meetings by lastSync timestamp if available
    const filteredMeetings = lastSync 
      ? meetings.filter(m => m.date >= lastSync)
      : meetings;

    console.log(`Found ${meetings.length} total meetings, ${filteredMeetings.length} new/updated`);

    // Check which are new vs updated
    let newCount = 0;
    let updatedCount = 0;

    for (const meeting of filteredMeetings) {
      const existing = await db.meetings.get(meeting.id);
      if (existing) {
        updatedCount++;
      } else {
        newCount++;
      }
    }

    // Store filtered meetings
    await this.storeMeetings(filteredMeetings);

    // Update last sync timestamp
    await db.setConfig('last_sync_timestamp', Date.now());

    return {
      newCount,
      updatedCount,
      meetings: filteredMeetings,
    };
  }

  /**
   * Refresh a single meeting's data
   */
  async refreshMeeting(meetingId: string): Promise<Meeting> {
    const transcript = await apiClient.getTranscript(meetingId);
    const meeting = this.convertToMeeting(transcript);

    // Update in database
    await db.meetings.put(meeting);

    return meeting;
  }

  /**
   * Cancel ongoing discovery
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

// Export singleton instance
export const meetingDiscovery = new MeetingDiscoveryEngine();

