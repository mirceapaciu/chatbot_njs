// Type definitions for the Financial Insights Chatbot

export interface Citation {
  label: string;
  metadata: Record<string, string>;
  chunk_text: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface FileStatus {
  data_source_id: string;
  file_name: string;
  target: 'vector' | 'sql';
  status: 'loaded' | 'not_loaded' | 'failed' | 'loading';
  message?: string;
  updated_at: string;
}

export interface Document {
  id?: number;
  content: string;
  embedding?: number[];
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  data_source_id: string;
  data_source_name: string;
  file_name: string;
  url: string;
  year: number;
  page_number: number;
  loaded_date: string;
  chunk_text?: string;
}

export interface LoadStats {
  loaded: string[];
  skipped: string[];
  failed: Record<string, string>;
}

export interface DataFileConfig {
  name: string;
  url: string;
  type: 'pdf' | 'table' | 'text';
  year: number;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  url: string;
  files: DataFileConfig[];
}

export interface DataSourcesConfig {
  root_directory: string;
  sources: DataSourceConfig[];
}

export interface AgentConfig {
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  top_k: number;
}

export interface CitationDetails {
  details: Record<string, DocumentMetadata>;
}

export interface AgentAnswer {
  text: string;
  citations: Citation[];
}

export interface CPIData {
  ref_area_code: string;
  ref_area_name: string;
  inflation_pct: number;
}

// OpenAI function calling types
export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}
