import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ConversationGraph } from './graph/conversation-graph';

interface GraphStreamChunk {
  call_model?: { messages?: BaseMessage[] };
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

  async *streamResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<string, void, unknown> {
    const input = {
      messages: [new HumanMessage(userMessage)],
      conversationId,
      systemPrompt,
    };

    const config = {
      configurable: { thread_id: conversationId },
    };

    const stream = await this.compiledGraph.stream(input, config);

    for await (const chunk of stream as AsyncIterable<GraphStreamChunk>) {
      if (chunk.call_model?.messages) {
        const messages = chunk.call_model.messages;
        const lastMessage = Array.isArray(messages) ? messages[messages.length - 1] : messages;
        if (lastMessage?.content) {
          const content = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
          yield content;
        }
      }
    }
  }
}
