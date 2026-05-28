import { useState } from 'react';
import { TemplateSelector } from './TemplateSelector';

interface MessageInputProps {
  onSend: (content: string, templateId?: string, variables?: Record<string, string>) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
      onSend(content);
      setContent('');
    }
  };

  const handleTemplateSelect = (templateId: string, variables: Record<string, string>) => {
    if (content.trim() && !disabled) {
      onSend(content, templateId, variables);
      setContent('');
    }
  };

  return (
    <div style={{ padding: '20px', borderTop: '1px solid #ccc' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label htmlFor="message-input" style={{ display: 'none' }}>消息</label>
          <input
            id="message-input"
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入消息..."
            disabled={disabled}
            style={{ flex: 1, padding: '10px', fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            disabled={disabled || !content.trim()}
            style={{ padding: '10px 20px' }}
          >
            使用模板
          </button>
          <button type="submit" disabled={disabled || !content.trim()} style={{ padding: '10px 20px' }}>
            发送
          </button>
        </div>
      </form>
      {showTemplateSelector && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}
