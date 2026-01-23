'use client';

import { FileStatus } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface StatusPanelProps {
  onLoadClick: () => void;
  onExportClick: () => void;
  onHelpClick: () => void;
  refreshToken?: number;
  showLoadButton?: boolean;
  showFileTable?: boolean;
  showExportButton?: boolean;
  showHelpButton?: boolean;
}

export default function StatusPanel({
  onLoadClick,
  onExportClick,
  onHelpClick,
  refreshToken,
  showLoadButton = true,
  showFileTable = true,
  showExportButton = true,
  showHelpButton = true,
}: StatusPanelProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const initialFetchDoneRef = useRef(false);
  const lastRefreshTokenRef = useRef<number | undefined>(undefined);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch vector store status
      const vectorResponse = await fetch('/api/vector-status', { cache: 'no-store' });
      const vectorData = await vectorResponse.json();
      setIsLoaded(vectorData.isLoaded);

      // Fetch file statuses
      const statusResponse = await fetch('/api/status', { cache: 'no-store' });
      const statusData = await statusResponse.json();
      setStatuses(statusData.statuses || []);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tokenValue = refreshToken ?? 0;

    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      lastRefreshTokenRef.current = tokenValue;
      fetchStatus();
      return;
    }

    if (lastRefreshTokenRef.current === tokenValue) {
      return;
    }

    lastRefreshTokenRef.current = tokenValue;
    fetchStatus();
  }, [fetchStatus, refreshToken]);

  useEffect(() => {
    const handleDbChange = () => {
      fetchStatus();
    };

    window.addEventListener('knowledge-db-changed', handleDbChange);
    return () => window.removeEventListener('knowledge-db-changed', handleDbChange);
  }, [fetchStatus]);

  return (
    <div className="w-full h-full bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Knowledge Base</h2>
      
      <div className="mb-4">
        <p className="font-semibold mb-2">Status:</p>
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

      {showFileTable && (
        loading ? (
          <p className="text-sm text-gray-500">Loading status...</p>
        ) : statuses.length > 0 ? (
          <div className="mb-4">
            <p className="font-semibold mb-2 text-sm">Loaded Files:</p>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Source</th>
                    <th className="text-left px-3 py-2 font-semibold">File</th>
                    <th className="text-left px-3 py-2 font-semibold">Target</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((status, index) => (
                    <tr key={index} className="border-t border-gray-100">
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
                        {new Date(status.updated_at).toLocaleString()}
                      </td>
                    </tr>
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
      </div>
    </div>
  );
}
