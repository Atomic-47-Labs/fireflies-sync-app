// Full-text search interface for indexed transcripts
import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { TranscriptViewer } from './TranscriptViewer';
import { searchEngine, getIngestionStats } from '../lib/search';
import type { SearchResult } from '../types';
import { formatRelativeTime } from '../lib/utils';

export function TranscriptSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [viewingResult, setViewingResult] = useState<SearchResult | null>(null);
  const [stats, setStats] = useState({
    totalMeetings: 0,
    indexedMeetings: 0,
    notIndexed: 0,
    indexedPercentage: 0
  });

  // Initialize search engine on mount
  useEffect(() => {
    initializeSearch();
    loadStats();
  }, []);

  const initializeSearch = async () => {
    try {
      await searchEngine.initialize();
      setIsInitialized(true);
      console.log('✅ Search engine initialized');
    } catch (error) {
      console.error('Failed to initialize search:', error);
    }
  };

  const loadStats = async () => {
    const newStats = await getIngestionStats();
    setStats(newStats);
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await searchEngine.search(query, {
        limit: 50
      });
      setResults(searchResults);
      console.log(`Found ${searchResults.length} results for "${query}"`);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <>
      {/* Transcript Viewer Modal */}
      {viewingResult && (
        <TranscriptViewer
          result={viewingResult}
          searchQuery={query}
          onClose={() => setViewingResult(null)}
        />
      )}

      <div className="space-y-6">
      {/* Header & Stats */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Transcript Search</h2>
            <p className="text-sm text-gray-600 mt-1">
              Full-text search across all indexed meeting transcripts
            </p>
          </div>

          {/* Index Status */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.indexedMeetings}</div>
              <div className="text-sm text-gray-600">Indexed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{stats.totalMeetings}</div>
              <div className="text-sm text-gray-600">Total Meetings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.indexedPercentage}%</div>
              <div className="text-sm text-gray-600">Coverage</div>
            </div>
          </div>

          {/* Search Status */}
          <div className={`p-3 rounded ${
            isInitialized 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}>
            <div className="font-semibold">
              {isInitialized ? '✅ Search Engine Ready' : '⏳ Initializing...'}
            </div>
            {isInitialized && (
              <div className="text-sm mt-1">
                {stats.indexedMeetings} meeting transcripts available for search
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="flex gap-3">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search transcripts... (e.g., 'project timeline', 'budget discussion', 'action items')"
              className="flex-1"
              disabled={!isInitialized}
            />
            <Button
              onClick={handleSearch}
              disabled={!isInitialized || !query.trim() || isSearching}
              variant="primary"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Example Searches */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Try:</span>
            {['action items', 'budget', 'deadline', 'questions', 'next steps'].map(example => (
              <button
                key={example}
                onClick={() => {
                  setQuery(example);
                  setTimeout(() => handleSearch(), 100);
                }}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                disabled={!isInitialized}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({results.length})
            </h3>

            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={result.meeting.id}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    selectedResult?.meeting.id === result.meeting.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                  }`}
                  onClick={() => {
                    setSelectedResult(result);
                    setViewingResult(result);
                  }}
                >
                  {/* Meeting Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{result.meeting.title}</h4>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatRelativeTime(result.meeting.date)} • 
                        Score: {Math.round(result.score)} • 
                        Match: {result.matchType}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-blue-600 ml-4">
                      #{idx + 1}
                    </div>
                  </div>

                  {/* Highlights */}
                  {result.highlights.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {result.highlights.slice(0, 3).map((highlight, hIdx) => (
                        <div
                          key={hIdx}
                          className="text-sm text-gray-700 bg-yellow-50 p-2 rounded border-l-2 border-yellow-400"
                        >
                          ...{highlight}...
                        </div>
                      ))}
                      {result.highlights.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{result.highlights.length - 3} more matches
                        </div>
                      )}
                    </div>
                  )}

                  {/* Participants */}
                  {result.meeting.participants && result.meeting.participants.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Participants: {result.meeting.participants.slice(0, 3).join(', ')}
                      {result.meeting.participants.length > 3 && ` +${result.meeting.participants.length - 3} more`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <Card className="p-6">
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">🔍</div>
            <div className="font-semibold">No results found for "{query}"</div>
            <div className="text-sm mt-1">Try different keywords or check your spelling</div>
          </div>
        </Card>
      )}

      {/* Initial State */}
      {!query && results.length === 0 && (
        <Card className="p-6">
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💬</div>
            <div className="font-semibold">Start searching your transcripts</div>
            <div className="text-sm mt-1">
              Enter keywords to search across {stats.indexedMeetings} indexed meeting transcripts
            </div>
          </div>
        </Card>
      )}

      {/* Search Tips */}
      <Card className="p-6 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">💡 Search Tips</h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Use specific keywords for better results (e.g., "budget approval" vs "money")</li>
          <li>• Search finds matches in transcript text, summaries, and speaker names</li>
          <li>• Results are ranked by relevance with highlighted context</li>
          <li>• Try multiple related terms if you don't find what you're looking for</li>
        </ul>
      </Card>
      </div>
    </>
  );
}

