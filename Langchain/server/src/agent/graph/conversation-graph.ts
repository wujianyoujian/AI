import { StateGraph, Annotation, messagesStateReducer, CompiledStateGraph } from '@langchain/langgraph';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import { ChatDeepSeek } from '@langchain/deepseek';
import { SystemMessage, AIMessageChunk, HumanMessage, BaseMessage } from '@langchain/core/messages';

const ConversationAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  conversationId: Annotation<string>({
    reducer: (left: string, right: string) => right || left,
    default: () => '',
  }),
  systemPrompt: Annotation<string | undefined>({
    reducer: (left: string | undefined, right: string | undefined) => right ?? left,
    default: () => undefined,
  }),
});

type ConversationStateType = typeof ConversationAnnotation.State;

export class ConversationGraph {
  private llm: ChatDeepSeek;

  constructor(apiKey: string) {
    this.llm = new ChatDeepSeek({
      apiKey,
      model: 'deepseek-v4-flash',
      temperature: 0,
      streaming: true,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compile(): CompiledStateGraph<any, any, any> {
    const graph = new StateGraph(ConversationAnnotation)
      .addNode('prepare_context', this.prepareContext.bind(this))
      .addNode('call_model', this.callModel.bind(this))
      .addEdge('__start__', 'prepare_context')
      .addEdge('prepare_context', 'call_model')
      .addEdge('call_model', '__end__');

    return graph.compile() as CompiledStateGraph<any, any, any>;
  }

  private async prepareContext(state: ConversationStateType): Promise<Partial<ConversationStateType>> {
    if (state.systemPrompt) {
      return { messages: [new SystemMessage(state.systemPrompt)] };
    }
    return {};
  }

  private async callModel(
    state: ConversationStateType,
    config: LangGraphRunnableConfig,
  ): Promise<Partial<ConversationStateType>> {
    const writer = config?.writer;
    const chunks: AIMessageChunk[] = [];

    for await (const chunk of await this.llm.stream(state.messages)) {
      chunks.push(chunk);
      if (writer && chunk.content) writer(chunk);
    }

    const merged = chunks.reduce((acc, c) => acc.concat(c));
    return { messages: [merged] };
  }

  async summarizeConversation(
    messages: { role: 'user' | 'assistant'; content: string }[],
    existingSummary?: string | null,
  ): Promise<string> {
    const formatted = messages
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
      .join('\n\n');

    const summaryPart = existingSummary
      ? `以下是之前的对话摘要：\n${existingSummary}\n\n请将以下新内容整合进去，生成新的完整摘要。`
      : '请用中文简要总结以下对话，保留关键信息（用户需求、重要事实、决定、上下文）。';

    const prompt = `${summaryPart}\n\n对话内容：\n${formatted}\n\n请用 2-3 段总结，保留所有重要细节。`;

    const response = await this.llm.invoke([new HumanMessage(prompt)]);
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }
}
