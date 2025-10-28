// Modal component to view full transcript with highlighted search terms
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { db } from '../lib/db';
import { fileSystem } from '../lib/storage';
import type { SearchResult, FirefliesTranscript } from '../types';
import { formatRelativeTime } from '../lib/utils';

interface TranscriptViewerProps {
  result: SearchResult;
  searchQuery: string;
  onClose: () => void;
}

interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp?: number;
}

export function TranscriptViewer({ result, searchQuery, onClose }: TranscriptViewerProps) {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [summaryText, setSummaryText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
  const [copySuccess, setCopySuccess] = useState(false);
  const [chatGPTSuccess, setChatGPTSuccess] = useState(false);
  const firstHighlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContent();
  }, [result.meeting.id]);

  useEffect(() => {
    // Scroll to first highlight when content loads
    if (firstHighlightRef.current) {
      setTimeout(() => {
        firstHighlightRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [transcriptLines, summaryText, activeTab]);

  const loadContent = async () => {
    setLoading(true);
    try {
      // Load full transcript from file to get sentence-by-sentence data
      const files = await db.files
        .where('[meeting_id+file_type]')
        .equals([result.meeting.id, 'transcript_json'])
        .toArray();

      if (files.length > 0 && files[0].file_path) {
        const transcript = await readTranscriptFile(files[0].file_path);
        if (transcript && transcript.sentences) {
          // Group sentences by speaker
          const lines = groupBySpeaker(transcript.sentences);
          setTranscriptLines(lines);
        }
        
        // Try to read summary.txt from filesystem
        const summaryFromFile = await readSummaryFile(files[0].file_path);
        if (summaryFromFile) {
          setSummaryText(summaryFromFile);
        } else {
          // Fallback to database
          const summary = await db.summaryContent.get(result.meeting.id);
          if (summary) {
            setSummaryText(summary.text);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load transcript:', error);
    } finally {
      setLoading(false);
    }
  };

  const readSummaryFile = async (transcriptPath: string): Promise<string | null> => {
    try {
      const summaryPath = transcriptPath.replace('transcript.json', 'summary.txt');
      const parts = summaryPath.split('/');
      let monthFolder = '';
      let meetingFolder = '';
      
      for (let i = 0; i < parts.length; i++) {
        if (/^\d{4}-\d{2}$/.test(parts[i])) {
          monthFolder = parts[i];
          if (i + 1 < parts.length) {
            meetingFolder = parts[i + 1];
          }
          break;
        }
      }

      const rootHandle = fileSystem.getRootHandle();
      if (!rootHandle || !monthFolder || !meetingFolder) return null;

      const monthHandle = await rootHandle.getDirectoryHandle(monthFolder);
      const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder);
      const fileHandle = await meetingHandle.getFileHandle('summary.txt');
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      return null;
    }
  };

  const readTranscriptFile = async (filePath: string): Promise<FirefliesTranscript | null> => {
    try {
      const parts = filePath.split('/');
      let monthFolder = '';
      let meetingFolder = '';
      
      for (let i = 0; i < parts.length; i++) {
        if (/^\d{4}-\d{2}$/.test(parts[i])) {
          monthFolder = parts[i];
          if (i + 1 < parts.length) {
            meetingFolder = parts[i + 1];
          }
          break;
        }
      }

      const rootHandle = fileSystem.getRootHandle();
      if (!rootHandle || !monthFolder || !meetingFolder) return null;

      const monthHandle = await rootHandle.getDirectoryHandle(monthFolder);
      const meetingHandle = await monthHandle.getDirectoryHandle(meetingFolder);
      const fileHandle = await meetingHandle.getFileHandle('transcript.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to read transcript file:', error);
      return null;
    }
  };

  const groupBySpeaker = (sentences: any[]): TranscriptLine[] => {
    const lines: TranscriptLine[] = [];
    let currentSpeaker = '';
    let currentText = '';
    let currentTimestamp: number | undefined;

    sentences.forEach((sentence, index) => {
      const speaker = sentence.speaker_name || sentence.speaker || 'Unknown';
      const text = sentence.text || '';
      
      if (speaker === currentSpeaker) {
        // Same speaker, append text
        currentText += ' ' + text;
      } else {
        // New speaker, save previous and start new
        if (currentText) {
          lines.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: currentTimestamp
          });
        }
        currentSpeaker = speaker;
        currentText = text;
        currentTimestamp = sentence.start_time;
      }
    });

    // Add final line
    if (currentText) {
      lines.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        timestamp: currentTimestamp
      });
    }

    return lines;
  };

  const formatTimestamp = (seconds: number | undefined): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyTranscript = async () => {
    try {
      if (activeTab === 'transcript') {
        const text = transcriptLines
          .map(line => `${line.speaker}: ${line.text}`)
          .join('\n\n');
        await navigator.clipboard.writeText(text);
      } else {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadMarkdown = () => {
    try {
      // Create transcript markdown
      const transcriptMd = generateTranscriptMarkdown();
      
      // Create summary markdown
      const summaryMd = generateSummaryMarkdown();
      
      // Download transcript
      downloadFile(transcriptMd, `${sanitizeFilename(result.meeting.title)}_transcript.md`);
      
      // Download summary
      downloadFile(summaryMd, `${sanitizeFilename(result.meeting.title)}_summary.md`);
      
      console.log('✅ Downloaded both markdown files');
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const handleSendToChatGPT = async () => {
    try {
      let content = '';
      
      if (activeTab === 'transcript') {
        // Format transcript for ChatGPT
        content = `Meeting: ${result.meeting.title}\n`;
        content += `Date: ${new Date(result.meeting.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}\n\n`;
        
        if (result.meeting.participants && result.meeting.participants.length > 0) {
          content += `Participants: ${result.meeting.participants.join(', ')}\n\n`;
        }
        
        content += '--- FULL TRANSCRIPT ---\n\n';
        
        transcriptLines.forEach(line => {
          const timestamp = line.timestamp ? `[${formatTimestamp(line.timestamp)}] ` : '';
          content += `${line.speaker} ${timestamp}:\n${line.text}\n\n`;
        });
      } else {
        // Format summary for ChatGPT
        content = `Meeting: ${result.meeting.title}\n`;
        content += `Date: ${new Date(result.meeting.date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}\n\n`;
        
        if (result.meeting.participants && result.meeting.participants.length > 0) {
          content += `Participants: ${result.meeting.participants.join(', ')}\n\n`;
        }
        
        content += '--- MEETING SUMMARY ---\n\n';
        content += summaryText || 'No summary available.';
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(content);
      
      // Show success message
      setChatGPTSuccess(true);
      setTimeout(() => setChatGPTSuccess(false), 3000);
      
      // Open ChatGPT in new tab
      window.open('https://chat.openai.com', '_blank', 'noopener,noreferrer');
      
      console.log('✅ Content copied and ChatGPT opened');
    } catch (error) {
      console.error('Failed to send to ChatGPT:', error);
      // Still try to open ChatGPT even if copy fails
      window.open('https://chat.openai.com', '_blank', 'noopener,noreferrer');
    }
  };

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '-')
      .trim();
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateTranscriptMarkdown = (): string => {
    let md = `# ${result.meeting.title}\n\n`;
    
    // Meeting metadata
    md += `**Date:** ${new Date(result.meeting.date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n\n`;
    
    if (result.meeting.duration) {
      md += `**Duration:** ${Math.floor(result.meeting.duration / 60)}m ${result.meeting.duration % 60}s\n\n`;
    }
    
    if (result.meeting.organizer_email) {
      md += `**Organizer:** ${result.meeting.organizer_email}\n\n`;
    }
    
    if (result.meeting.participants && result.meeting.participants.length > 0) {
      md += `**Participants:** ${result.meeting.participants.join(', ')}\n\n`;
    }
    
    md += `---\n\n`;
    md += `## Full Transcript\n\n`;
    
    // Add transcript lines
    transcriptLines.forEach(line => {
      if (line.timestamp !== undefined) {
        md += `### ${line.speaker} [${formatTimestamp(line.timestamp)}]\n\n`;
      } else {
        md += `### ${line.speaker}\n\n`;
      }
      md += `${line.text}\n\n`;
    });
    
    return md;
  };

  const generateSummaryMarkdown = (): string => {
    let md = `# ${result.meeting.title} - Summary\n\n`;
    
    // Meeting metadata
    md += `**Date:** ${new Date(result.meeting.date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n\n`;
    
    if (result.meeting.duration) {
      md += `**Duration:** ${Math.floor(result.meeting.duration / 60)}m ${result.meeting.duration % 60}s\n\n`;
    }
    
    if (result.meeting.organizer_email) {
      md += `**Organizer:** ${result.meeting.organizer_email}\n\n`;
    }
    
    if (result.meeting.participants && result.meeting.participants.length > 0) {
      md += `**Participants:** ${result.meeting.participants.join(', ')}\n\n`;
    }
    
    md += `---\n\n`;
    
    // Add summary content
    md += summaryText || 'No summary available.';
    
    return md;
  };

  const linkifyText = (text: string): JSX.Element[] => {
    // Convert URLs and emails to clickable links
    const parts: JSX.Element[] = [];
    let currentIndex = 0;
    let partIndex = 0;
    
    // Combined regex for URLs and emails
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > currentIndex) {
        parts.push(<span key={`text-${partIndex++}`}>{text.substring(currentIndex, match.index)}</span>);
      }
      
      const matchedText = match[0];
      let href = matchedText;
      
      // Determine link type and format href
      if (matchedText.includes('@')) {
        // Email
        href = `mailto:${matchedText}`;
        parts.push(
          <a
            key={`link-${partIndex++}`}
            href={href}
            className="text-blue-600 hover:text-blue-800 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {matchedText}
          </a>
        );
      } else if (matchedText.startsWith('www.')) {
        // URL starting with www
        href = `https://${matchedText}`;
        parts.push(
          <a
            key={`link-${partIndex++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {matchedText}
          </a>
        );
      } else {
        // Regular URL
        parts.push(
          <a
            key={`link-${partIndex++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {matchedText}
          </a>
        );
      }
      
      currentIndex = match.index + matchedText.length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(<span key={`text-${partIndex++}`}>{text.substring(currentIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : [<span key="0">{text}</span>];
  };

  const renderSummaryContent = (text: string): JSX.Element => {
    // Convert markdown/plain text to rich HTML with proper formatting
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, index) => {
      let trimmed = line.trim();
      
      if (!trimmed) {
        elements.push(<div key={index} className="h-3" />);
        return;
      }
      
      // Handle separators
      if (trimmed.match(/^[=\-]{3,}$/)) {
        elements.push(<hr key={index} className="my-6 border-gray-300" />);
        return;
      }
      
      // Parse inline formatting (bold, etc.) AND linkify
      const parseInlineFormatting = (text: string): JSX.Element[] => {
        const parts: JSX.Element[] = [];
        let currentText = text;
        let partIndex = 0;
        
        // Bold: **text**
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;
        
        while ((match = boldRegex.exec(currentText)) !== null) {
          // Add text before bold (with linkification)
          if (match.index > lastIndex) {
            const textPart = currentText.substring(lastIndex, match.index);
            linkifyText(textPart).forEach(part => {
              parts.push(<span key={`text-${partIndex++}`}>{part}</span>);
            });
          }
          // Add bold text (with linkification inside)
          const boldContent = linkifyText(match[1]);
          parts.push(<strong key={`bold-${partIndex++}`} className="font-semibold text-gray-900">{boldContent}</strong>);
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text (with linkification)
        if (lastIndex < currentText.length) {
          const textPart = currentText.substring(lastIndex);
          linkifyText(textPart).forEach(part => {
            parts.push(<span key={`text-${partIndex++}`}>{part}</span>);
          });
        }
        
        return parts.length > 0 ? parts : linkifyText(text);
      };
      
      // Main heading (OVERVIEW:, ACTION ITEMS:, etc.)
      if (trimmed.match(/^[A-Z\s]+:$/)) {
        elements.push(
          <h2 key={index} className="text-lg font-bold text-blue-800 mt-6 mb-3 uppercase tracking-wide">
            {trimmed.replace(':', '')}
          </h2>
        );
      } else if (trimmed.startsWith('Meeting: ') || trimmed.startsWith('Date: ') || 
                 trimmed.startsWith('Duration: ') || trimmed.startsWith('Organizer: ')) {
        // Metadata lines at top
        const [label, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        elements.push(
          <div key={index} className="mb-1 text-sm">
            <span className="font-semibold text-gray-700">{label}:</span>
            <span className="text-gray-800 ml-2">{value}</span>
          </div>
        );
      } else if (trimmed.startsWith('Chapter ') || trimmed.match(/^Chapter \d+:/)) {
        // Chapter headings
        elements.push(
          <h3 key={index} className="text-base font-semibold text-gray-900 mt-4 mb-2 flex items-center gap-2">
            <span className="text-blue-600">📍</span>
            {parseInlineFormatting(trimmed)}
          </h3>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // Bullet points
        const content = trimmed.substring(2);
        elements.push(
          <div key={index} className="flex gap-3 mb-2 pl-2">
            <span className="text-blue-600 mt-1 text-lg leading-none">•</span>
            <div className="text-gray-800 flex-1 leading-relaxed">
              {parseInlineFormatting(content)}
            </div>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        // Numbered list
        const match = trimmed.match(/^(\d+)\.\s(.+)$/);
        if (match) {
          elements.push(
            <div key={index} className="flex gap-3 mb-2 pl-2">
              <span className="text-blue-600 font-semibold min-w-[24px]">{match[1]}.</span>
              <div className="text-gray-800 flex-1 leading-relaxed">
                {parseInlineFormatting(match[2])}
              </div>
            </div>
          );
        }
      } else {
        // Regular paragraph with inline formatting
        elements.push(
          <p key={index} className="text-gray-800 mb-3 leading-relaxed">
            {parseInlineFormatting(trimmed)}
          </p>
        );
      }
    });
    
    return <div className="text-left prose prose-sm max-w-none">{elements}</div>;
  };

  const highlightText = (text: string, query: string, isFirst: boolean = false): JSX.Element[] => {
    if (!query.trim() || !text) {
      return linkifyText(text);
    }

    // Split query into individual words
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (queryWords.length === 0) {
      return linkifyText(text);
    }

    // Create regex pattern for all query words
    const pattern = queryWords.map(word => 
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    let isFirstHighlight = isFirst;
    
    return parts.map((part, index) => {
      const isMatch = queryWords.some(word => 
        part.toLowerCase() === word.toLowerCase()
      );
      
      if (isMatch) {
        const element = (
          <span
            key={index}
            ref={isFirstHighlight ? firstHighlightRef : null}
            className="bg-yellow-300 text-gray-900 font-semibold px-0.5 rounded"
          >
            {part}
          </span>
        );
        isFirstHighlight = false;
        return element;
      }
      
      // Linkify non-highlighted parts
      return <span key={index}>{linkifyText(part)}</span>;
    });
  };

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
      <Card className="w-full max-w-6xl my-8 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{result.meeting.title}</h2>
              
              {/* Meeting Metadata Grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">📅</span>
                  <span className="font-medium text-gray-700">Date:</span>
                  <span className="text-gray-900">
                    {new Date(result.meeting.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">⏱️</span>
                  <span className="font-medium text-gray-700">Duration:</span>
                  <span className="text-gray-900">
                    {result.meeting.duration 
                      ? `${Math.floor(result.meeting.duration / 60)}m ${result.meeting.duration % 60}s`
                      : 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">👤</span>
                  <span className="font-medium text-gray-700">Organizer:</span>
                  {result.meeting.organizer_email ? (
                    <a
                      href={`mailto:${result.meeting.organizer_email}`}
                      className="text-blue-600 hover:text-blue-800 underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {result.meeting.organizer_email}
                    </a>
                  ) : (
                    <span className="text-gray-900">N/A</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">👥</span>
                  <span className="font-medium text-gray-700">Participants:</span>
                  <span className="text-gray-900">
                    {result.meeting.participants?.length || 0}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🎯</span>
                  <span className="font-medium text-gray-700">Match Score:</span>
                  <span className="text-blue-600 font-semibold">
                    {Math.round(result.score)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🕒</span>
                  <span className="font-medium text-gray-700">Age:</span>
                  <span className="text-gray-900">
                    {formatRelativeTime(result.meeting.date)}
                  </span>
                </div>
              </div>
              
              {/* Participants List */}
              {result.meeting.participants && result.meeting.participants.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex flex-wrap gap-2">
                    {result.meeting.participants.map((participant, idx) => {
                      const isEmail = participant.includes('@');
                      return isEmail ? (
                        <a
                          key={idx}
                          href={`mailto:${participant}`}
                          className="px-2 py-1 bg-white text-xs text-blue-600 hover:text-blue-800 rounded border border-blue-300 hover:border-blue-500 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {participant}
                        </a>
                      ) : (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-white text-xs text-gray-700 rounded border border-gray-300"
                        >
                          {participant}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs & Actions */}
        <div className="flex items-center justify-between px-6 pt-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('transcript')}
              className={`px-4 py-2 text-sm font-medium rounded-t transition ${
                activeTab === 'transcript'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📝 Full Transcript
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-sm font-medium rounded-t transition ${
                activeTab === 'summary'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Summary
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSendToChatGPT}
              className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded transition flex items-center gap-1 font-medium"
              title="Copy content and open ChatGPT"
            >
              {chatGPTSuccess ? (
                <>
                  ✓ Copied! Paste in ChatGPT
                </>
              ) : (
                <>
                  🤖 Send to ChatGPT
                </>
              )}
            </button>
            
            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded transition flex items-center gap-1"
              title="Download both transcript and summary as markdown files"
            >
              📥 Download MD
            </button>
            
            <button
              onClick={handleCopyTranscript}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition flex items-center gap-1"
            >
              {copySuccess ? (
                <>
                  ✓ Copied
                </>
              ) : (
                <>
                  📋 Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading content...</span>
            </div>
          ) : (
            <>
              {activeTab === 'transcript' && (
                <div className="space-y-3 text-left">
                  {transcriptLines.length > 0 ? (
                    transcriptLines.map((line, index) => {
                      const textLower = line.text.toLowerCase();
                      const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                      const hasMatch = queryWords.some(word => textLower.includes(word));
                      
                      return (
                        <div
                          key={index}
                          ref={hasMatch && !firstHighlightRef.current ? firstHighlightRef : null}
                          className={`border-l-4 pl-4 py-3 rounded-r ${
                            hasMatch 
                              ? 'border-yellow-400 bg-yellow-50' 
                              : 'border-blue-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-blue-700 text-sm">
                              {line.speaker}
                            </span>
                            {line.timestamp !== undefined && (
                              <span className="text-xs text-gray-500 font-mono bg-white px-2 py-0.5 rounded">
                                {formatTimestamp(line.timestamp)}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-800 leading-relaxed text-base">
                            {highlightText(line.text, searchQuery, false)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">📄</div>
                      <div>No transcript content available</div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'summary' && (
                <div className="max-w-none text-left">
                  {summaryText ? (
                    renderSummaryContent(summaryText)
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">📋</div>
                      <div>No summary content available</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-600">
            💡 Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Esc</kbd> to close
          </div>
          <div className="flex gap-2">
            {result.meeting.participants && result.meeting.participants.length > 0 && (
              <div className="text-xs text-gray-600">
                <span className="font-semibold">Participants:</span>{' '}
                {result.meeting.participants.join(', ')}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

