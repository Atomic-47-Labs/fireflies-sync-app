// Modal component to show filtered meeting lists
import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { TranscriptViewer } from './TranscriptViewer';
import type { Meeting } from '../types';
import { formatRelativeTime } from '../lib/utils';

interface MeetingListModalProps {
  meetings: Meeting[];
  title: string;
  onClose: () => void;
}

export function MeetingListModal({ meetings, title, onClose }: MeetingListModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredMeetings = meetings
    .filter(meeting => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        meeting.title.toLowerCase().includes(query) ||
        meeting.organizer_email?.toLowerCase().includes(query) ||
        meeting.participants?.some(p => p.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.date - b.date;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (selectedMeeting) {
    return (
      <TranscriptViewer
        result={{
          meeting: selectedMeeting,
          score: 100,
          highlights: [],
          matchType: 'title'
        }}
        searchQuery=""
        onClose={() => setSelectedMeeting(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
      <Card className="w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{meetings.length} meetings</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search meetings, organizers, participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'duration')}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="title">Sort by Title</option>
                <option value="duration">Sort by Duration</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredMeetings.length} of {meetings.length} meetings
            </div>
          )}
        </div>

        {/* Meeting List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredMeetings.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                className="border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{meeting.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>📅 {formatRelativeTime(meeting.date)}</span>
                      {meeting.duration && (
                        <span>⏱️ {formatDuration(meeting.duration)}</span>
                      )}
                      {meeting.participants && meeting.participants.length > 0 && (
                        <span>👥 {meeting.participants.length} participants</span>
                      )}
                    </div>
                    {meeting.organizer_email && (
                      <div className="text-xs text-gray-500 mt-1">
                        Organized by: {meeting.organizer_email}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <Button variant="outline" size="sm">
                      View →
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMeetings.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-2">🔍</div>
              <div className="font-semibold">No meetings found</div>
              <div className="text-sm mt-1">Try adjusting your search criteria</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            💡 Click any meeting to view full transcript and summary
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

