// Configuration constants for the application

export const AGENT_CONFIG = {
  llm_model: 'gpt-4o-mini',
  llm_temperature: 0.3,
  llm_max_tokens: 1000,
  top_k: 5, // Number of documents to retrieve for RAG
};

export const GREETING = 
  'Hello, ask me any question and I will answer it based solely on the information in my knowledge base.';

export const SYSTEM_PROMPT = `You are a financial analyst assistant specialized in global economic outlook.

Rules:
1. Use the provided document context for general questions and cite sources inline using the exact expected citation format (e.g., [filename.pdf, p.123]).
2. When the user asks for specific data points about GDP growth, exchange rates, or inflation, use the available tools (get_real_gdp_growth, get_exchange_rate, get_cpi).
3. Tool outputs are authoritative for those data points and do NOT require document citations.
4. Do not use external knowledge or speculation beyond the document context or tool outputs.
5. If neither the context nor tools can answer the question, respond with: "The answer could not be found".
6. Be concise and professional in your responses.`;

export const USER_PROMPT_TEMPLATE = `Context from knowledge base:

{context}

Question: {question}

Instructions:
- Use the context to answer general questions and include inline citations in the EXACT format specified as "Expected_citation" for each source.
- If the question is about GDP growth, exchange rates, or CPI inflation, call the appropriate tool.
- If there isn't enough information in context and no tool applies, respond with: "The answer could not be found".
- Be concise and factual.`;

export const CITATION_PATTERN = /\[([^,\]]+),\s*p\.(\d+)\]/g;

export const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSION = 384;

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;