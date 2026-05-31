import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Message, MessageTiming } from '../types';
import { MessageRole } from '../types';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { useConversations } from '../contexts/ConversationsContext';
import * as conversationsAPI from '../api/conversations';

const OPTIMISTIC_ID_PREFIX = 'optimistic-';
const INTERRUPTED_ID_PREFIX = 'interrupted-';

interface RetryInfo {
  conversationId: string;
  userContent: string;
  templateId?: string;
  variables?: Record<string, string>;
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadConversations } = useConversations();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [currentTiming, setCurrentTiming] = useState<MessageTiming | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // refs track streaming content synchronously so the abort catch block can read the latest value
  const streamingMessageRef = useRef('');
  const streamingReasoningRef = useRef('');
  const activeConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // abort only when switching to a different existing conversation, not on initial load
    if (id !== activeConversationIdRef.current && activeConversationIdRef.current !== undefined) {
      abortControllerRef.current?.abort();
    }
    activeConversationIdRef.current = id;

    if (id) {
      conversationsAPI.getMessages(id).then(setMessages).catch(console.error);
    } else {
      setMessages([]);
    }
    setCurrentTiming(null);
    setInterrupted(false);
    setRetryInfo(null);
  }, [id]);

  const abort = () => {
    abortControllerRef.current?.abort();
  };

  const runStream = async (
    conversationId: string,
    content: string,
    templateId?: string,
    variables?: Record<string, string>,
    isRetry = false,
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeConversationIdRef.current = conversationId;

    if (!isRetry) {
      const optimisticUserMsg: Message = {
        id: `${OPTIMISTIC_ID_PREFIX}${Date.now()}`,
        conversationId,
        role: MessageRole.USER,
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [
        ...prev.filter((m) => !m.id.startsWith(OPTIMISTIC_ID_PREFIX)),
        optimisticUserMsg,
      ]);
    } else {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith(INTERRUPTED_ID_PREFIX)));
    }

    const t1 = performance.now();
    let t2: number | null = null;
    setIsWaiting(true);
    setIsStreaming(true);
    setStreamingMessage('');
    streamingMessageRef.current = '';
    setStreamingReasoning('');
    streamingReasoningRef.current = '';
    setCurrentTiming(null);
    setInterrupted(false);
    setRetryInfo(null);

    try {
      const stream = await conversationsAPI.streamMessage(
        conversationId,
        content,
        templateId,
        variables,
        controller.signal,
        isRetry,
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
              const updated = await conversationsAPI.getMessages(conversationId);
              setMessages(updated);
              const t3 = performance.now();
              if (t2 !== null) {
                setCurrentTiming({
                  ttft: Math.round((t2 - t1) / 100) / 10,
                  total: Math.round((t3 - t1) / 100) / 10,
                });
              }
              setStreamingMessage('');
              streamingMessageRef.current = '';
              setStreamingReasoning('');
              streamingReasoningRef.current = '';
              setIsStreaming(false);
              setIsWaiting(false);
              await loadConversations();
              return;
            }
            try {
              const parsed = JSON.parse(data) as { token?: string; reasoning?: string };
              if (parsed.reasoning) {
                if (t2 === null) t2 = performance.now();
                setIsWaiting(false);
                setStreamingReasoning((prev) => {
                  const next = prev + parsed.reasoning!;
                  streamingReasoningRef.current = next;
                  return next;
                });
              } else if (parsed.token) {
                if (t2 === null) t2 = performance.now();
                setIsWaiting(false);
                setStreamingMessage((prev) => {
                  const next = prev + parsed.token!;
                  streamingMessageRef.current = next;
                  return next;
                });
              }
            } catch {
              // ignore malformed SSE data
            }
          }
        }
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        console.error('Stream failed:', err);
      }

      const capturedMsg = streamingMessageRef.current;
      const capturedReasoning = streamingReasoningRef.current;

      if (capturedMsg || capturedReasoning) {
        const tempAssistantMsg: Message = {
          id: `${INTERRUPTED_ID_PREFIX}${Date.now()}`,
          conversationId,
          role: MessageRole.ASSISTANT,
          content: capturedMsg,
          reasoningContent: capturedReasoning || null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith(OPTIMISTIC_ID_PREFIX)),
          tempAssistantMsg,
        ]);
      }

      setInterrupted(true);
      setRetryInfo({ conversationId, userContent: content, templateId, variables });
    } finally {
      setIsStreaming(false);
      setIsWaiting(false);
      setStreamingMessage('');
      streamingMessageRef.current = '';
      setStreamingReasoning('');
      streamingReasoningRef.current = '';
    }
  };

  const handleSend = async (
    content: string,
    templateId?: string,
    variables?: Record<string, string>,
  ) => {
    if (isStreaming) {
      abort();
      return;
    }

    let conversationId = id;
    if (!conversationId) {
      const conversation = await conversationsAPI.createConversation('新对话');
      conversationId = conversation.id;
      navigate(`/chat/${conversationId}`);
    }

    await runStream(conversationId, content, templateId, variables);
  };

  const handleRetry = async () => {
    if (!retryInfo || isStreaming) return;
    setInterrupted(false);
    await runStream(
      retryInfo.conversationId,
      retryInfo.userContent,
      retryInfo.templateId,
      retryInfo.variables,
      true,
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto' }}>
        <MessageList
          messages={messages}
          streamingMessage={streamingMessage}
          streamingReasoning={streamingReasoning}
          isWaiting={isWaiting}
          currentTiming={currentTiming}
          interrupted={interrupted}
          onRetry={handleRetry}
        />
      </div>
      <MessageInput
        onSend={handleSend}
        onAbort={abort}
        isStreaming={isStreaming}
      />
    </div>
  );
}
