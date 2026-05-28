import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { ConversationGraph } from './graph/conversation-graph';

@Injectable()
export class AgentService {
  private checkpointer: MemorySaver;
  private conversationGraph: ConversationGraph;

  constructor(private configService: ConfigService) {
    this.checkpointer = new MemorySaver();
    const deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.conversationGraph = new ConversationGraph(deepseekApiKey);
  }

  async *streamResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<string, void, unknown> {
    const compiledGraph = this.conversationGraph.compile();

    const input = {
      messages: [new HumanMessage(userMessage)],
      conversationId,
      systemPrompt,
    };

    const config = {
      configurable: { thread_id: conversationId },
      checkpointer: this.checkpointer,
    };

    const stream = await compiledGraph.stream(input, config);

    for await (const chunk of stream) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedChunk = chunk as any;
      if (typedChunk.call_model?.messages) {
        const messages = typedChunk.call_model.messages;
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
