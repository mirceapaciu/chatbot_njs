'use client';

import { FileStatus } from '@/types';
import { useEffect, useState } from 'react';

interface StatusPanelProps {
  onLoadClick: () => void;
  onExportClick: () => void;
  onHelpClick: () => void;
  refreshToken?: number;
}

export default function StatusPanel({ onLoadClick, onExportClick, onHelpClick, refreshToken }: StatusPanelProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
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
  };

  useEffect(() => {
    fetchStatus();
  }, [refreshToken]);

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

      {loading ? (
        <p className="text-sm text-gray-500">Loading status...</p>
      ) : statuses.length > 0 ? (
        <div className="mb-4">
          <p className="font-semibold mb-2 text-sm">File Status:</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {statuses.map((status, index) => (
              <div key={index} className="text-xs bg-white p-2 rounded border border-gray-200">
                <p className="font-semibold">{status.data_source_id}</p>
                <p className="text-gray-600">{status.file_name}</p>
                <p className="text-gray-500">Type: {status.target}</p>
                <p className={`mt-1 ${
                  status.status === 'loaded' ? 'text-green-600' :
                  status.status === 'failed' ? 'text-red-600' :
                  status.status === 'loading' ? 'text-blue-600' :
                  'text-gray-600'
                }`}>
                  Status: {status.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">No load activity recorded yet.</p>
      )}

      <div className="space-y-2">
        <button
          onClick={onLoadClick}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-semibold"
        >
          Load DB
        </button>
        
        <button
          onClick={onExportClick}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
        >
          📥 Export Chat History
        </button>
        
        <button
          onClick={onHelpClick}
          className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
        >
          ❓ Help & Examples
        </button>
      </div>
    </div>
  );
}
