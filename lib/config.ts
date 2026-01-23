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
1. Answer ONLY based on the provided context from retrieved documents.
2. Do not use any external knowledge or speculation.
3. If the context does not contain enough information to answer the question, respond with: "The answer could not be found"
4. Always cite your sources inline using the exact expected citation format provided for each source (e.g., [filename.pdf, p.123])
5. Be concise and professional in your responses.
6. Do not speculate or generate information not grounded in retrieved context.
7. Use the available tools (get_real_gdp_growth, get_exchange_rate, get_cpi) when the user asks for specific data points about GDP growth, exchange rates, or inflation.`;

export const USER_PROMPT_TEMPLATE = `Context from knowledge base:

{context}

Question: {question}

Instructions:
- Answer the question using ONLY the information from the context above
- Include inline citations in the EXACT format specified as "Expected_citation" for each source
- If the context doesn't contain enough information, respond with: "The answer could not be found"
- Be concise and factual`;

export const CITATION_PATTERN = /\[([^,\]]+),\s*p\.(\d+)\]/g;

export const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSION = 384;
