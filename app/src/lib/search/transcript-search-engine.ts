// Full-Text Search Engine using FlexSearch
import FlexSearch from 'flexsearch';
import { db } from '../db';
import type { Meeting, SearchResult } from '../../types';

interface SearchDocument {
  meeting_id: string;
  title: string;
  summary_text: string;
  transcript_text: string;
  keywords: string;
  speakers: string;
  organizer: string;
  participants: string;
  [key: string]: string; // Index signature for FlexSearch
}

export interface SearchOptions {
  limit?: number;
  searchMode?: 'quick' | 'full';
  includeHighlights?: boolean;
}

class TranscriptSearchEngine {
  private index: any; // FlexSearch.Document type
  private isInitialized = false;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.index = new (FlexSearch as any).Document({
      document: {
        id: 'meeting_id',
        index: [
          'title',           // Meeting title (high priority)
          'summary_text',    // Summary overview (high priority)
          'keywords',        // Extracted keywords (high priority)
          'transcript_text', // Full transcript (medium priority)
          'speakers',        // Speaker names
          'organizer',       // Organizer email
          'participants'     // Participant emails
        ],
        store: ['meeting_id', 'title'] // Store for fast retrieval
      },
      tokenize: 'forward',  // Best for partial matching
      context: {
        resolution: 9,
        depth: 3,
        bidirectional: true
      },
      cache: 100  // Cache last 100 queries
    });
  }

  /**
   * Initialize search index from IndexedDB
   */
  async initialize(forceRebuild = false): Promise<void> {
    // If already initialized and not forcing rebuild, return
    if (this.isInitialized && !forceRebuild) return;

    // If currently initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initPromise = this._initializeInternal(forceRebuild);

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async _initializeInternal(forceRebuild: boolean): Promise<void> {
    console.log('🔍 Building search index...');
    const startTime = Date.now();

    try {
      // If rebuilding, clear existing index
      if (forceRebuild) {
        // FlexSearch doesn't have a clear method, so we recreate it
        this.isInitialized = false;
      }

      // Load data from IndexedDB
      const [meetings, transcripts, summaries, metadata] = await Promise.all([
        db.meetings.toArray(),
        db.transcriptContent.toArray(),
        db.summaryContent.toArray(),
        db.searchMetadata.toArray()
      ]);

      console.log(`📊 Indexing ${meetings.length} meetings...`);

      // Build index
      let indexed = 0;
      for (const meeting of meetings) {
        const transcript = transcripts.find(t => t.meeting_id === meeting.id);
        const summary = summaries.find(s => s.meeting_id === meeting.id);
        const meta = metadata.find(m => m.meeting_id === meeting.id);

        // Skip if no content to index
        if (!transcript && !summary) continue;

        const document: SearchDocument = {
          meeting_id: meeting.id,
          title: meeting.title,
          summary_text: summary?.text || '',
          transcript_text: transcript?.text || '',
          keywords: meta?.keywords.join(' ') || '',
          speakers: transcript?.speakers.join(' ') || '',
          organizer: meeting.organizer_email || '',
          participants: meeting.participants.join(' ')
        };

        await this.index.addAsync(meeting.id, document);
        indexed++;
      }

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      console.log(`✅ Search index built: ${indexed} meetings indexed in ${duration}ms`);
    } catch (error) {
      console.error('❌ Failed to build search index:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Search across all meeting content
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 50,
      includeHighlights = true
    } = options;

    // Initialize if not already done
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    try {
      // Perform search
      const searchResults = await this.index.searchAsync(normalizedQuery, {
        limit: limit * 2, // Get more results for ranking
        suggest: true     // Enable fuzzy matching
      });

      // FlexSearch returns results grouped by field
      // Collect all unique meeting IDs with their scores
      const meetingScores = new Map<string, { score: number; field: string }>();

      for (const fieldResults of searchResults) {
        if (!fieldResults.result || fieldResults.result.length === 0) continue;

        const field = fieldResults.field as keyof SearchDocument;
        const fieldWeight = this.getFieldWeight(field);

        for (const meetingId of fieldResults.result) {
          const existing = meetingScores.get(meetingId as string);
          const score = fieldWeight;

          if (!existing || existing.score < score) {
            meetingScores.set(meetingId as string, {
              score,
              field: this.getMatchType(field)
            });
          }
        }
      }

      // Fetch meeting data
      const meetingIds = Array.from(meetingScores.keys());
      const meetings = await db.meetings.bulkGet(meetingIds);

      // Build results with highlights
      const results: SearchResult[] = [];
      for (const meeting of meetings) {
        if (!meeting) continue;

        const scoreData = meetingScores.get(meeting.id);
        if (!scoreData) continue;

        let highlights: string[] = [];
        if (includeHighlights) {
          highlights = await this.extractHighlights(meeting.id, normalizedQuery);
        }

        results.push({
          meeting,
          score: scoreData.score,
          highlights,
          matchType: scoreData.field as SearchResult['matchType']
        });
      }

      // Sort by score (descending) and limit results
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Quick search (metadata only - no transcript)
   */
  async quickSearch(query: string, limit = 20): Promise<Meeting[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();

    // Search using Dexie's native capabilities for fast results
    const results = await Promise.all([
      // Title starts with
      db.meetings
        .where('title')
        .startsWithIgnoreCase(normalizedQuery)
        .limit(limit)
        .toArray(),
      
      // Organizer email
      db.meetings
        .where('organizer_email')
        .startsWithIgnoreCase(normalizedQuery)
        .limit(limit)
        .toArray(),
      
      // Keywords (if available)
      db.searchMetadata
        .where('keywords')
        .equals(normalizedQuery)
        .limit(limit)
        .toArray()
        .then(async metadata => {
          const meetingIds = metadata.map(m => m.meeting_id);
          return db.meetings.bulkGet(meetingIds);
        })
    ]);

    // Combine and deduplicate
    const meetingMap = new Map<string, Meeting>();
    for (const resultSet of results) {
      for (const meeting of resultSet) {
        if (meeting && !meetingMap.has(meeting.id)) {
          meetingMap.set(meeting.id, meeting);
          if (meetingMap.size >= limit) break;
        }
      }
      if (meetingMap.size >= limit) break;
    }

    return Array.from(meetingMap.values()).slice(0, limit);
  }

  /**
   * Add new transcript to index
   */
  async addTranscript(meetingId: string): Promise<void> {
    if (!this.isInitialized) {
      // If not initialized yet, skip (will be indexed on first search)
      return;
    }

    try {
      const [meeting, transcript, summary, meta] = await Promise.all([
        db.meetings.get(meetingId),
        db.transcriptContent.get(meetingId),
        db.summaryContent.get(meetingId),
        db.searchMetadata.get(meetingId)
      ]);

      if (!meeting) return;

      const document: SearchDocument = {
        meeting_id: meetingId,
        title: meeting.title,
        summary_text: summary?.text || '',
        transcript_text: transcript?.text || '',
        keywords: meta?.keywords.join(' ') || '',
        speakers: transcript?.speakers.join(' ') || '',
        organizer: meeting.organizer_email || '',
        participants: meeting.participants.join(' ')
      };

      await this.index.addAsync(meetingId, document);
      console.log(`✅ Added meeting ${meetingId} to search index`);
    } catch (error) {
      console.error(`Failed to add meeting ${meetingId} to search index:`, error);
    }
  }

  /**
   * Remove transcript from index
   */
  async removeTranscript(meetingId: string): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.index.removeAsync(meetingId);
      console.log(`✅ Removed meeting ${meetingId} from search index`);
    } catch (error) {
      console.error(`Failed to remove meeting ${meetingId} from search index:`, error);
    }
  }

  /**
   * Update existing transcript in index
   */
  async updateTranscript(meetingId: string): Promise<void> {
    await this.removeTranscript(meetingId);
    await this.addTranscript(meetingId);
  }

  /**
   * Get search statistics
   */
  getStats(): { isInitialized: boolean; isInitializing: boolean } {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing
    };
  }

  /**
   * Clear and rebuild index
   */
  async rebuild(): Promise<void> {
    await this.initialize(true);
  }

  // Private helper methods

  private getFieldWeight(field: keyof SearchDocument): number {
    // Higher score = more relevant field
    const weights: Record<keyof SearchDocument, number> = {
      title: 100,
      keywords: 90,
      summary_text: 80,
      organizer: 60,
      speakers: 50,
      participants: 40,
      transcript_text: 30,
      meeting_id: 0
    };
    return weights[field] || 10;
  }

  private getMatchType(field: keyof SearchDocument): string {
    if (field === 'title') return 'title';
    if (field === 'summary_text' || field === 'keywords') return 'summary';
    if (field === 'transcript_text') return 'transcript';
    return 'keywords';
  }

  private async extractHighlights(meetingId: string, query: string, maxHighlights = 3): Promise<string[]> {
    try {
      const [transcript, summary] = await Promise.all([
        db.transcriptContent.get(meetingId),
        db.summaryContent.get(meetingId)
      ]);

      const highlights: string[] = [];
      const queryLower = query.toLowerCase();

      // Extract from summary first (more relevant)
      if (summary?.text) {
        const summaryHighlights = this.extractSnippets(summary.text, queryLower, 1);
        highlights.push(...summaryHighlights);
      }

      // Extract from transcript if we need more
      if (highlights.length < maxHighlights && transcript?.text) {
        const transcriptHighlights = this.extractSnippets(
          transcript.text, 
          queryLower, 
          maxHighlights - highlights.length
        );
        highlights.push(...transcriptHighlights);
      }

      return highlights;
    } catch (error) {
      console.error('Error extracting highlights:', error);
      return [];
    }
  }

  private extractSnippets(text: string, query: string, maxSnippets: number): string[] {
    const snippets: string[] = [];
    const textLower = text.toLowerCase();
    const words = query.split(/\s+/);
    
    for (const word of words) {
      if (snippets.length >= maxSnippets) break;
      
      let index = 0;
      while ((index = textLower.indexOf(word, index)) !== -1) {
        if (snippets.length >= maxSnippets) break;
        
        // Extract context around the match
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + word.length + 50);
        let snippet = text.substring(start, end);
        
        // Clean up snippet
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        snippets.push(snippet.trim());
        index += word.length;
      }
    }
    
    return snippets;
  }
}

// Export singleton instance
export const searchEngine = new TranscriptSearchEngine();

