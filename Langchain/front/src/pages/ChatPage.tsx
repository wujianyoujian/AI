import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Message } from '../types';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import * as conversationsAPI from '../api/conversations';

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (id) {
      conversationsAPI.getMessages(id).then(setMessages).catch(console.error);
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
              setStreamingMessage('');
              setIsStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
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
    } finally {
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <MessageList messages={messages} streamingMessage={streamingMessage} />
      </div>
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
