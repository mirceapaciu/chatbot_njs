-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for file load status tracking
CREATE TABLE IF NOT EXISTS file_load_status (
    data_source_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    url TEXT,
    target TEXT NOT NULL, -- 'vector' or 'sql'
    status TEXT NOT NULL, -- 'loaded', 'not_loaded', or 'failed'
    message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (data_source_id, file_name, target)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_file_load_status_lookup 
ON file_load_status(data_source_id, file_name, target);

-- Create table for document embeddings (vector store)
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(384), -- all-MiniLM-L6-v2 produces 384-dimensional embeddings
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding 
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_documents_metadata 
ON documents USING GIN (metadata);

-- Create table for CPI monthly data
CREATE TABLE IF NOT EXISTS cpi_monthly (
    id BIGSERIAL PRIMARY KEY,
    ref_area_code TEXT NOT NULL,
    ref_area_name TEXT NOT NULL,
    time_period DATE NOT NULL,
    inflation_pct DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ref_area_code, time_period)
);

-- Create index for faster CPI queries
CREATE INDEX IF NOT EXISTS idx_cpi_monthly_lookup 
ON cpi_monthly(ref_area_code, time_period);

CREATE INDEX IF NOT EXISTS idx_cpi_monthly_date 
ON cpi_monthly(time_period);

-- Function to search for similar documents
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(384),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.embedding IS NOT NULL
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
