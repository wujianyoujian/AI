import { BaseMessage } from '@langchain/core/messages';

export interface ConversationState {
  messages: BaseMessage[];
  conversationId: string;
  systemPrompt?: string;
}
