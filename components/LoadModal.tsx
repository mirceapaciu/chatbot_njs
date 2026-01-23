'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

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

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete the knowledge DB? This will remove all loaded documents and reset statuses.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setFeedback(null);

      const response = await fetch('/api/reset', {
        method: 'POST',
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorMessage = isJson && data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: string }).error || 'Failed to delete all files')
          : typeof data === 'string' && data.trim().length > 0
            ? data
            : 'Failed to delete all files';
        throw new Error(errorMessage);
      }

      setFeedback({
        type: 'success',
        message: 'All loaded files were deleted and statuses were reset.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete all files',
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

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-700 select-none">
            Danger Zone
          </summary>
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800 mb-3">
              Deleting the knowledge DB removes all loaded documents and resets statuses.
            </p>
            <button
              onClick={handleDeleteAll}
              disabled={loading}
              className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete Knowledge DB
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
