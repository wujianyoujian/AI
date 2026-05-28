import type { Message } from '../types';
import { MessageRole } from '../types';

interface MessageListProps {
  messages: Message[];
  streamingMessage?: string;
}

export function MessageList({ messages, streamingMessage }: MessageListProps) {
  return (
    <div style={{ padding: '20px' }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: msg.role === MessageRole.USER ? '#e3f2fd' : '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <strong>{msg.role === MessageRole.USER ? '你' : 'AI'}:</strong>
          <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        </div>
      ))}
      {streamingMessage && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <strong>AI:</strong>
          <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{streamingMessage}</div>
        </div>
      )}
    </div>
  );
}
