'use client';

import { useEffect, useRef, useState } from 'react';
import { FileStatus, LoadStats } from '@/types';

interface LoadModalProps {
  isOpen: boolean;
  onClose: (didChange: boolean) => void;
}

export default function LoadModal({ isOpen, onClose }: LoadModalProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    fileName: string;
    message?: string;
    percent?: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [didChange, setDidChange] = useState(false);
  const didChangeRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setDidChange(false);
    didChangeRef.current = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose(didChangeRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [didChange, isOpen, loading, onClose]);

  useEffect(() => {
    if (!loading) {
      setProgress(null);
      return;
    }

    let isActive = true;

    const parseProgress = (message?: string) => {
      if (!message) return undefined;
      const match = message.match(/Loading\s+(\d+)\s*\/\s*(\d+)/i);
      if (!match) return undefined;
      const current = Number(match[1]);
      const total = Number(match[2]);
      if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return undefined;
      return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
    };

    const fetchProgress = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const statuses = (data.statuses || []) as FileStatus[];
        const loadingStatus = statuses.find((status) => status.status === 'loading');
        if (!loadingStatus) return;

        const percent = parseProgress(loadingStatus.message);

        if (isActive) {
          setProgress({
            fileName: loadingStatus.file_name,
            message: loadingStatus.message,
            percent,
          });
        }
      } catch (error) {
        console.error('Failed to fetch load progress:', error);
      }
    };

    fetchProgress();
    const interval = window.setInterval(fetchProgress, 1000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [loading]);

  if (!isOpen) return null;

  const handleLoad = async (policy: 'missing_only' | 'all') => {
    try {
      setLoading(true);
      setProgress(null);
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
        setDidChange(true);
        didChangeRef.current = true;
        window.dispatchEvent(new CustomEvent('knowledge-db-changed'));
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
      setProgress(null);
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
      setDidChange(true);
      didChangeRef.current = true;
      window.dispatchEvent(new CustomEvent('knowledge-db-changed'));
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

        {loading && progress && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Loading {progress.fileName}
            </p>
            {progress.message && (
              <p className="text-xs text-gray-500 mb-2">{progress.message}</p>
            )}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-600 transition-all"
                style={{ width: `${progress.percent ?? 0}%` }}
              />
            </div>
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
          onClick={() => onClose(didChangeRef.current)}
          disabled={loading}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Close
        </button>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-700 select-none">
            Click here to open the Danger Zone
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
