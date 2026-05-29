import { useState } from 'react';
import { Input, Button, Space } from 'antd';
import { SendOutlined, AppstoreOutlined } from '@ant-design/icons';
import { TemplateSelector } from './TemplateSelector';

interface MessageInputProps {
  onSend: (content: string, templateId?: string, variables?: Record<string, string>) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const handleSubmit = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ padding: '16px 40px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
          disabled={disabled}
          size="large"
          style={{ borderRadius: '8px 0 0 8px' }}
        />
        <Button
          icon={<AppstoreOutlined />}
          size="large"
          disabled={disabled || !content.trim()}
          onClick={() => setShowTemplateSelector(true)}
          title="使用模板"
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          size="large"
          disabled={disabled || !content.trim()}
          onClick={handleSubmit}
          style={{ borderRadius: '0 8px 8px 0' }}
        >
          发送
        </Button>
      </Space.Compact>
      {showTemplateSelector && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}

