# Stream TTFT 优化 + 响应时间显示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 summarizeConversation 移到流结束后异步执行以消除 TTFT 阻塞，后端每步打时间戳日志，前端气泡下方显示「首字 Xs · 总计 Xs」。

**Architecture:** 后端 controller 在流开始前只做必要的读操作，summarize/updateSummary 移到流结束后的 fire-and-forget 调用；每个 DB/LLM 操作前后用 `performance.now()` 打日志。前端 `ChatPage` 记录 T1/T2/T3 时间戳，流结束后把 `{ ttft, total }` 传给 `MessageList`，在 AI 气泡下方渲染小字。

**Tech Stack:** NestJS (TypeScript), React + Ant Design, SSE streaming

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `server/src/conversations/conversations.controller.ts` | 修改：重排流程，summarize 异步化，加埋点日志 |
| `front/src/pages/ChatPage.tsx` | 修改：记录 T1/T2/T3，传 timing 给 MessageList |
| `front/src/components/MessageList.tsx` | 修改：接收并渲染响应时间 |
| `front/src/types/index.ts` | 修改：新增 MessageTiming 类型 |

---

## Task 1: 后端 controller 重构——流程重排 + 埋点日志

**Files:**
- Modify: `server/src/conversations/conversations.controller.ts`

### 目标
1. 把 `prepareBuffer` / `updateSummary` 移到流结束后异步执行（fire-and-forget）
2. 每个 DB 操作前后打 `[stream:<conversationId>] <step>: <ms>ms` 日志
3. 流开始前只保留：`findOne` + `getMessages` + `saveMessage(user)` + `templateLoad`

- [ ] **Step 1: 替换 controller 的 streamMessage 方法**

将 `server/src/conversations/conversations.controller.ts` 中 `streamMessage` 方法整体替换为：

```typescript
@Post(':id/stream')
@Sse()
streamMessage(
  @Param('id') id: string,
  @Body() streamMessageDto: StreamMessageDto,
  @CurrentUser() user: AuthenticatedUser,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    (async () => {
      const t = (label: string, start: number) =>
        console.log(`[stream:${id}] ${label}: ${(performance.now() - start).toFixed(1)}ms`);

      try {
        let s = performance.now();

        const conversation = await this.conversationsService.findOne(id, user.id);
        t('findOne', s);

        s = performance.now();
        const existingMessages = await this.conversationsService.getMessages(id, user.id);
        t('getMessages', s);

        if (existingMessages.length === 0) {
          s = performance.now();
          const title = streamMessageDto.content.slice(0, 30).replace(/\n/g, ' ');
          await this.conversationsService.updateTitle(id, title);
          t('updateTitle', s);
        }

        // Build history (no summarize here — moved to post-stream)
        const history: HistoryMessage[] = existingMessages.map((m) => ({
          role: m.role === MessageRole.USER ? 'user' : 'assistant',
          content: m.content,
        }));

        // Trim history to recent window without blocking on summarize
        const { recentHistory, needsSummarize } = this.agentService.trimBuffer(
          history,
          conversation.summary,
        );

        // Build system prompt from existing summary only (no new summarize yet)
        let systemPrompt: string | undefined;
        if (streamMessageDto.templateId) {
          s = performance.now();
          const latestVersion = await this.templatesService.getLatestVersion(
            streamMessageDto.templateId,
          );
          t('getLatestVersion', s);
          const templatePrompt = this.templatesService.renderTemplate(
            latestVersion.content,
            streamMessageDto.variables || {},
          );
          systemPrompt = conversation.summary
            ? `[对话历史摘要]\n${conversation.summary}\n\n${templatePrompt}`
            : templatePrompt;
        } else if (conversation.summary) {
          systemPrompt = `[对话历史摘要]\n${conversation.summary}`;
        }

        s = performance.now();
        await this.conversationsService.saveMessage(id, MessageRole.USER, streamMessageDto.content);
        t('saveUserMessage', s);

        let fullResponse = '';
        s = performance.now();
        let firstToken = true;

        for await (const token of this.agentService.streamResponse(
          id,
          streamMessageDto.content,
          systemPrompt,
          recentHistory,
        )) {
          if (firstToken) {
            t('firstToken', s);
            firstToken = false;
          }
          fullResponse += token;
          subscriber.next({ data: JSON.stringify({ token }) });
        }
        t('streamComplete', s);

        s = performance.now();
        await this.conversationsService.saveMessage(id, MessageRole.ASSISTANT, fullResponse);
        t('saveAssistantMessage', s);

        subscriber.next({ data: '[DONE]' });
        subscriber.complete();

        // Fire-and-forget: summarize after stream is done
        if (needsSummarize) {
          this.agentService
            .prepareBuffer(history, conversation.summary)
            .then(async (buffer) => {
              if (buffer.summaryUpdated && buffer.summary) {
                await this.conversationsService.updateSummary(id, buffer.summary);
                console.log(`[stream:${id}] post-stream summarize: done`);
              }
            })
            .catch((err) => console.error(`[stream:${id}] post-stream summarize failed:`, err));
        }
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
```

同时在文件顶部加 `import { performance } from 'perf_hooks';`（Node.js 内置，无需安装）。

- [ ] **Step 2: 验证 TypeScript 编译通过**

```powershell
cd server; npx tsc --noEmit
```

Expected: 无错误输出（或只有与本次修改无关的已有警告）。

---

## Task 2: AgentService 新增 trimBuffer 方法

**Files:**
- Modify: `server/src/agent/agent.service.ts`

`trimBuffer` 是 `prepareBuffer` 的纯同步版本——只做裁剪，不调用 LLM。controller 在流前调用它，流后再异步调用完整的 `prepareBuffer`。

