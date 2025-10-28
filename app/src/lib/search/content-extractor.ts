// Content extraction and keyword extraction utilities
import type { FirefliesTranscript, TranscriptContent, SummaryContent, SearchMetadata } from '../../types';

/**
 * Extract full transcript text from sentences
 */
export function extractTranscriptText(transcript: FirefliesTranscript): string {
  if (!transcript.sentences || transcript.sentences.length === 0) {
    return '';
  }

  return transcript.sentences
    .map(sentence => sentence.text)
    .join(' ')
    .trim();
}

/**
 * Extract unique speaker names
 */
export function extractSpeakers(transcript: FirefliesTranscript): string[] {
  if (!transcript.sentences || transcript.sentences.length === 0) {
    return [];
  }

  const speakers = new Set<string>();
  for (const sentence of transcript.sentences) {
    if (sentence.speaker_name) {
      speakers.add(sentence.speaker_name);
    }
  }

  return Array.from(speakers);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Extract combined summary text
 */
export function extractSummaryText(transcript: FirefliesTranscript): string {
  if (!transcript.summary) return '';

  const parts: string[] = [];

  if (transcript.summary.overview) {
    parts.push(transcript.summary.overview);
  }

  if (transcript.summary.action_items && transcript.summary.action_items.length > 0) {
    parts.push(...transcript.summary.action_items);
  }

  if (transcript.summary.outline && transcript.summary.outline.length > 0) {
    parts.push(...transcript.summary.outline);
  }

  if (transcript.summary.shorthand_bullet && transcript.summary.shorthand_bullet.length > 0) {
    parts.push(...transcript.summary.shorthand_bullet);
  }

  return parts.join(' ').trim();
}

/**
 * Extract keywords from text using simple frequency analysis
 */
export function extractKeywords(text: string, maxKeywords = 20): string[] {
  if (!text) return [];

  // Common stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
    't', 'just', 'don', 'now', 'im', 'yeah', 'okay', 'oh', 'um', 'uh',
    'like', 'know', 'think', 'mean', 'really', 'actually', 'basically'
  ]);

  // Tokenize and count word frequency
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word)); // Filter short words and stop words

  // Count frequencies
  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  // Sort by frequency and take top keywords
  const sortedWords = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sortedWords;
}

/**
 * Extract topics from summary outline
 */
export function extractTopics(transcript: FirefliesTranscript): string[] {
  if (!transcript.summary?.outline) return [];
  
  return transcript.summary.outline
    .map(topic => topic.trim())
    .filter(topic => topic.length > 0);
}

/**
 * Build TranscriptContent from transcript
 */
export function buildTranscriptContent(
  meetingId: string,
  transcript: FirefliesTranscript
): TranscriptContent {
  const text = extractTranscriptText(transcript);
  const speakers = extractSpeakers(transcript);
  
  return {
    meeting_id: meetingId,
    text,
    speakers,
    sentence_count: transcript.sentences?.length || 0,
    word_count: countWords(text),
    indexed_at: Date.now()
  };
}

/**
 * Build SummaryContent from transcript
 */
export function buildSummaryContent(
  meetingId: string,
  transcript: FirefliesTranscript
): SummaryContent {
  const text = extractSummaryText(transcript);
  
  return {
    meeting_id: meetingId,
    text,
    overview: transcript.summary?.overview,
    action_items: transcript.summary?.action_items || [],
    outline: transcript.summary?.outline || [],
    shorthand_bullet: transcript.summary?.shorthand_bullet || []
  };
}

/**
 * Build SearchMetadata from transcript
 */
export function buildSearchMetadata(
  meetingId: string,
  transcript: FirefliesTranscript
): SearchMetadata {
  // Combine all text for keyword extraction
  const transcriptText = extractTranscriptText(transcript);
  const summaryText = extractSummaryText(transcript);
  const combinedText = `${summaryText} ${transcriptText}`;
  
  // Extract keywords from combined text
  let keywords: string[] = [];
  if (transcript.summary?.keywords && transcript.summary.keywords.length > 0) {
    // Use keywords from Fireflies if available
    keywords = transcript.summary.keywords;
  } else {
    // Otherwise extract our own
    keywords = extractKeywords(combinedText, 20);
  }
  
  const topics = extractTopics(transcript);
  const speakers = extractSpeakers(transcript);
  
  return {
    meeting_id: meetingId,
    keywords,
    topics,
    speaker_names: speakers,
    extracted_at: Date.now()
  };
}

/**
 * Process transcript and return all searchable content
 */
export function processTranscriptForSearch(
  meetingId: string,
  transcript: FirefliesTranscript
): {
  transcriptContent: TranscriptContent;
  summaryContent: SummaryContent;
  searchMetadata: SearchMetadata;
} {
  return {
    transcriptContent: buildTranscriptContent(meetingId, transcript),
    summaryContent: buildSummaryContent(meetingId, transcript),
    searchMetadata: buildSearchMetadata(meetingId, transcript)
  };
}

