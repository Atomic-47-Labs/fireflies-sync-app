// Search functionality exports
export { searchEngine } from './transcript-search-engine';
export type { SearchOptions } from './transcript-search-engine';

// Ingestion exports
export { 
  ingestDownloadedTranscripts,
  ingestSingleTranscript,
  getIngestionStats,
  clearIndexedContent
} from './transcript-ingestion';
export type { IngestionProgress, IngestionOptions } from './transcript-ingestion';

// Content extraction exports
export { processTranscriptForSearch } from './content-extractor';

// Debug exports
export { debugFilePaths, testReadOneFile } from './transcript-ingestion-debug';

// Diagnostics exports
export { 
  diagnoseUnindexedMeetings, 
  getIndexingStats,
  retryFailedMeetings 
} from './ingestion-diagnostics';
export type { DiagnosticResult } from './ingestion-diagnostics';

// Large file analysis
export { analyzeLargeFiles } from './large-file-analyzer';
export type { FileAnalysis } from './large-file-analyzer';

// Path mismatch debugging
export { debugPathMismatches, listActualFolders, comparePaths } from './path-mismatch-debugger';
export type { PathMismatch } from './path-mismatch-debugger';

