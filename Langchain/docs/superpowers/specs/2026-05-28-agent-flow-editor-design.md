# Agent 可视化流程编排设计文档

**日期：** 2026-05-28  
**状态：** 已批准

---

## 1. 目标

构建一个可视化 Agent 构建器，用户在画布上拖拽节点、连线，定义完整的 Agent 工作流，保存后生成可用的 Agent 实例，在对话页面选择该 Agent 进行对话。

---

## 2. 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  顶部栏：Agent名称 / 保存 / 发布                            │
├────────────────────────┬────────────────────────────────┤
│                        │                                │
│   左侧：流程画布          │   右侧：对话调试                  │
│   ┌──────────────────┐ │   - 消息列表                     │
│   │ 节点面板（拖拽）    │ │   - 输入框                      │
│   └──────────────────┘ │   - 执行轨迹（高亮当前节点）        │
│   React Flow 画布       │                                │
│   节点配置面板（点击弹出） │                                │
│                        │                                │
└────────────────────────┴────────────────────────────────┘
```

---

## 3. 技术选型

| 层 | 技术 |
|----|------|
| 画布渲染 | React Flow |
| 前端状态 | Zustand |
| UI 组件 | Ant Design |
| 执行推送 | SSE（复用现有机制） |
| 后端执行引擎 | 自研流程解释器（方案三） |
| 数据持久化 | PostgreSQL（JSON 字段存流程定义） |

---

## 4. 节点类型

| 类型 | 说明 | 配置字段 |
|------|------|---------|
| `llm` | 调用大模型 | model, systemPrompt, temperature |
| `router` | LLM 路由判断，决定走哪条边 | prompt, 边上带 condition 标签 |
| `tool` | 调用内置工具函数 | toolName, parameters |
| `mcp` | 调用外部 MCP server | server, method, parameters |
| `skill` | 调用预定义 Skill | skillName, parameters |
| `http` | 调用外部 HTTP 接口 | url, method, headers, body |

节点数量和类型均可动态添加，无上限。

---

## 5. 数据模型

### 5.1 Agent 实体

```typescript
// agents 表
{
  id: string;          // uuid PK
  userId: string;      // FK → users
  name: string;
  description: string;
  flowDefinition: FlowDefinition;  // jsonb
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;  // 软删除
}
```

### 5.2 流程定义 JSON 结构

```typescript
interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface FlowNode {
  id: string;
  type: 'llm' | 'router' | 'tool' | 'mcp' | 'skill' | 'http';
  label: string;
  position: { x: number; y: number };  // 画布坐标
  config: LlmConfig | RouterConfig | ToolConfig | McpConfig | SkillConfig | HttpConfig;
}

interface FlowEdge {
  id: string;
  source: string;   // 节点 id
  target: string;   // 节点 id
  condition?: string;  // router 节点的分支条件标签
}

// 各节点配置类型
interface LlmConfig {
  model: string;
  systemPrompt: string;
  temperature?: number;
}

interface RouterConfig {
  prompt: string;  // 告诉 LLM 如何选择分支
}

interface ToolConfig {
  toolName: string;
  parameters?: Record<string, string>;  // 支持 {{context.nodeId.output}} 引用
}

interface McpConfig {
  server: string;
  method: string;
  parameters?: Record<string, string>;
}

interface SkillConfig {
  skillName: string;
  parameters?: Record<string, string>;
}

interface HttpConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;  // 支持 {{context.nodeId.output}} 引用
}
```

---

## 6. 执行引擎

### 6.1 执行流程

```
用户发送消息
  → 找到入口节点（无入边的节点）
  → 执行当前节点
      llm节点    → 调用大模型，输出存入 context[nodeId].output
      router节点 → LLM 判断输出匹配哪个 condition → 选择对应边
      tool节点   → 调用内置工具，结果存入 context[nodeId].output
      mcp节点    → 调用 MCP server，结果存入 context[nodeId].output
      skill节点  → 调用 Skill，结果存入 context[nodeId].output
      http节点   → 发起 HTTP 请求，响应存入 context[nodeId].output
  → SSE 推送节点执行状态（started / completed / error）
  → 找下一个节点（按边查找）
  → 循环直到无后继节点（终止）
  → SSE 推送 [DONE]
```

### 6.2 上下文传递

每个节点执行后，输出追加到共享 `ExecutionContext`：

```typescript
interface ExecutionContext {
  userMessage: string;
  nodes: Record<string, { output: string; status: 'pending' | 'running' | 'done' | 'error' }>;
}
```

节点配置中可用 `{{context.nodeId.output}}` 引用前序节点输出，执行前做字符串替换。

### 6.3 SSE 事件格式

```typescript
// 节点状态变更
{ type: 'node_status', nodeId: string, status: 'running' | 'done' | 'error' }

// LLM 流式 token
{ type: 'token', nodeId: string, token: string }

// 流程结束
{ type: 'done' }

// 错误
{ type: 'error', message: string }
```

---

## 7. 前端状态（Zustand）

```typescript
interface FlowStore {
  // 流程定义
  nodes: FlowNode[];
  edges: FlowEdge[];
  agentId: string | null;
  agentName: string;

  // 画布交互
  selectedNodeId: string | null;

  // 执行状态
  executionStatus: Record<string, 'pending' | 'running' | 'done' | 'error'>;
  isExecuting: boolean;

  // Actions
  addNode: (type: FlowNode['type'], position: { x: number; y: number }) => void;
  updateNode: (id: string, config: Partial<FlowNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: FlowEdge) => void;
  removeEdge: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  saveFlow: () => Promise<void>;
  updateExecutionStatus: (nodeId: string, status: string) => void;
  resetExecution: () => void;
}
```

---

## 8. 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /agents | 获取当前用户的 Agent 列表 |
| POST | /agents | 创建 Agent |
| GET | /agents/:id | 获取 Agent 详情（含流程定义） |
| PUT | /agents/:id | 更新 Agent（含流程定义） |
| DELETE | /agents/:id | 软删除 Agent |
| POST | /agents/:id/stream | 执行流程，SSE 推送执行状态 + token |

---

## 9. 页面路由

| 路径 | 说明 |
|------|------|
| /agents | Agent 列表页 |
| /agents/new | 新建 Agent（进入编辑器） |
| /agents/:id/edit | 编辑 Agent 流程 |
| /chat | 对话页（新增 Agent 选择器） |
| /chat/:id | 对话详情（显示使用的 Agent） |

---

## 10. 实现顺序

1. 后端：Agent 实体 + CRUD API
2. 后端：流程执行引擎（FlowExecutor）
3. 前端：Zustand store
4. 前端：React Flow 画布 + 节点面板
5. 前端：节点配置面板（各类型表单）
6. 前端：对话调试面板 + 执行轨迹高亮
7. 前端：对话页集成 Agent 选择器
