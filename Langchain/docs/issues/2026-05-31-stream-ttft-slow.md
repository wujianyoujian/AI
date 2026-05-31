# 问题记录：流式接口首字延迟（TTFT）过高

**日期：** 2026-05-31  
**状态：** 已定位根因，提供解法

---

## 一、现象

`POST /conversations/:id/stream` 接口使用 SSE 流式返回 AI 回复，但用户感知到"很慢"。

加埋点日志后，数据如下：

```
[stream:xxx] findOne: 1.2ms
[stream:xxx] getMessages: 3.4ms
[stream:xxx] saveUserMessage: 7.0ms
[graph] compiledGraph.stream() init: 4816.6ms   ← 异常
[graph] llm.stream firstChunk: 286.6ms
[stream:xxx] firstToken: 4817.4ms
```

**关键指标：**
- DB 操作（findOne / getMessages / saveMessage）：合计 < 15ms，正常
- LLM 首字（llm.stream firstChunk）：286ms，正常
- 用户感知首字（firstToken）：4817ms，**异常**

---

## 二、排查过程

### 阶段一：怀疑 DB 操作阻塞

最初怀疑 `prepareBuffer`（调用 LLM 做对话摘要）在流开始前阻塞了请求。

**验证：** 加埋点后发现 DB 操作全部在 15ms 以内，`prepareBuffer` 已经被移到流结束后异步执行（fire-and-forget）。排除。

### 阶段二：发现 `compiledGraph.stream()` 的 await 问题

埋点日志揭示了真正的瓶颈：

```
[graph] llm.stream firstChunk: 286.6ms   ← LLM 本身很快
[graph] compiledGraph.stream() init: 4816.6ms  ← 这里等了 4.8 秒
```

**根本原因：`compiledGraph.stream()` 返回的是 `Promise<AsyncIterable>`，`await` 它会等待整个 graph 执行完毕后才返回 iterable。**

```typescript
// 问题代码
const stream = await this.compiledGraph.stream(input, { streamMode: 'custom' });
// ^^^^^ 这个 await 会阻塞直到整个 graph 跑完，包括 LLM 生成全部 token
// 之后才开始迭代，用户看到的是完整响应一次性出现，不是流式
```

LangGraph 的 `stream()` 方法设计上是"等 graph 执行完，把所有 state 变更作为流返回"，而不是"边执行边 yield token"。

### 阶段三：尝试 `streamMode: 'custom'` + `config.writer`

LangGraph 提供了 `config.writer` 机制：在 node 内部调用 `writer(chunk)` 可以把数据推送到 custom stream。

```typescript
// callModel 节点
private async callModel(state, config) {
  const writer = config?.writer;
  for await (const chunk of await this.llm.stream(state.messages)) {
    if (writer && chunk.content) writer(chunk);  // 推送 token
  }
}

// 调用方
const stream = await this.compiledGraph.stream(input, { streamMode: 'custom' });
for await (const chunk of stream) { yield token; }
```

**结果：** 仍然是 4800ms 首字延迟。原因相同——`await compiledGraph.stream()` 本身就会等待整个 graph 完成，`writer` 推送的数据也要等 Promise resolve 后才能被消费。

### 阶段四：尝试 `async function*` generator 节点

尝试把 `callModel` 改成 generator 函数，边生成边 yield：

```typescript
private async *callModel(state) {
  for await (const chunk of await this.llm.stream(state.messages)) {
    yield { messages: [chunk] };
  }
}
```

**结果：** LangGraph 明确报错：`Generators are disallowed as tasks`。LangGraph 节点必须是普通 async 函数，不支持 generator。

### 阶段五：使用 `streamEvents()` — 正确解法

LangGraph 提供了另一个 API：`compiledGraph.streamEvents()`，它返回的是 `AsyncIterable`（不是 Promise），可以直接迭代，每个 LLM token 产生时立即触发 `on_chat_model_stream` 事件。

```typescript
for await (const event of this.compiledGraph.streamEvents(input, { version: 'v2' })) {
  if (event.event === 'on_chat_model_stream' && event.name === 'ChatDeepSeek') {
    const chunk = event.data?.chunk;
    // 每个 token 产生时立即到达这里
  }
}
```

**关键区别：**

| API | 返回类型 | 行为 |
|-----|---------|------|
| `compiledGraph.stream()` | `Promise<AsyncIterable>` | await 等待整个 graph 完成 |
| `compiledGraph.streamEvents()` | `AsyncIterable` | 直接迭代，事件实时触发 |

