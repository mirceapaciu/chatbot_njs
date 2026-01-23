'use client';

import { Citation } from '@/types';
import { useState } from 'react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export default function MessageBubble({ role, content, citations }: MessageBubbleProps) {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const isUser = role === 'user';

  // Replace citation links with clickable elements
  const renderContentWithCitations = () => {
    if (!citations || citations.length === 0) {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    let renderedContent = content;
    citations.forEach((citation) => {
      const citationLabel = citation.label;
      renderedContent = renderedContent.replace(
        citationLabel,
        `<span class="citation-link" data-citation="${citationLabel}">${citationLabel}</span>`
      );
    });

    return (
      <div
        className="whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('citation-link')) {
            const citationLabel = target.getAttribute('data-citation');
            const citation = citations.find((c) => c.label === citationLabel);
            if (citation) {
              setSelectedCitation(citation);
            }
          }
        }}
      />
    );
  };

  return (
    <>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div
          className={`max-w-[80%] rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900 border border-gray-200'
          }`}
        >
          <div className="text-sm font-semibold mb-1">
            {isUser ? 'You' : 'Assistant'}
          </div>
          {renderContentWithCitations()}
        </div>
      </div>

      {/* Citation Modal */}
      {selectedCitation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCitation(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Citation Details</h3>
            
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600">Source:</p>
              <p className="text-sm">{selectedCitation.metadata.data_source_name}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600">File:</p>
              <p className="text-sm">{selectedCitation.metadata.file_name}</p>
            </div>

            {selectedCitation.metadata.url && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-600">URL:</p>
                <a
                  href={selectedCitation.metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {selectedCitation.metadata.url}
                </a>
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-600">Excerpt:</p>
              <div className="text-sm bg-gray-50 p-3 rounded border border-gray-200 mt-2 whitespace-pre-wrap">
                {selectedCitation.chunk_text}
              </div>
            </div>

            <button
              onClick={() => setSelectedCitation(null)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.citation-link) {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        :global(.citation-link:hover) {
          color: #1d4ed8;
        }
      `}</style>
    </>
  );
}