- [ ] **Step 1: 在 AgentService 中添加 trimBuffer 方法**

在 `prepareBuffer` 方法之后添加：

```typescript
trimBuffer(
  history: HistoryMessage[],
  existingSummary: string | null,
): { recentHistory: HistoryMessage[]; needsSummarize: boolean } {
  const totalTokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  if (totalTokens <= MAX_BUFFER_TOKENS) {
    return { recentHistory: history, needsSummarize: false };
  }

  let kept = 0;
  let cutoffIndex = history.length;
  for (let i = history.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(history[i].content);
    if (kept + tokens > MAX_BUFFER_TOKENS) {
      cutoffIndex = i + 1;
      break;
    }
    kept += tokens;
  }

  return {
    recentHistory: history.slice(cutoffIndex),
    needsSummarize: true,
  };
}
```

- [ ] **Step 2: 验证编译**

```powershell
cd server; npx tsc --noEmit
```

Expected: 无新增错误。

- [ ] **Step 3: 提交**

```powershell
git add server/src/conversations/conversations.controller.ts server/src/agent/agent.service.ts
git commit -m "perf(stream): defer summarize to post-stream, add per-step timing logs"
```

---

## Task 3: 前端类型扩展

**Files:**
- Modify: `front/src/types/index.ts`

- [ ] **Step 1: 添加 MessageTiming 类型**

在 `front/src/types/index.ts` 末尾追加：

```typescript
export interface MessageTiming {
  ttft: number;   // 首字耗时，单位秒，保留1位小数
  total: number;  // 总耗时，单位秒，保留1位小数
}
```

---

## Task 4: 前端 ChatPage 记录时间戳

**Files:**
- Modify: `front/src/pages/ChatPage.tsx`

- [ ] **Step 1: 添加 timing state 和时间戳记录**

在 `ChatPage` 中：

1. 新增 import：
```typescript
import type { MessageTiming } from '../types';
```

2. 在现有 state 声明后添加：
```typescript
const [lastTiming, setLastTiming] = useState<MessageTiming | null>(null);
```

3. 在 `handleSend` 中，`setIsWaiting(true)` 之前添加：
```typescript
const t1 = performance.now();
let t2: number | null = null;
```

4. 在 `setIsWaiting(false); setStreamingMessage((prev) => prev + parsed.token);` 那段，改为：
```typescript
if (parsed.token) {
  if (t2 === null) {
    t2 = performance.now();
  }
  setIsWaiting(false);
  setStreamingMessage((prev) => prev + parsed.token);
}
```

5. 在 `data === '[DONE]'` 分支，`setStreamingMessage('')` 之前添加：
```typescript
const t3 = performance.now();
if (t2 !== null) {
  setLastTiming({
    ttft: Math.round((t2 - t1) / 100) / 10,
    total: Math.round((t3 - t1) / 100) / 10,
  });
}
```

- [ ] **Step 2: 把 lastTiming 传给 MessageList**

将 JSX 中的 `<MessageList` 改为：

```tsx
<MessageList
  messages={messages}
  streamingMessage={streamingMessage}
  isWaiting={isWaiting}
  lastTiming={lastTiming}
/>
```

---

## Task 5: 前端 MessageList 渲染响应时间

**Files:**
- Modify: `front/src/components/MessageList.tsx`

- [ ] **Step 1: 更新 props 类型**

将 `MessageListProps` 改为：

```typescript
import type { Message, MessageTiming } from '../types';

interface MessageListProps {
  messages: Message[];
  streamingMessage?: string;
  isWaiting?: boolean;
  lastTiming?: MessageTiming | null;
}
```

- [ ] **Step 2: 更新函数签名**

```typescript
export function MessageList({ messages, streamingMessage, isWaiting, lastTiming }: MessageListProps) {
```

- [ ] **Step 3: 在流式消息气泡下方渲染时间**

在 `{streamingMessage && renderRow(streamingMessage, MessageRole.ASSISTANT, 'streaming', true)}` 之后添加：

```tsx
{!streamingMessage && lastTiming && messages.length > 0 && messages[messages.length - 1].role === MessageRole.ASSISTANT && (
  <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 52, marginTop: -14, marginBottom: 20 }}>
    <span style={{ fontSize: 11, color: '#bfbfbf' }}>
      首字 {lastTiming.ttft}s · 总计 {lastTiming.total}s
    </span>
  </div>
)}
```

- [ ] **Step 4: 提交**

```powershell
git add front/src/types/index.ts front/src/pages/ChatPage.tsx front/src/components/MessageList.tsx
git commit -m "feat(front): show TTFT and total response time below AI message"
```

---

## Task 6: 端到端验证

- [ ] **Step 1: 启动后端**

```powershell
cd server; npm run start:dev
```

- [ ] **Step 2: 启动前端**

```powershell
cd front; npm run dev
```

- [ ] **Step 3: 发送一条消息，观察后端日志**

预期日志格式：
```
[stream:abc123] findOne: 8.2ms
[stream:abc123] getMessages: 12.4ms
[stream:abc123] saveUserMessage: 6.1ms
[stream:abc123] firstToken: 843.5ms
[stream:abc123] streamComplete: 4231.0ms
[stream:abc123] saveAssistantMessage: 9.3ms
```

- [ ] **Step 4: 观察前端气泡**

AI 消息气泡下方应显示：`首字 0.8s · 总计 4.2s`

- [ ] **Step 5: 发送一条超长历史对话（触发 summarize）**

观察日志中 `post-stream summarize: done` 出现在 `[DONE]` 之后，确认不阻塞 TTFT。
