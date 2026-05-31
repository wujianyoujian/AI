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
  streamingReasoning?: string;
  isWaiting?: boolean;
  currentTiming?: MessageTiming | null;
}

function TimingBadge({ timing }: { timing: MessageTiming }) {
  return (
    <span style={{ fontSize: 11, color: '#bfbfbf' }}>
      首字 {timing.ttft}s · 总计 {timing.total}s
    </span>
  );
}

function ReasoningCollapsible({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <details open={streaming} style={{ marginBottom: 8 }}>
      <summary style={{
        fontSize: 12,
        color: '#bfbfbf',
        cursor: 'pointer',
        userSelect: 'none',
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10 }}>▶</span>
        {streaming ? '思考中...' : '思考过程'}
        {streaming && (
          <span style={{ display: 'inline-block', width: 5, height: 10, background: '#bfbfbf', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 0.8s step-end infinite' }} />
        )}
      </summary>
      <div style={{
        padding: '8px 10px',
        borderRadius: 6,
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        color: '#8c8c8c',
        fontSize: 13,
        lineHeight: 1.6,
        wordBreak: 'break-word',
        fontStyle: 'italic',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </details>
  );
}

function renderBubble(content: string, isUser: boolean, isStreaming = false) {
  return (
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
                      <SyntaxHighlighter style={oneLight} language={lang} PreTag="div">
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }
                return <code className={className} {...props}>{children}</code>;
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
}

export function MessageList({ messages, streamingMessage, streamingReasoning, isWaiting, currentTiming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage, streamingReasoning, isWaiting]);

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  // show currentTiming only when the last message doesn't already have timing stored
  const showCurrentTiming = !streamingMessage && !isWaiting && currentTiming
    && !(lastMsg?.role === MessageRole.ASSISTANT && lastMsg.timing);

  return (
    <div style={{ padding: '24px 40px', flex: 1 }}>
      {messages.map((msg) => {
        const isUser = msg.role === MessageRole.USER;
        if (isUser) {
          return (
            <div key={msg.id} style={{ display: 'flex', gap: 12, flexDirection: 'row-reverse', marginBottom: 20 }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />
              {renderBubble(msg.content, true)}
            </div>
          );
        }
        return (
          <div key={msg.id} style={{ display: 'flex', gap: 12, flexDirection: 'row', marginBottom: 4 }}>
            <Avatar icon={<RobotOutlined />} style={{ background: '#52c41a', flexShrink: 0, marginTop: msg.reasoningContent ? 2 : 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {msg.reasoningContent && (
                <ReasoningCollapsible content={msg.reasoningContent} />
              )}
              <div style={{ marginBottom: msg.timing ? 6 : 20 }}>
                {renderBubble(msg.content, false)}
              </div>
              {msg.timing && <TimingBadge timing={msg.timing} />}
            </div>
          </div>
        );
      })}

      {/* streaming assistant row */}
      {(streamingReasoning || streamingMessage) && (
        <div style={{ display: 'flex', gap: 12, flexDirection: 'row', marginBottom: 4 }}>
          <Avatar icon={<RobotOutlined />} style={{ background: '#52c41a', flexShrink: 0, marginTop: streamingReasoning ? 2 : 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {streamingReasoning && (
              <ReasoningCollapsible content={streamingReasoning} streaming />
            )}
            {streamingMessage && (
              <div style={{ marginBottom: 20 }}>
                {renderBubble(streamingMessage, false, true)}
              </div>
            )}
          </div>
        </div>
      )}

      {showCurrentTiming && (
        <div style={{ paddingLeft: 52, marginBottom: 20 }}>
          <TimingBadge timing={currentTiming!} />
        </div>
      )}

      {isWaiting && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <Avatar icon={<RobotOutlined />} style={{ background: '#52c41a', flexShrink: 0 }} />
          <div style={{ padding: '12px 16px', borderRadius: '4px 12px 12px 12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
            <Text type="secondary" style={{ fontSize: 13 }}>正在思考...</Text>
          </div>
        </div>
      )}

      {!messages.length && !streamingMessage && !streamingReasoning && !isWaiting && (
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
        details[open] summary span:first-child { transform: rotate(90deg); display: inline-block; }
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
