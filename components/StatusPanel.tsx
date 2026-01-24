'use client';

import { FileStatus } from '@/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface StatusPanelProps {
  onLoadClick: () => void;
  onExportClick: () => void;
  onHelpClick: () => void;
  onLoadNew?: () => void;
  onReloadAll?: () => void;
  onDeleteAll?: () => void;
  refreshToken?: number;
  showLoadButton?: boolean;
  showFileTable?: boolean;
  showExportButton?: boolean;
  showHelpButton?: boolean;
  showKnowledgeActions?: boolean;
  forcePolling?: boolean;
  disableKnowledgeActions?: boolean;
}

const StatusRow = memo(function StatusRow({
  status,
  progress,
}: {
  status: FileStatus;
  progress?: number;
}) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 font-semibold text-gray-800">{status.data_source_id}</td>
      <td className="px-3 py-2 text-gray-700">{status.file_name}</td>
      <td className="px-3 py-2 text-gray-600">{status.target}</td>
      <td className={`px-3 py-2 font-semibold ${
        status.status === 'loaded' ? 'text-green-600' :
        status.status === 'failed' ? 'text-red-600' :
        status.status === 'loading' ? 'text-blue-600' :
        'text-gray-600'
      }`}>
        {status.status}
      </td>
      <td className="px-3 py-2 text-gray-500">
        {typeof progress === 'number' ? `${progress}%` : '-'}
      </td>
      <td className="px-3 py-2 text-gray-500">
        {new Date(status.updated_at).toLocaleString()}
      </td>
    </tr>
  );
}, (prev, next) => prev.status === next.status && prev.progress === next.progress);

export default function StatusPanel({
  onLoadClick,
  onExportClick,
  onHelpClick,
  onLoadNew,
  onReloadAll,
  onDeleteAll,
  refreshToken,
  showLoadButton = true,
  showFileTable = true,
  showExportButton = true,
  showHelpButton = true,
  showKnowledgeActions = false,
  forcePolling = false,
  disableKnowledgeActions = false,
}: StatusPanelProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFetchDoneRef = useRef(false);
  const lastRefreshTokenRef = useRef<number | undefined>(undefined);

  const parseProgress = useCallback((message?: string) => {
    if (!message) return undefined;
    const match = message.match(/Loading\s+(\d+)\s*\/\s*(\d+)/i);
    if (!match) return undefined;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return undefined;
    return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
  }, []);

  const getStatusKey = useCallback((status: FileStatus) => {
    return `${status.data_source_id}::${status.file_name}::${status.target}`;
  }, []);

  const areStatusesEqual = useCallback((a: FileStatus, b: FileStatus) => {
    if (
      a.data_source_id !== b.data_source_id ||
      a.file_name !== b.file_name ||
      a.target !== b.target ||
      a.status !== b.status ||
      a.message !== b.message
    ) {
      return false;
    }

    if (a.status === 'loading') {
      return true;
    }

    return a.updated_at === b.updated_at;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      // Fetch vector store status
      const vectorResponse = await fetch('/api/vector-status', { cache: 'no-store' });
      const vectorData = await vectorResponse.json();
      setIsLoaded(vectorData.isLoaded);

      // Fetch file statuses
      const statusResponse = await fetch('/api/status', { cache: 'no-store' });
      const statusData = await statusResponse.json();
      const nextStatuses = (statusData.statuses || []) as FileStatus[];
      setStatuses((prev) => {
        if (prev.length === 0) return nextStatuses;
        const prevMap = new Map(prev.map((status) => [getStatusKey(status), status]));
        let changed = prev.length !== nextStatuses.length;
        const merged = nextStatuses.map((status) => {
          const key = getStatusKey(status);
          const previous = prevMap.get(key);
          if (previous && areStatusesEqual(previous, status)) {
            return previous;
          }
          changed = true;
          return status;
        });
        return changed ? merged : prev;
      });
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, [areStatusesEqual, getStatusKey]);

  useEffect(() => {
    const tokenValue = refreshToken ?? 0;

    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      lastRefreshTokenRef.current = tokenValue;
      setLoading(true);
      void (async () => {
        try {
          await fetchStatus();
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    if (lastRefreshTokenRef.current === tokenValue) {
      return;
    }

    lastRefreshTokenRef.current = tokenValue;
    fetchStatus();
  }, [fetchStatus, refreshToken]);

  const hasLoading = useMemo(
    () => showFileTable && statuses.some((status) => status.status === 'loading'),
    [showFileTable, statuses]
  );

  useEffect(() => {
    if (!hasLoading && !forcePolling) return;

    const interval = window.setInterval(fetchStatus, 1000);
    return () => window.clearInterval(interval);
  }, [fetchStatus, forcePolling, hasLoading]);

  useEffect(() => {
    const handleDbChange = () => {
      fetchStatus();
    };

    window.addEventListener('knowledge-db-changed', handleDbChange);
    return () => window.removeEventListener('knowledge-db-changed', handleDbChange);
  }, [fetchStatus]);

  return (
    <div className="w-full h-full bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">      
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${isLoaded ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm">{isLoaded ? 'DB is loaded' : 'DB is empty'}</span>
        </div>
      </div>

      {!isLoaded && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          ⚠️ The knowledge DB is empty. Load documents to enable the chat interface.
        </div>
      )}

      {showKnowledgeActions && (
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={onLoadNew}
              disabled={disableKnowledgeActions}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load Registered Files
            </button>
            <button
              onClick={onReloadAll}
              disabled={disableKnowledgeActions}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reload All Files
            </button>
          </div>
        </div>
      )}

      {showFileTable && (
        loading ? (
          <p className="text-sm text-gray-500">Loading status...</p>
        ) : statuses.length > 0 ? (
          <div className="mb-4">
            <p className="font-semibold mb-2 text-sm">Registered Files:</p>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Source</th>
                    <th className="text-left px-3 py-2 font-semibold">File</th>
                    <th className="text-left px-3 py-2 font-semibold">Target</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 font-semibold">Progress</th>
                    <th className="text-left px-3 py-2 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((status) => (
                    <StatusRow
                      key={getStatusKey(status)}
                      status={status}
                      progress={status.status === 'loading' ? parseProgress(status.message) : undefined}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No load activity recorded yet.</p>
        )
      )}

      <div className="space-y-2">
        {showLoadButton && (
          <button
            onClick={onLoadClick}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-semibold"
          >
            Load DB
          </button>
        )}

        {showExportButton && (
          <button
            onClick={onExportClick}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
          >
            📥 Export Chat History
          </button>
        )}

        {showHelpButton && (
          <button
            onClick={onHelpClick}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
          >
            ❓ Help & Examples
          </button>
        )}

        {showKnowledgeActions && (
          <details className="mt-4 rounded border border-red-200 bg-red-50">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-red-700">
              Danger Zone
            </summary>
            <div className="border-t border-red-200 px-3 py-3">
              <p className="mb-2 text-xs text-red-700">
                This action permanently deletes all files from the knowledge database.
              </p>
              <button
                onClick={onDeleteAll}
                disabled={disableKnowledgeActions}
                className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Knowledge DB
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
