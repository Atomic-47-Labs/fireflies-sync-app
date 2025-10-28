// UI Component for transcript ingestion
import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { ingestDownloadedTranscripts, getIngestionStats, diagnoseUnindexedMeetings, analyzeLargeFiles, comparePaths } from '../lib/search';
import type { IngestionProgress, DiagnosticResult, FileAnalysis } from '../lib/search';
import { DirectoryCheck } from './DirectoryCheck';

export function IngestionPanel() {
  const [stats, setStats] = useState({
    totalMeetings: 0,
    indexedMeetings: 0,
    notIndexed: 0,
    indexedPercentage: 0
  });
  const [isIngesting, setIsIngesting] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis[]>([]);
  const [showFileAnalysis, setShowFileAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const newStats = await getIngestionStats();
    setStats(newStats);
  };

  const handleIngest = async () => {
    setIsIngesting(true);
    setShowErrors(false);

    try {
      const finalProgress = await ingestDownloadedTranscripts({
        onProgress: (p) => {
          setProgress({ ...p });
        },
        batchSize: 10,
        skipExisting: true
      });

      setProgress(finalProgress);
      
      // Reload stats after ingestion
      await loadStats();
      
      console.log('✅ Ingestion complete:', finalProgress);
    } catch (error) {
      console.error('❌ Ingestion failed:', error);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setShowDiagnostics(false);
    
    try {
      const results = await diagnoseUnindexedMeetings();
      setDiagnostics(results);
      setShowDiagnostics(true);
    } catch (error) {
      console.error('❌ Diagnosis failed:', error);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleAnalyzeFiles = async () => {
    setIsAnalyzing(true);
    setShowFileAnalysis(false);
    
    try {
      const analysis = await analyzeLargeFiles();
      setFileAnalysis(analysis);
      setShowFileAnalysis(true);
    } catch (error) {
      console.error('❌ File analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const needsIngestion = stats.notIndexed > 0;
  const progressPercent = progress 
    ? Math.round((progress.processed / progress.total) * 100) 
    : 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transcript Search Index</h3>
          <p className="text-sm text-gray-600 mt-1">
            Index downloaded transcripts for full-text search
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalMeetings}</div>
            <div className="text-xs text-gray-600">Total Downloaded</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.indexedMeetings}</div>
            <div className="text-xs text-gray-600">Indexed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{stats.notIndexed}</div>
            <div className="text-xs text-gray-600">Not Indexed</div>
          </div>
        </div>

        {/* Progress Bar */}
        {!isIngesting && stats.totalMeetings > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Index Progress</span>
              <span className="font-medium text-gray-900">{stats.indexedPercentage}%</span>
            </div>
            <ProgressBar 
              value={stats.indexedPercentage} 
              className="h-2"
            />
          </div>
        )}

        {/* Active Ingestion Progress */}
        {isIngesting && progress && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Processing transcripts...</span>
              <span className="font-medium text-gray-900">
                {progress.processed} / {progress.total}
              </span>
            </div>
            
            <ProgressBar 
              value={progressPercent} 
              className="h-3"
            />

            {progress.currentMeeting && (
              <div className="text-xs text-gray-600 truncate">
                Current: {progress.currentMeeting}
              </div>
            )}

            <div className="flex gap-4 text-xs">
              <span className="text-green-600">
                ✓ {progress.succeeded} succeeded
              </span>
              {progress.failed > 0 && (
                <span className="text-red-600">
                  ✗ {progress.failed} failed
                </span>
              )}
              {progress.skipped > 0 && (
                <span className="text-gray-600">
                  ⏭ {progress.skipped} skipped
                </span>
              )}
            </div>
          </div>
        )}

        {/* Errors */}
        {progress && progress.errors.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              {showErrors ? 'Hide' : 'Show'} {progress.errors.length} error(s)
            </button>
            
            {showErrors && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-red-50 rounded p-3 space-y-2">
                {progress.errors.map((error, idx) => (
                  <div key={idx} className="text-xs">
                    <div className="font-medium text-red-900">{error.meetingId}</div>
                    <div className="text-red-700">{error.error}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleIngest}
            disabled={isIngesting || !needsIngestion}
            variant={needsIngestion ? 'primary' : 'secondary'}
            className="flex-1"
          >
            {isIngesting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Indexing...
              </>
            ) : needsIngestion ? (
              `Index ${stats.notIndexed} Transcript${stats.notIndexed !== 1 ? 's' : ''}`
            ) : (
              '✓ All Transcripts Indexed'
            )}
          </Button>

          {stats.notIndexed > 0 && (
            <>
              <Button
                onClick={handleDiagnose}
                disabled={isDiagnosing || isIngesting || isAnalyzing}
                variant="outline"
              >
                {isDiagnosing ? 'Diagnosing...' : '🔍 Diagnose'}
              </Button>
              
              <Button
                onClick={handleAnalyzeFiles}
                disabled={isAnalyzing || isIngesting || isDiagnosing}
                variant="outline"
              >
                {isAnalyzing ? 'Analyzing...' : '📦 File Sizes'}
              </Button>
              
              <Button
                onClick={async () => {
                  console.log('='.repeat(80));
                  console.log('PATH COMPARISON DEBUG');
                  console.log('='.repeat(80));
                  await comparePaths();
                }}
                disabled={isAnalyzing || isIngesting || isDiagnosing}
                variant="outline"
                size="sm"
              >
                🐛 Compare Paths
              </Button>
            </>
          )}

          <Button
            onClick={loadStats}
            disabled={isIngesting}
            variant="outline"
          >
            Refresh
          </Button>
        </div>

        {/* Diagnostics Results */}
        {showDiagnostics && diagnostics.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-gray-900">
                Diagnostic Results ({diagnostics.length} issues found)
              </h4>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Hide
              </button>
            </div>
            
            {/* Issue Summary */}
            <div className="mb-3 p-3 bg-blue-50 rounded text-xs">
              <div className="font-semibold mb-1">Issue Breakdown:</div>
              {Object.entries(
                diagnostics.reduce((acc, d) => {
                  acc[d.issue] = (acc[d.issue] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([issue, count]) => (
                <div key={issue} className="text-gray-700">
                  • {issue}: {count}
                </div>
              ))}
            </div>

            <div className="max-h-60 overflow-y-auto bg-gray-50 rounded p-3 space-y-2">
              {diagnostics.slice(0, 20).map((diag, idx) => (
                <div key={idx} className="text-xs border-b border-gray-200 pb-2">
                  <div className="font-medium text-gray-900">{diag.meetingTitle}</div>
                  <div className="text-red-700">Issue: {diag.issue}</div>
                  <div className="text-gray-600">{diag.details}</div>
                </div>
              ))}
              {diagnostics.length > 20 && (
                <div className="text-xs text-gray-600 pt-2">
                  ... and {diagnostics.length - 20} more (check console for full list)
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Size Analysis */}
        {showFileAnalysis && fileAnalysis.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-gray-900">
                File Size Analysis ({fileAnalysis.length} files)
              </h4>
              <button
                onClick={() => setShowFileAnalysis(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Hide
              </button>
            </div>
            
            {/* Summary Stats */}
            <div className="mb-3 p-3 bg-purple-50 rounded text-xs space-y-1">
              <div className="font-semibold">File Size Summary:</div>
              <div className="text-gray-700">
                • Readable: {fileAnalysis.filter(f => f.status === 'readable').length}
              </div>
              <div className="text-gray-700">
                • Errors: {fileAnalysis.filter(f => f.status === 'error').length}
              </div>
              <div className="text-gray-700">
                • Average size: {Math.round(fileAnalysis.reduce((sum, f) => sum + f.sizeKB, 0) / fileAnalysis.length)}KB
              </div>
              <div className="text-gray-700">
                • Largest: {Math.max(...fileAnalysis.map(f => f.sizeKB))}KB
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto bg-gray-50 rounded p-3 space-y-2">
              {fileAnalysis.slice(0, 20).map((analysis, idx) => (
                <div key={idx} className="text-xs border-b border-gray-200 pb-2">
                  <div className="font-medium text-gray-900">{analysis.meetingTitle}</div>
                  <div className="text-blue-700">
                    Size: {analysis.sizeKB}KB
                    {analysis.sentenceCount && ` • ${analysis.sentenceCount} sentences`}
                  </div>
                  <div className={analysis.status === 'error' ? 'text-red-700' : 'text-green-700'}>
                    Status: {analysis.status}
                    {analysis.errorMessage && ` - ${analysis.errorMessage}`}
                  </div>
                </div>
              ))}
              {fileAnalysis.length > 20 && (
                <div className="text-xs text-gray-600 pt-2">
                  ... and {fileAnalysis.length - 20} more (check console for full list)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <p>
            • Indexing enables full-text search across all meeting transcripts
          </p>
          <p>
            • This process reads transcript files from disk and stores searchable content in the browser
          </p>
          <p>
            • You only need to do this once (or when new transcripts are downloaded)
          </p>
        </div>

        {/* Debug: Directory Access Check */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t">
            <DirectoryCheck />
          </div>
        )}
      </div>
    </Card>
  );
}

