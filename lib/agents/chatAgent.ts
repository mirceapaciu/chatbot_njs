import OpenAI from 'openai';
import { VectorStoreService } from '../services/vectorStoreService';
import { SQLStoreService } from '../services/sqlStoreService';
import { embeddingService } from '../services/embeddingService';
import { tools, getRealGDPGrowth, getExchangeRate, getCPI } from '../tools';
import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE, CITATION_PATTERN, AGENT_CONFIG } from '../config';
import { Citation, AgentAnswer, Document, CitationDetails, DocumentMetadata } from '@/types';

export class ChatAgent {
  private openai: OpenAI;
  private vectorStore: VectorStoreService;
  private sqlStore: SQLStoreService;
  private config: typeof AGENT_CONFIG;

  constructor(
    vectorStore: VectorStoreService,
    sqlStore: SQLStoreService,
    openaiApiKey: string
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.vectorStore = vectorStore;
    this.sqlStore = sqlStore;
    this.config = AGENT_CONFIG;
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<AgentAnswer> {
    // Get relevant documents from vector store
    const queryEmbedding = await embeddingService.embedText(userMessage);
    const documents = await this.vectorStore.similaritySearch(
      queryEmbedding,
      this.config.top_k
    );

    // Build prompt with context
    const { prompt, citationDetails } = this.buildPrompt(userMessage, documents);

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user', content: prompt },
    ];

    // Call OpenAI with function calling
    let response = await this.openai.chat.completions.create({
      model: this.config.llm_model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: this.config.llm_temperature,
      max_tokens: this.config.llm_max_tokens,
    });

    let assistantMessage = response.choices[0].message;

    // Handle function calls
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to conversation
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        let functionResult: string;

        switch (functionName) {
          case 'get_real_gdp_growth':
            functionResult = await getRealGDPGrowth(
              functionArgs.country_code,
              functionArgs.period
            );
            break;
          case 'get_exchange_rate':
            functionResult = await getExchangeRate(
              functionArgs.from_currency,
              functionArgs.to_currency,
              functionArgs.date
            );
            break;
          case 'get_cpi':
            functionResult = await getCPI(
              functionArgs.country_code,
              functionArgs.year,
              functionArgs.month,
              this.sqlStore
            );
            break;
          default:
            functionResult = 'Unknown function';
        }

        // Add function result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: functionResult,
        });
      }

      // Get next response from OpenAI
      response = await this.openai.chat.completions.create({
        model: this.config.llm_model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: this.config.llm_temperature,
        max_tokens: this.config.llm_max_tokens,
      });

      assistantMessage = response.choices[0].message;
    }

    const answerText = assistantMessage.content || 'No response generated';
    const citations = this.extractCitations(answerText, citationDetails);

    return {
      text: answerText,
      citations,
    };
  }

  /**
   * Build a prompt with retrieved documents
   */
  private buildPrompt(
    question: string,
    documents: Document[]
  ): { prompt: string; citationDetails: CitationDetails } {
    if (documents.length === 0) {
      return {
        prompt: `Question: ${question}`,
        citationDetails: { details: {} },
      };
    }

    const contextBlocks: string[] = [];
    const citationDetails: CitationDetails = { details: {} };

    documents.forEach((doc, index) => {
      const metadata = doc.metadata as DocumentMetadata;
      
      // Generate expected citation format
      const fileName = metadata.file_name || 'Unknown';
      const pageNumber = metadata.page_number || 0;
      const expectedCitation = `[${fileName}, p.${pageNumber}]`;

      // Store metadata with chunk text
      const metadataWithChunk = {
        ...metadata,
        chunk_text: doc.content,
      };
      citationDetails.details[expectedCitation] = metadataWithChunk;

      const block = `Source ${index + 1}:
Title: ${metadata.data_source_name || metadata.data_source_id || 'Unknown'}
URL: ${metadata.url || 'N/A'}
Expected_citation: ${expectedCitation}
Excerpt: ${doc.content.trim()}`;

      contextBlocks.push(block);
    });

    const context = contextBlocks.join('\n\n---\n');
    const prompt = USER_PROMPT_TEMPLATE
      .replace('{context}', context)
      .replace('{question}', question);

    return { prompt, citationDetails };
  }

  /**
   * Extract citations from the answer text
   */
  private extractCitations(
    answer: string,
    citationDetails: CitationDetails
  ): Citation[] {
    const citations: Citation[] = [];
    const seen = new Set<string>();

    // Use regex to find all citations
    const matches = answer.matchAll(CITATION_PATTERN);
    
    for (const match of matches) {
      const fullMatch = match[0]; // e.g., "[filename.pdf, p.123]"
      
      if (seen.has(fullMatch)) {
        continue;
      }
      seen.add(fullMatch);

      const metadata = citationDetails.details[fullMatch];
      if (metadata) {
        const { chunk_text, ...metadataFields } = metadata as DocumentMetadata & {
          chunk_text?: string;
        };
        const metadataAsStrings = Object.fromEntries(
          Object.entries(metadataFields).map(([key, value]) => [key, String(value)])
        );
        citations.push({
          label: fullMatch,
          metadata: metadataAsStrings,
          chunk_text: chunk_text || '',
        });
      }
    }

    return citations;
  }
}
