import { StateGraph, Annotation, messagesStateReducer, CompiledStateGraph } from '@langchain/langgraph';
import { ChatDeepSeek } from '@langchain/deepseek';
import { SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

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
      model: 'deepseek-chat',
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

  private async callModel(state: ConversationStateType): Promise<Partial<ConversationStateType>> {
    const response = await this.llm.invoke(state.messages);
    return {
      messages: [new AIMessage(response.content as string)],
    };
  }
}
