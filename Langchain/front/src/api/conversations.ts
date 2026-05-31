import { fetchAPI } from './client';
import type { Conversation, Message } from '../types';

export async function getConversations(): Promise<Conversation[]> {
  const response = await fetchAPI('/conversations');
  return response.json();
}

export async function createConversation(title: string): Promise<Conversation> {
  const response = await fetchAPI('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return response.json();
}

export async function deleteConversation(id: string): Promise<void> {
  await fetchAPI(`/conversations/${id}`, { method: 'DELETE' });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const response = await fetchAPI(`/conversations/${conversationId}/messages`);
  return response.json();
}

export async function streamMessage(
  conversationId: string,
  content: string,
  templateId?: string,
  variables?: Record<string, string>,
  signal?: AbortSignal,
  isRetry?: boolean,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`http://localhost:3000/conversations/${conversationId}/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, templateId, variables, isRetry }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error('Stream failed');
  }

  return response.body;
}
