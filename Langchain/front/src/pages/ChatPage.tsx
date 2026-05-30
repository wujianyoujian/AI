import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Message, MessageTiming } from '../types';
import { MessageRole } from '../types';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { useConversations } from '../contexts/ConversationsContext';
import * as conversationsAPI from '../api/conversations';

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadConversations } = useConversations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [lastTiming, setLastTiming] = useState<MessageTiming | null>(null);

  useEffect(() => {
    if (id) {
      conversationsAPI.getMessages(id).then(setMessages).catch(console.error);
    } else {
      setMessages([]);
    }
  }, [id]);

  const handleSend = async (
    content: string,
    templateId?: string,
    variables?: Record<string, string>,
  ) => {
    let conversationId = id;

    if (!conversationId) {
      const conversation = await conversationsAPI.createConversation('新对话');
      conversationId = conversation.id;
      navigate(`/chat/${conversationId}`);
    }

    // 立即展示用户消息
    const optimisticUserMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: conversationId,
      role: MessageRole.USER,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    const t1 = performance.now();
    let t2: number | null = null;
    setIsWaiting(true);
    setIsStreaming(true);
    setStreamingMessage('');

    try {
      const stream = await conversationsAPI.streamMessage(
        conversationId,
        content,
        templateId,
        variables,
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const updated = await conversationsAPI.getMessages(conversationId!);
              setMessages(updated);
              const t3 = performance.now();
              if (t2 !== null) {
                setLastTiming({
                  ttft: Math.round((t2 - t1) / 100) / 10,
                  total: Math.round((t3 - t1) / 100) / 10,
                });
              }
              setStreamingMessage('');
              setIsStreaming(false);
              setIsWaiting(false);
              await loadConversations();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                if (t2 === null) {
                  t2 = performance.now();
                }
                setIsWaiting(false);
                setStreamingMessage((prev) => prev + parsed.token);
              }
            } catch {
              // ignore malformed SSE data
            }
          }
        }
      }
    } catch (err) {
      console.error('Stream failed:', err);
      // 出错时移除乐观消息
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setIsStreaming(false);
      setIsWaiting(false);
      setStreamingMessage('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <MessageList
          messages={messages}
          streamingMessage={streamingMessage}
          isWaiting={isWaiting}
          lastTiming={lastTiming}
        />
      </div>
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}

