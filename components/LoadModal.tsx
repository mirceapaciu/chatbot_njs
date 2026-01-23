'use client';

import { useState } from 'react';
import { LoadStats } from '@/types';

interface LoadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoadModal({ isOpen, onClose }: LoadModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleLoad = async (policy: 'missing_only' | 'all') => {
    try {
      setLoading(true);
      setFeedback(null);

      const response = await fetch('/api/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMessage = isJson && data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: string }).error || 'Failed to load data')
          : typeof data === 'string' && data.trim().length > 0
            ? data
            : 'Failed to load data';
        throw new Error(errorMessage);
      }

      const stats: LoadStats = (data as { stats: LoadStats }).stats;

      if (Object.keys(stats.failed).length > 0) {
        const failures = Object.entries(stats.failed)
          .map(([file, error]) => `${file}: ${error}`)
          .join('\n');
        setFeedback({
          type: 'error',
          message: `Some files failed to load:\n${failures}`,
        });
      } else if (stats.loaded.length > 0) {
        setFeedback({
          type: 'success',
          message: `Successfully loaded ${stats.loaded.length} file(s)`,
        });
      } else {
        setFeedback({
          type: 'warning',
          message: 'No files were loaded. All files may already be loaded.',
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Manage Knowledge Database</h2>
        
        <p className="text-gray-600 mb-6">
          Reload source documents into the vector database. This may take a few minutes depending on file sizes.
        </p>

        {feedback && (
          <div className={`p-3 rounded mb-4 text-sm ${
            feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}>
            <pre className="whitespace-pre-wrap">{feedback.message}</pre>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleLoad('missing_only')}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load New Files'}
          </button>
          
          <button
            onClick={() => handleLoad('all')}
            disabled={loading}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Reload All Files'}
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Close
        </button>
      </div>
    </div>
  );
}