**同时发现：** `callModel` 节点应使用 `llm.invoke()`，不是 `llm.stream()`。

原因：LangGraph 内部会把 `llm.invoke()` 包装成流式调用，并在每个 token 产生时触发 `on_chat_model_stream` 事件。如果节点内部自己调用 `llm.stream()`，LangGraph 无法拦截中间 chunk，`streamEvents` 只会在 `stream()` 完成后触发一次事件，等同于非流式。

```typescript
// 正确：让 LangGraph 内部处理流式
private async callModel(state) {
  const response = await this.llm.invoke(state.messages);
  return { messages: [response] };
}

// 错误：自己管理 stream，LangGraph 无法拦截
private async callModel(state) {
  const chunks = [];
  for await (const chunk of await this.llm.stream(state.messages)) {
    chunks.push(chunk);
  }
  return { messages: [merged] };
}
```

### 阶段六：发现真正的首字瓶颈——模型本身

修复 `streamEvents` + `llm.invoke()` 后，首字延迟仍然是 4-5 秒（稳定，不是波动）。

对比测试：

```
deepseek-v4-flash + 中文问题：首字 4000-7000ms
deepseek-chat     + 中文问题：首字 190ms
deepseek-v4-flash + "say hi briefly"：首字 200ms
```

**根本原因：`deepseek-v4-flash` 是推理增强模型（reasoning model）**，在输出正式回答前会进行内部 chain-of-thought 思考。思考阶段不产生可见 token，也不触发 `on_chat_model_stream` 事件，所以用户感知到的首字延迟 = 模型思考时间（4-5 秒）。

简单问题（"say hi"）思考时间短，所以 200ms；复杂中文问题思考时间长，所以 4-5 秒。

---

## 三、根本原因总结

问题有两层：

**第一层（代码问题，已修复）：**  
`await compiledGraph.stream()` 阻塞等待整个 graph 执行完毕，导致 token 无法实时流出。应使用 `compiledGraph.streamEvents()` 直接迭代事件流。

**第二层（模型特性，需权衡）：**  
`deepseek-v4-flash` 是推理模型，内部思考时间导致首字延迟 4-5 秒。这是模型设计行为，不是 bug。

---

## 四、最终解法

### 后端代码修改

**`server/src/agent/agent.service.ts`** — 替换 stream 调用方式：

```typescript
// 修改前
const stream = await this.compiledGraph.stream(input, { streamMode: 'custom' });
for await (const chunk of stream) {
  if (chunk instanceof AIMessageChunk && chunk.content) { yield token; }
}

// 修改后
for await (const event of this.compiledGraph.streamEvents(input, { version: 'v2' })) {
  if (event.event === 'on_chat_model_stream' && event.name === 'ChatDeepSeek') {
    const chunk = event.data?.chunk as AIMessageChunk | undefined;
    if (chunk instanceof AIMessageChunk && chunk.content) {
      yield typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
    }
  }
}
```

**`server/src/agent/graph/conversation-graph.ts`** — callModel 节点用 `llm.invoke()`：

```typescript
private async callModel(state: ConversationStateType): Promise<Partial<ConversationStateType>> {
  const response = await this.llm.invoke(state.messages);
  return { messages: [response] };
}
```

### 模型选择

| 模型 | 首字延迟 | 特点 | 适用场景 |
|------|---------|------|---------|
| `deepseek-chat` | ~200ms | 非推理，直接回答 | 通用对话、快速响应 |
| `deepseek-v4-flash` | 4-5s | 推理模型，内部思考 | 复杂推理、代码分析、数学 |

如果不需要推理能力，换成 `deepseek-chat` 可将首字延迟降至 200ms 以内。

---

## 五、其他优化（同期完成）

1. **`summarizeConversation` 异步化**：原来在流开始前同步调用 LLM 做摘要，会阻塞 TTFT。改为流结束后 fire-and-forget 异步执行。

2. **移除 `MemorySaver` checkpointer**：LangGraph 的 `MemorySaver` 会在每次 graph 执行时持久化 state，引入额外开销。对话历史已由业务层（DB）管理，不需要 LangGraph 的 checkpoint 机制。

3. **前端响应时间显示**：在 AI 消息气泡下方显示「首字 Xs · 总计 Xs」，方便观察每次请求的实际延迟。

4. **后端分步埋点日志**：每个 DB 操作和关键节点打 `[stream:id] step: Xms` 日志，便于定位瓶颈。
