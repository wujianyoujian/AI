import { StateGraph, Annotation, messagesStateReducer, CompiledStateGraph, START, END } from '@langchain/langgraph';
import { performance } from 'perf_hooks';
import { ChatDeepSeek } from '@langchain/deepseek';
import { SystemMessage, AIMessageChunk, HumanMessage, BaseMessage } from '@langchain/core/messages';
// import { JsonOutputParser } from '@langchain/core/output_parsers'
// import { MessagesPlaceholder  } from '@langchain/core/prompts'


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

      .addEdge(START, 'prepare_context')
      .addEdge('prepare_context', 'call_model')
      .addEdge('call_model', END);

    return graph.compile() as CompiledStateGraph<any, any, any>;
  }

  private async prepareContext(state: ConversationStateType): Promise<Partial<ConversationStateType>> {
    const s = performance.now();
    let result: Partial<ConversationStateType>;
    if (state.systemPrompt) {
      result = { messages: [new SystemMessage(state.systemPrompt)] };
    } else {
      result = {};
    }
    console.log(`[graph] prepareContext: ${(performance.now() - s).toFixed(1)}ms`);
    return result;
  }

  private async callModel(
    state: ConversationStateType,
  ): Promise<Partial<ConversationStateType>> {
    const response = await this.llm.invoke(state.messages);
    return { messages: [response] };
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
