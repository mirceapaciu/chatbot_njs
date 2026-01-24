import { NextRequest, NextResponse } from 'next/server';
import { ChatAgent } from '@/lib/agents/chatAgent';
import { VectorStoreService } from '@/lib/services/vectorStoreService';
import { SQLStoreService } from '@/lib/services/sqlStoreService';
import { validateUserInput, sanitizeInput } from '@/lib/validation';
import { Message } from '@/types';
import { checkRateLimit } from '@/lib/services/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitEnv = Number(process.env.RATE_LIMIT_PER_MINUTE ?? '10');
    const rateLimitPerMinute = Number.isFinite(rateLimitEnv) && rateLimitEnv > 0 ? rateLimitEnv : 10;
    const rateLimitWindowMs = 60_000;
    const rateLimit = checkRateLimit('global', rateLimitPerMinute, rateLimitWindowMs);

    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimitPerMinute),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        }
      );
    }

    const body = await request.json();
    const { message, conversationHistory } = body as {
      message: string;
      conversationHistory: Message[];
    };

    // Validate input
    const sanitized = sanitizeInput(message);
    const validation = validateUserInput(sanitized);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Initialize services
    const vectorStore = new VectorStoreService();
    const sqlStore = new SQLStoreService();
    const agent = new ChatAgent(vectorStore, sqlStore, process.env.OPENAI_API_KEY);

    // Check if vector store is empty
    const isEmpty = await vectorStore.isEmpty();
    if (isEmpty) {
      return NextResponse.json({
        text: 'The knowledge database is empty. Please load documents first using the "Load DB" button in the sidebar.',
        citations: [],
      });
    }

    // Convert conversation history to the format expected by the agent
    const history = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Process the message
    const answer = await agent.processMessage(sanitized, history);

    return NextResponse.json(answer);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
