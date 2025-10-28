// Analytics dashboard for meeting database insights
import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MeetingListModal } from './MeetingListModal';
import { db } from '../lib/db';
import type { Meeting } from '../types';

interface AttendeeStats {
  email: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  meetings: string[];
}

interface TimeStats {
  month: string;
  count: number;
}

interface DurationStats {
  total: number;
  average: number;
  longest: { title: string; duration: number };
  shortest: { title: string; duration: number };
}

interface TopicStats {
  topic: string;
  count: number;
}

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState({
    totalMeetings: 0,
    totalParticipants: 0,
    totalDuration: 0,
    avgDuration: 0,
    dateRange: { earliest: 0, latest: 0 }
  });
  const [attendees, setAttendees] = useState<AttendeeStats[]>([]);
  const [timeData, setTimeData] = useState<TimeStats[]>([]);
  const [durationStats, setDurationStats] = useState<DurationStats | null>(null);
  const [topics, setTopics] = useState<TopicStats[]>([]);
  const [organizers, setOrganizers] = useState<Array<{ email: string; count: number }>>([]);
  const [modalData, setModalData] = useState<{ meetings: Meeting[]; title: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    meetingsWithDuration: number;
    meetingsWithoutDuration: number;
    sampleWithDuration: Array<{ title: string; duration: number }>;
    sampleWithoutDuration: Array<{ title: string; duration: number }>;
  } | null>(null);

  useEffect(() => {
    analyzeDatabase();
  }, []);

  const analyzeDatabase = async () => {
    setLoading(true);
    try {
      // Get all meetings
      let meetings = await db.meetings.toArray();
      
      // Apply filters
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        meetings = meetings.filter(m =>
          m.title.toLowerCase().includes(query) ||
          m.organizer_email?.toLowerCase().includes(query) ||
          m.participants?.some(p => p.toLowerCase().includes(query))
        );
      }
      
      if (dateRange.start) {
        const startTime = new Date(dateRange.start).getTime();
        meetings = meetings.filter(m => m.date >= startTime);
      }
      
      if (dateRange.end) {
        const endTime = new Date(dateRange.end).getTime();
        meetings = meetings.filter(m => m.date <= endTime);
      }
      
      setAllMeetings(meetings);
      
      if (meetings.length === 0) {
        setLoading(false);
        return;
      }

      // Basic stats
      // Debug: Check duration data
      const meetingsWithDurationData = meetings.filter(m => m.duration && m.duration > 0);
      const meetingsWithoutDurationData = meetings.filter(m => !m.duration || m.duration === 0);
      
      setDebugInfo({
        meetingsWithDuration: meetingsWithDurationData.length,
        meetingsWithoutDuration: meetingsWithoutDurationData.length,
        sampleWithDuration: meetingsWithDurationData.slice(0, 3).map(m => ({ 
          title: m.title.substring(0, 40), 
          duration: m.duration 
        })),
        sampleWithoutDuration: meetingsWithoutDurationData.slice(0, 3).map(m => ({ 
          title: m.title.substring(0, 40), 
          duration: m.duration || 0 
        }))
      });
      
      console.log('📊 Duration Debug:', {
        totalMeetings: meetings.length,
        meetingsWithDuration: meetingsWithDurationData.length,
        meetingsWithoutDuration: meetingsWithoutDurationData.length,
        sampleDurations: meetings.slice(0, 5).map(m => ({ title: m.title.substring(0, 30), duration: m.duration }))
      });
      
      const totalDuration = meetings.reduce((sum, m) => sum + (m.duration || 0), 0);
      const avgDuration = meetingsWithDurationData.length > 0 
        ? Math.round(totalDuration / meetingsWithDurationData.length)
        : 0;
      const dates = meetings.map(m => m.date).sort((a, b) => a - b);
      
      setStats({
        totalMeetings: meetings.length,
        totalParticipants: new Set(meetings.flatMap(m => m.participants || [])).size,
        totalDuration,
        avgDuration,
        dateRange: {
          earliest: dates[0],
          latest: dates[dates.length - 1]
        }
      });

      // Analyze attendees
      const attendeeMap = new Map<string, { count: number; duration: number; meetings: string[] }>();
      meetings.forEach(meeting => {
        const participants = meeting.participants || [];
        participants.forEach(p => {
          if (!attendeeMap.has(p)) {
            attendeeMap.set(p, { count: 0, duration: 0, meetings: [] });
          }
          const data = attendeeMap.get(p)!;
          data.count++;
          data.duration += meeting.duration || 0;
          data.meetings.push(meeting.title);
        });
      });

      const attendeeStats: AttendeeStats[] = Array.from(attendeeMap.entries())
        .map(([email, data]) => ({
          email,
          count: data.count,
          totalDuration: data.duration,
          avgDuration: Math.round(data.duration / data.count),
          meetings: data.meetings
        }))
        .sort((a, b) => b.count - a.count);
      
      setAttendees(attendeeStats);

      // Analyze meetings over time
      const monthMap = new Map<string, number>();
      meetings.forEach(meeting => {
        const date = new Date(meeting.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
      });

      const timeStats = Array.from(monthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
      
      setTimeData(timeStats);

      // Duration analysis
      const meetingsWithDuration = meetings.filter(m => m.duration && m.duration > 0);
      if (meetingsWithDuration.length > 0) {
        const sorted = [...meetingsWithDuration].sort((a, b) => (b.duration || 0) - (a.duration || 0));
        setDurationStats({
          total: totalDuration,
          average: avgDuration,
          longest: { title: sorted[0].title, duration: sorted[0].duration || 0 },
          shortest: { title: sorted[sorted.length - 1].title, duration: sorted[sorted.length - 1].duration || 0 }
        });
      }

      // Extract topics from titles
      const topicMap = new Map<string, number>();
      meetings.forEach(meeting => {
        // Simple keyword extraction from titles
        const words = meeting.title
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3);
        
        words.forEach(word => {
          topicMap.set(word, (topicMap.get(word) || 0) + 1);
        });
      });

      const topicStats = Array.from(topicMap.entries())
        .map(([topic, count]) => ({ topic, count }))
        .filter(t => t.count > 2) // Only topics mentioned 3+ times
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      setTopics(topicStats);

      // Analyze organizers
      const organizerMap = new Map<string, number>();
      meetings.forEach(meeting => {
        if (meeting.organizer_email) {
          organizerMap.set(meeting.organizer_email, (organizerMap.get(meeting.organizer_email) || 0) + 1);
        }
      });

      const organizerStats = Array.from(organizerMap.entries())
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count);
      
      setOrganizers(organizerStats);

    } catch (error) {
      console.error('Failed to analyze database:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) {
      return 'N/A';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes === 0) {
      return `${seconds}s`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Analyzing database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal */}
      {modalData && (
        <MeetingListModal
          meetings={modalData.meetings}
          title={modalData.title}
          onClose={() => setModalData(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Meeting Analytics</h1>
          <p className="text-gray-600 mt-1">Insights and patterns from your meeting database</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowDebug(!showDebug)} variant="outline">
            {showDebug ? '🔍 Hide Debug' : '🔍 Show Debug'}
          </Button>
          <Button onClick={analyzeDatabase} variant="outline">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🐛 Duration Data Debug</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">Meetings WITH duration data</div>
              <div className="text-2xl font-bold text-green-600">{debugInfo.meetingsWithDuration}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Meetings WITHOUT duration data</div>
              <div className="text-2xl font-bold text-red-600">{debugInfo.meetingsWithoutDuration}</div>
            </div>
          </div>

          {debugInfo.sampleWithDuration.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Sample meetings WITH duration:</div>
              {debugInfo.sampleWithDuration.map((m, idx) => (
                <div key={idx} className="text-xs text-gray-600 mb-1">
                  • {m.title} → {formatDuration(m.duration)}
                </div>
              ))}
            </div>
          )}

          {debugInfo.sampleWithoutDuration.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Sample meetings WITHOUT duration:</div>
              {debugInfo.sampleWithoutDuration.map((m, idx) => (
                <div key={idx} className="text-xs text-gray-600 mb-1">
                  • {m.title} → duration: {m.duration}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 p-3 bg-white rounded border border-gray-200">
            <strong>ℹ️ Note:</strong> If most meetings have no duration data, this might be a limitation of the Fireflies API 
            or the meetings were recorded without duration tracking. Duration data is fetched directly from Fireflies.
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-700 mb-1 block">Search</label>
            <Input
              type="text"
              placeholder="Filter by title, organizer, or participant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Start Date</label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">End Date</label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <Button onClick={analyzeDatabase} variant="primary">
            Apply Filters
          </Button>
          {(searchQuery || dateRange.start || dateRange.end) && (
            <Button
              onClick={() => {
                setSearchQuery('');
                setDateRange({ start: '', end: '' });
                setTimeout(analyzeDatabase, 0);
              }}
              variant="outline"
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Overview Stats - Now Clickable */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className="p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition"
          onClick={() => setModalData({ meetings: allMeetings, title: '📋 All Meetings' })}
        >
          <div className="text-sm text-gray-600 mb-1">Total Meetings</div>
          <div className="text-3xl font-bold text-blue-600">{stats.totalMeetings}</div>
          <div className="text-xs text-gray-500 mt-2">Click to view list →</div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Unique Participants</div>
          <div className="text-3xl font-bold text-green-600">{stats.totalParticipants}</div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Total Time</div>
          <div className="text-3xl font-bold text-purple-600">{formatDuration(stats.totalDuration)}</div>
          {stats.totalDuration === 0 && (
            <div className="text-xs text-gray-500 mt-1">⚠️ No duration data available</div>
          )}
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Avg Duration</div>
          <div className="text-3xl font-bold text-orange-600">{formatDuration(stats.avgDuration)}</div>
          {stats.avgDuration === 0 && (
            <div className="text-xs text-gray-500 mt-1">⚠️ No duration data available</div>
          )}
        </Card>
      </div>

      {/* Date Range */}
      {stats.dateRange.earliest > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">📅 Date Range</h3>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-gray-600">Earliest Meeting</div>
              <div className="text-lg font-semibold">
                {new Date(stats.dateRange.earliest).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div className="text-gray-400">→</div>
            <div>
              <div className="text-sm text-gray-600">Latest Meeting</div>
              <div className="text-lg font-semibold">
                {new Date(stats.dateRange.latest).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
            <div className="ml-auto">
              <div className="text-sm text-gray-600">Span</div>
              <div className="text-lg font-semibold">
                {Math.round((stats.dateRange.latest - stats.dateRange.earliest) / (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Grid Layout for Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Attendees - Clickable */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Most Frequent Attendees</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {attendees.slice(0, 15).map((attendee, idx) => (
              <div
                key={attendee.email}
                className="flex items-center gap-3 p-2 rounded hover:bg-blue-50 cursor-pointer transition"
                onClick={() => {
                  const attendeeMeetings = allMeetings.filter(m =>
                    m.participants?.includes(attendee.email)
                  );
                  setModalData({
                    meetings: attendeeMeetings,
                    title: `👤 Meetings with ${attendee.email}`
                  });
                }}
              >
                <div className="text-lg font-bold text-gray-400 w-6">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{attendee.email}</div>
                  <div className="text-xs text-gray-600">
                    {attendee.count} meetings • {formatDuration(attendee.totalDuration)} total • 
                    {formatDuration(attendee.avgDuration)} avg
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-600">{attendee.count}</div>
                  <div className="text-xs text-gray-500">View →</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Meetings Over Time - Clickable */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Meetings Over Time</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {timeData.slice(-12).map(({ month, count }) => (
              <div
                key={month}
                className="flex items-center gap-3 cursor-pointer hover:bg-blue-50 p-1 rounded transition"
                onClick={() => {
                  const [year, monthNum] = month.split('-');
                  const monthMeetings = allMeetings.filter(m => {
                    const d = new Date(m.date);
                    const meetingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return meetingMonth === month;
                  });
                  setModalData({
                    meetings: monthMeetings,
                    title: `📅 Meetings in ${month}`
                  });
                }}
              >
                <div className="text-sm font-medium text-gray-700 w-24">{month}</div>
                <div className="flex-1">
                  <div className="bg-blue-100 rounded-full h-6 relative">
                    <div
                      className="bg-blue-500 rounded-full h-6 flex items-center justify-end pr-2"
                      style={{ width: `${(count / Math.max(...timeData.map(t => t.count))) * 100}%` }}
                    >
                      <span className="text-xs font-semibold text-white">{count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Duration Stats */}
        {durationStats && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">⏱️ Duration Analysis</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">Longest Meeting</div>
                <div className="font-medium text-gray-900 truncate">{durationStats.longest.title}</div>
                <div className="text-lg font-bold text-orange-600">{formatDuration(durationStats.longest.duration)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Shortest Meeting</div>
                <div className="font-medium text-gray-900 truncate">{durationStats.shortest.title}</div>
                <div className="text-lg font-bold text-green-600">{formatDuration(durationStats.shortest.duration)}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Top Topics - Clickable */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🏷️ Common Topics</h3>
          <div className="flex flex-wrap gap-2">
            {topics.map(({ topic, count }) => (
              <button
                key={topic}
                className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium hover:bg-purple-200 transition cursor-pointer"
                title={`Click to see ${count} meetings about "${topic}"`}
                onClick={() => {
                  const topicMeetings = allMeetings.filter(m =>
                    m.title.toLowerCase().includes(topic.toLowerCase())
                  );
                  setModalData({
                    meetings: topicMeetings,
                    title: `🏷️ Meetings about "${topic}"`
                  });
                }}
              >
                {topic} <span className="text-purple-600 ml-1">×{count}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Top Organizers - Clickable */}
        <Card className="p-6 col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Meeting Organizers</h3>
          <div className="grid grid-cols-2 gap-4">
            {organizers.slice(0, 10).map((org, idx) => (
              <button
                key={org.email}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded hover:bg-blue-50 transition text-left"
                onClick={() => {
                  const organizerMeetings = allMeetings.filter(m =>
                    m.organizer_email === org.email
                  );
                  setModalData({
                    meetings: organizerMeetings,
                    title: `🎯 Meetings organized by ${org.email}`
                  });
                }}
              >
                <div className="text-lg font-bold text-gray-400">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{org.email}</div>
                  <div className="text-xs text-gray-600">{org.count} meetings organized</div>
                </div>
                <div className="text-xs text-blue-600">View →</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

