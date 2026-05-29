import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, AIMessageChunk, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { ConversationGraph } from './graph/conversation-graph';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BufferResult {
  summary: string | null;
  recentHistory: HistoryMessage[];
  summaryUpdated: boolean;
}

// Keep the last ~8000 tokens as raw messages, summarize overflow
const MAX_BUFFER_TOKENS = 8000;

function estimateTokens(text: string): number {
  // Rough: ~2 chars per token for mixed Chinese/English
  return Math.ceil(text.length / 2);
}

@Injectable()
export class AgentService {
  private checkpointer: MemorySaver;
  private conversationGraph: ConversationGraph;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compiledGraph: any;

  constructor(private configService: ConfigService) {
    this.checkpointer = new MemorySaver();
    const deepseekApiKey = this.configService.getOrThrow<string>('DEEPSEEK_API_KEY');
    this.conversationGraph = new ConversationGraph(deepseekApiKey);
    this.compiledGraph = this.conversationGraph.compile(this.checkpointer);
  }

  /**
   * Manage the conversation buffer: keep recent messages within token limit,
   * summarize older messages that fall out of the window.
   */
  async prepareBuffer(
    history: HistoryMessage[],
    existingSummary: string | null,
  ): Promise<BufferResult> {
    const totalTokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0);

    if (totalTokens <= MAX_BUFFER_TOKENS) {
      return { summary: existingSummary, recentHistory: history, summaryUpdated: false };
    }

    // Walk from the end to find which messages fit in the window
    let kept = 0;
    let cutoffIndex = history.length;
    for (let i = history.length - 1; i >= 0; i--) {
      const tokens = estimateTokens(history[i].content);
      if (kept + tokens > MAX_BUFFER_TOKENS) {
        cutoffIndex = i + 1;
        break;
      }
      kept += tokens;
    }

    const oldMessages = history.slice(0, cutoffIndex);
    const recentHistory = history.slice(cutoffIndex);

    const newSummary = await this.conversationGraph.summarizeConversation(
      oldMessages,
      existingSummary,
    );

    return { summary: newSummary, recentHistory, summaryUpdated: true };
  }

  async *streamResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
    history: HistoryMessage[] = [],
  ): AsyncGenerator<string, void, unknown> {
    const messages: BaseMessage[] = [];

    if (systemPrompt) {
      messages.push(new SystemMessage(systemPrompt));
    }

    for (const m of history) {
      messages.push(
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
      );
    }

    messages.push(new HumanMessage(userMessage));

    const input = { messages, conversationId };
    const config = {
      configurable: { thread_id: conversationId },
      streamMode: 'messages' as const,
    };

    const stream = await this.compiledGraph.stream(input, config);

    for await (const [chunk] of stream as AsyncIterable<[AIMessageChunk, Record<string, unknown>]>) {
      if (chunk instanceof AIMessageChunk && chunk.content) {
        const token = typeof chunk.content === 'string'
          ? chunk.content
          : JSON.stringify(chunk.content);
        if (token) yield token;
      }
    }
  }
}
