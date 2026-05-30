import { useEffect, useRef } from 'react';
import { Avatar, Typography, Spin } from 'antd';
import { UserOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import type { Message, MessageTiming } from '../types';
import { MessageRole } from '../types';

const { Text } = Typography;

interface MessageListProps {
  messages: Message[];
  streamingMessage?: string;
  isWaiting?: boolean;
  lastTiming?: MessageTiming | null;
}

export function MessageList({ messages, streamingMessage, isWaiting, lastTiming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, isWaiting]);

  const renderBubble = (content: string, isUser: boolean, isStreaming = false) => (
    <div
      style={{
        maxWidth: '70%',
        padding: '10px 14px',
        borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        background: isUser ? '#1677ff' : '#f5f5f5',
        color: isUser ? '#fff' : 'rgba(0,0,0,0.88)',
        wordBreak: 'break-word',
        lineHeight: 1.6,
        fontSize: 14,
      }}
    >
      {isUser ? (
        <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                const lang = match?.[1];

                if (lang) {
                  return (
                    <div style={{ position: 'relative', margin: '8px 0' }}>
                      <span style={{
                        position: 'absolute', top: 0, right: 0, zIndex: 1,
                        background: '#e8e8e8', color: '#666',
                        padding: '2px 8px', borderRadius: '0 6px 0 6px',
                        fontSize: 12, fontFamily: 'var(--mono)',
                      }}>
                        {lang}
                      </span>
                      <SyntaxHighlighter
                        style={oneLight}
                        language={lang}
                        PreTag="div"
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
          {isStreaming && <span style={{ display: 'inline-block', width: 8, height: 14, background: 'currentColor', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 0.8s step-end infinite' }} />}
        </div>
      )}
    </div>
  );

  const renderRow = (content: string, role: MessageRole, key: string, isStreaming = false) => {
    const isUser = role === MessageRole.USER;
    return (
      <div
        key={key}
        style={{
          display: 'flex',
          gap: 12,
          flexDirection: isUser ? 'row-reverse' : 'row',
          marginBottom: 20,
        }}
      >
        <Avatar
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{ background: isUser ? '#1677ff' : '#52c41a', flexShrink: 0 }}
        />
        {renderBubble(content, isUser, isStreaming)}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 40px', flex: 1 }}>
      {messages.map((msg) => renderRow(msg.content, msg.role, msg.id))}

      {streamingMessage && renderRow(streamingMessage, MessageRole.ASSISTANT, 'streaming', true)}

      {!streamingMessage && lastTiming && messages.length > 0 && messages[messages.length - 1].role === MessageRole.ASSISTANT && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 52, marginTop: -14, marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: '#bfbfbf' }}>
            首字 {lastTiming.ttft}s · 总计 {lastTiming.total}s
          </span>
        </div>
      )}

      {isWaiting && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <Avatar icon={<RobotOutlined />} style={{ background: '#52c41a', flexShrink: 0 }} />
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '4px 12px 12px 12px',
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
            <Text type="secondary" style={{ fontSize: 13 }}>正在思考...</Text>
          </div>
        </div>
      )}

      {!messages.length && !streamingMessage && !isWaiting && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">开始一段新对话吧</Text>
          </div>
        </div>
      )}
      <div ref={bottomRef} />

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        .markdown-body p { margin: 0 0 8px; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body pre { background: #f8f8f8; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; font-size: 13px; }
        .markdown-body code { background: #d0d0d0 !important; padding: 2px 5px; border-radius: 4px; font-size: 13px; color: rgba(0,0,0,0.85) !important; }
        .markdown-body pre code { background: none !important; padding: 0; font-size: inherit; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 6px 0; }
        .markdown-body li { margin-bottom: 4px; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin: 12px 0 6px; line-height: 1.4; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .markdown-body th, .markdown-body td { border: 1px solid #d9d9d9; padding: 6px 10px; }
        .markdown-body th { background: #e8e8e8; }
        .markdown-body blockquote { border-left: 3px solid #d9d9d9; margin: 8px 0; padding-left: 12px; color: #666; }
      `}</style>
    </div>
  );
}


