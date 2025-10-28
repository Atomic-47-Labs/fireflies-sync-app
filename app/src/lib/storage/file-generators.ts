// File Generators for different file types
import type { FirefliesTranscript, TranscriptSentence } from '../../types';
import { formatDate, formatDurationShort } from '../utils';

/**
 * Generate transcript JSON file content
 */
export function generateTranscriptJSON(transcript: FirefliesTranscript): string {
  const data = {
    meeting_id: transcript.id,
    title: transcript.title,
    date: transcript.date,
    duration: transcript.duration,
    organizer: transcript.organizer_email,
    participants: transcript.participants || [],
    sentences: transcript.sentences || [],
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Generate summary markdown file content
 */
export function generateSummaryMarkdown(transcript: FirefliesTranscript): string {
  const date = formatDate(new Date(transcript.date).getTime());
  const duration = formatDurationShort(transcript.duration);
  const summary = transcript.summary;

  let markdown = `# ${transcript.title}\n\n`;
  markdown += `**Date:** ${date}\n`;
  markdown += `**Duration:** ${duration}\n`;
  markdown += `**Organizer:** ${transcript.organizer_email}\n`;
  
  if (transcript.participants && transcript.participants.length > 0) {
    markdown += `**Participants:** ${transcript.participants.join(', ')}\n`;
  }
  
  markdown += '\n---\n\n';

  // Overview
  if (summary?.overview) {
    markdown += `## Overview\n\n${summary.overview}\n\n`;
  }

  // Action Items
  if (summary?.action_items && summary.action_items.length > 0) {
    markdown += `## Action Items\n\n`;
    summary.action_items.forEach(item => {
      markdown += `- ${item}\n`;
    });
    markdown += '\n';
  }

  // Key Topics / Outline
  if (summary?.outline && summary.outline.length > 0) {
    markdown += `## Key Topics\n\n`;
    summary.outline.forEach(topic => {
      markdown += `- ${topic}\n`;
    });
    markdown += '\n';
  }

  // Shorthand Bullets
  if (summary?.shorthand_bullet && summary.shorthand_bullet.length > 0) {
    markdown += `## Summary Points\n\n`;
    summary.shorthand_bullet.forEach(point => {
      markdown += `- ${point}\n`;
    });
    markdown += '\n';
  }

  // Keywords
  if (summary?.keywords && summary.keywords.length > 0) {
    markdown += `## Keywords\n\n`;
    markdown += summary.keywords.join(', ') + '\n\n';
  }

  // Link back to Fireflies
  markdown += `---\n\n`;
  markdown += `[View in Fireflies](${transcript.transcript_url})\n`;

  return markdown;
}

/**
 * Generate metadata JSON file
 */
export function generateMetadataJSON(
  transcript: FirefliesTranscript,
  downloadedFiles: {
    audio?: boolean;
    transcript_docx?: boolean;
    transcript_json?: boolean;
    summary?: boolean;
  }
): string {
  const metadata = {
    meeting_id: transcript.id,
    title: transcript.title,
    date: transcript.date,
    duration_seconds: transcript.duration,
    organizer_email: transcript.organizer_email,
    participants: transcript.participants || [],
    fireflies_users: transcript.fireflies_users || [],
    transcript_url: transcript.transcript_url,
    downloaded_at: new Date().toISOString(),
    files: {
      ...(downloadedFiles.audio && { audio: 'audio.mp3' }),
      ...(downloadedFiles.transcript_docx && { transcript_docx: 'transcript.docx' }),
      ...(downloadedFiles.transcript_json && { transcript_json: 'transcript.json' }),
      ...(downloadedFiles.summary && { summary: 'summary.md' }),
    },
  };

  return JSON.stringify(metadata, null, 2);
}

/**
 * Generate simple text transcript (for DOCX conversion)
 */
export function generateTranscriptText(transcript: FirefliesTranscript): string {
  const date = formatDate(new Date(transcript.date).getTime());
  const duration = formatDurationShort(transcript.duration);

  let text = `${transcript.title}\n`;
  text += `Date: ${date} | Duration: ${duration}\n`;
  text += `Organizer: ${transcript.organizer_email}\n`;
  
  if (transcript.participants && transcript.participants.length > 0) {
    text += `Participants: ${transcript.participants.join(', ')}\n`;
  }
  
  text += '\n' + '='.repeat(80) + '\n\n';

  // Add transcript sentences
  if (transcript.sentences && transcript.sentences.length > 0) {
    let currentSpeaker = '';
    
    transcript.sentences.forEach((sentence: TranscriptSentence) => {
      // Add speaker name if it changed
      if (sentence.speaker_name !== currentSpeaker) {
        currentSpeaker = sentence.speaker_name;
        text += `\n${currentSpeaker}:\n`;
      }
      
      text += `${sentence.text}\n`;
    });
  } else {
    text += 'No transcript available.\n';
  }

  return text;
}

/**
 * Generate DOCX-compatible HTML (simplified approach)
 * For a full DOCX, we'd use a library like docx.js
 * This generates HTML that can be saved as .docx for basic compatibility
 */
export function generateTranscriptHTML(transcript: FirefliesTranscript): string {
  const date = formatDate(new Date(transcript.date).getTime());
  const duration = formatDurationShort(transcript.duration);

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${transcript.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    .metadata { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .metadata p { margin: 5px 0; }
    .speaker { font-weight: bold; color: #2563eb; margin-top: 15px; }
    .sentence { margin-left: 20px; margin-bottom: 5px; }
  </style>
</head>
<body>
  <h1>${transcript.title}</h1>
  
  <div class="metadata">
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Organizer:</strong> ${transcript.organizer_email}</p>
    ${transcript.participants && transcript.participants.length > 0 
      ? `<p><strong>Participants:</strong> ${transcript.participants.join(', ')}</p>` 
      : ''}
  </div>
  
  <h2>Transcript</h2>
`;

  // Add transcript sentences
  if (transcript.sentences && transcript.sentences.length > 0) {
    let currentSpeaker = '';
    
    transcript.sentences.forEach((sentence: TranscriptSentence) => {
      // Add speaker name if it changed
      if (sentence.speaker_name !== currentSpeaker) {
        currentSpeaker = sentence.speaker_name;
        html += `  <p class="speaker">${currentSpeaker}:</p>\n`;
      }
      
      html += `  <p class="sentence">${sentence.text}</p>\n`;
    });
  } else {
    html += '  <p>No transcript available.</p>\n';
  }

  html += `</body>
</html>`;

  return html;
}

/**
 * Generate DOCX file (RTF format that Word can open)
 * Creates a Rich Text Format document with the transcript
 */
export async function generateTranscriptDOCX(transcript: FirefliesTranscript): Promise<Blob> {
  const date = formatDate(new Date(transcript.date).getTime());
  const duration = formatDurationShort(transcript.duration);
  
  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += '{\\fonttbl{\\f0 Times New Roman;}{\\f1 Arial;}}\n';
  rtf += '{\\colortbl;\\red0\\green0\\blue0;\\red80\\green80\\blue80;}\n';
  
  // Title
  rtf += '\\pard\\qc\\f1\\fs32\\b ' + escapeRTF(transcript.title) + '\\b0\\par\n';
  rtf += '\\pard\\qc\\f1\\fs20 ' + date + ' \\bullet ' + duration + '\\par\n';
  rtf += '\\pard\\qc\\f1\\fs18\\cf1 Organizer: ' + escapeRTF(transcript.organizer_email) + '\\par\n';
  
  if (transcript.participants && transcript.participants.length > 0) {
    rtf += '\\pard\\qc\\f1\\fs18\\cf1 Participants: ' + escapeRTF(transcript.participants.slice(0, 5).join(', ')) + '\\par\n';
  }
  
  rtf += '\\pard\\par\\par\n'; // Line breaks
  
  // Transcript
  if (transcript.sentences && transcript.sentences.length > 0) {
    rtf += '\\pard\\f1\\fs26\\b Transcript\\b0\\par\n';
    rtf += '\\pard\\par\n';
    
    let currentSpeaker = '';
    transcript.sentences.forEach((sentence) => {
      if (sentence.speaker_name && sentence.speaker_name !== currentSpeaker) {
        currentSpeaker = sentence.speaker_name;
        rtf += '\\pard\\par\\f1\\fs22\\b\\cf0 ' + escapeRTF(currentSpeaker) + ':\\b0\\par\n';
      }
      rtf += '\\pard\\f0\\fs20 ' + escapeRTF(sentence.text || '') + '\\par\n';
    });
  } else {
    rtf += '\\pard\\f0\\fs20 No transcript available.\\par\n';
  }
  
  rtf += '}';
  
  // Create blob with RTF mime type (Word can open .rtf files)
  const blob = new Blob([rtf], { 
    type: 'application/rtf'
  });
  
  return blob;
}

/**
 * Escape special characters for RTF format
 */
function escapeRTF(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\n/g, '\\par\n')
    .replace(/\r/g, '');
}

/**
 * Download file from URL with progress tracking
 */
export async function downloadFile(
  url: string,
  onProgress?: (progress: { loaded: number; total?: number; percent: number }) => void
): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : undefined;

  if (!response.body) {
    throw new Error('ReadableStream not supported');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    chunks.push(value);
    loaded += value.length;

    if (onProgress) {
      const percent = total ? (loaded / total) * 100 : 0;
      onProgress({ loaded, total, percent });
    }
  }

  // Combine chunks into a single Uint8Array
  const allChunks = new Uint8Array(loaded);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  // Get content type from response
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  return new Blob([allChunks], { type: contentType });
}

/**
 * Calculate estimated file sizes
 */
export function estimateFileSizes(transcript: FirefliesTranscript): {
  audio?: number;
  transcript_json: number;
  transcript_docx: number;
  summary: number;
  total: number;
} {
  const sizes = {
    audio: undefined as number | undefined,
    transcript_json: 0,
    transcript_docx: 0,
    summary: 0,
    total: 0,
  };

  // Estimate audio: ~1MB per minute
  if (transcript.audio_url) {
    const durationMinutes = transcript.duration / 60;
    sizes.audio = Math.ceil(durationMinutes * 1024 * 1024); // 1MB per minute
  }

  // JSON transcript: ~100 bytes per sentence on average
  if (transcript.sentences) {
    sizes.transcript_json = transcript.sentences.length * 100;
  }

  // DOCX: similar to JSON but slightly larger
  sizes.transcript_docx = sizes.transcript_json * 1.2;

  // Summary markdown: ~2-5KB typically
  sizes.summary = 3 * 1024;

  // Total
  sizes.total = (sizes.audio || 0) + sizes.transcript_json + sizes.transcript_docx + sizes.summary;

  return sizes;
}

