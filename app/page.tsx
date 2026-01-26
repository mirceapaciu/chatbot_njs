'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble from '@/components/MessageBubble';
import StatusPanel from '@/components/StatusPanel';
import { Message } from '@/types';
import { GREETING } from '@/lib/config';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: GREETING,
      citations: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [statusRefreshToken, setStatusRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge'>('chat');
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [dbLoadRunning, setDbLoadRunning] = useState(false);
  const [dbIsLoaded, setDbIsLoaded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!showHelpModal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowHelpModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelpModal]);


  const handleSend = async () => {
    if (!dbIsLoaded) return;
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.text,
        citations: data.citations || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        citations: [],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExport = () => {
    const chatData = JSON.stringify(messages, null, 2);
    const blob = new Blob([chatData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerStatusRefresh = () => {
    setStatusRefreshToken((prev) => prev + 1);
  };

  const handleLoad = async (policy: 'missing_only' | 'all') => {
    try {
      setKnowledgeLoading(true);
      triggerStatusRefresh();

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
    } catch (error) {
      console.error('Load error:', error);
      window.alert(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setKnowledgeLoading(false);
      triggerStatusRefresh();
    }
  };

  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete the knowledge DB? This will remove all loaded documents from the knowledge DBand reset statuses.'
    );

    if (!confirmed) return;

    try {
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

      triggerStatusRefresh();
    } catch (error) {
      console.error('Delete error:', error);
      window.alert(error instanceof Error ? error.message : 'Failed to delete all files');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">🤖 Financial Insights Chatbot</h1>
        <p className="text-sm text-blue-100 mt-1">
          Ask questions about the global economic outlook
        </p>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'knowledge'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Knowledge DB
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex h-full">
            {/* Side Panel */}
            <div className="w-80 flex-shrink-0">
              <StatusPanel
                onLoadClick={() => setActiveTab('knowledge')}
                refreshToken={statusRefreshToken}
                showLoadButton={false}
                showFileTable={false}
                onDbLoadRunningChange={setDbLoadRunning}
                onDbLoadedChange={setDbIsLoaded}
              />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
              <div className="border-b border-gray-200 bg-white px-4 py-2">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Conversation</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHelpModal(true)}
                      className="inline-flex items-center gap-2 bg-gray-200 text-gray-800 px-3 py-1.5 rounded hover:bg-gray-300 transition-colors text-sm"
                    >
                      ❓ Help
                    </button>
                    <button
                      onClick={handleExport}
                      className="inline-flex items-center gap-2 bg-gray-200 text-gray-800 px-3 py-1.5 rounded hover:bg-gray-300 transition-colors text-sm"
                    >
                      📥 Export Chat
                    </button>
                  </div>
                </div>
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={index}
                      role={message.role}
                      content={message.content}
                      citations={message.citations}
                    />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start mb-4">
                      <div className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-200">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4 bg-white">
                <div className="max-w-4xl mx-auto flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about the world economic situation..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    disabled={isLoading || !dbIsLoaded}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !dbIsLoaded || !input.trim()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <StatusPanel
                onLoadClick={() => setActiveTab('knowledge')}
                onLoadNew={() => handleLoad('missing_only')}
                onReloadAll={() => handleLoad('all')}
                onDeleteAll={handleDeleteAll}
                refreshToken={statusRefreshToken}
                showLoadButton={false}
                showFileTable
                showKnowledgeActions
                forcePolling={knowledgeLoading || dbLoadRunning}
                disableKnowledgeActions={knowledgeLoading || dbLoadRunning}
                onDbLoadRunningChange={setDbLoadRunning}
                onDbLoadedChange={setDbIsLoaded}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">Help & Examples</h2>
            
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-lg mb-2">About This Chatbot</h3>
                <p className="text-gray-700">
                  This chatbot answers questions about the global economic outlook using data from
                  trusted institutions like the IMF and OECD. All answers are based solely on the
                  documents loaded into the knowledge database.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Features</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Ask questions about economic trends and forecasts</li>
                  <li>Get real-time GDP growth, exchange rates, and CPI data</li>
                  <li>View inline citations with sources</li>
                  <li>Click citations to see the original document excerpts</li>
                  <li>Export chat history for later reference</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Example Questions</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>&quot;What is the GDP growth forecast for the USA in 2025?&quot;</li>
                  <li>&quot;What are the main economic risks mentioned in recent reports?&quot;</li>
                  <li>&quot;How does inflation in Germany compare to other European countries?&quot;</li>
                  <li>&quot;What is the current exchange rate between USD and EUR?&quot;</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Getting Started</h3>
                <ol className="list-decimal list-inside text-gray-700 space-y-1">
                  <li>Make sure the knowledge database is loaded (green indicator in sidebar)</li>
                  <li>If not loaded, click &quot;Load DB&quot; to import documents</li>
                  <li>Start asking questions in the chat input</li>
                  <li>Click on citations to view source details</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
