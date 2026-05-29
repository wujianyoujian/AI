# Agent 与模型配置设计文档

**日期：** 2026-05-29  
**状态：** 待实现

---

## 概述

将现有 Template 模块替换为 Agent 模块。Agent 由系统提示词定制，绑定模型配置，支持公开/私有。对话可选绑定 Agent，对话中可切换模型并保留最后选择。新增两阶段意图检测，确保 Agent 只回答规定范围内的问题。

---

## 数据模型

### `model_configs` 表

用户独立数据，每个用户管理自己的模型配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| userId | uuid FK | 所属用户，数据隔离 |
| provider | string | 'deepseek' \| 'openai' \| ... |
| modelId | string | 'deepseek-chat' \| 'deepseek-reasoner' \| ... |
| name | string | 显示名称，如 "DeepSeek Chat" |
| apiKey | string nullable | AES-256-GCM 加密后存储 |
| apiKeyIv | string nullable | 加密 IV，每次随机生成 |
| isEnabled | boolean | 用户可禁用 |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**加密方案：**
- 算法：AES-256-GCM
- 密钥：环境变量 `ENCRYPTION_KEY`（32字节），不存数据库
- IV：每次加密随机生成，与密文一起存储
- 前端展示：脱敏为 `sk-****...****`（前4位 + 后4位）
- LLM 调用：服务端解密后直接传给 SDK，不经过前端

### `agents` 表

替换现有 `templates` 表。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| userId | uuid FK | 创建者 |
| name | string | Agent 名称 |
| description | string | 描述 |
| systemPrompt | text | 系统提示词 |
| modelConfigId | uuid FK nullable | 默认模型 |
| visibility | enum | 'private' \| 'public' |
| createdAt | timestamp | |
| updatedAt | timestamp | |
| deletedAt | timestamp | 软删除 |

### `conversations` 表（新增字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| agentId | uuid FK nullable | 绑定的 Agent，可空表示通用对话 |
| activeModelId | uuid FK nullable | 当前对话使用的模型，覆盖 Agent 默认值 |

**模型选择优先级：** `conversation.activeModelId` > `agent.modelConfigId` > 系统默认模型

### `users` 表（新增字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| lastAgentId | uuid FK nullable | 最后使用的 Agent，null 表示通用对话 |

---

## 后端架构

### 新增模块：`model-configs`

- `ModelConfigsController` — 用户 CRUD 自己的模型配置
- `ModelConfigsService` — 加解密逻辑，权限校验（只能操作自己的配置）
- `ModelConfig` entity

### 新增模块：`agents`

- `AgentsController` — CRUD + 公开/私有切换
- `AgentsService` — 业务逻辑，权限校验（私有 Agent 只有创建者可用，公开 Agent 所有用户可用）
- `Agent` entity

### 修改：`conversations` 模块

- 创建对话接口接受可选 `agentId`，创建时同步更新 `user.lastAgentId`
- 新增 `PATCH /conversations/:id/model` — 切换模型，更新 `activeModelId`
- 新增 `PATCH /conversations/:id/agent` — 切换 Agent，更新 `agentId` 和 `user.lastAgentId`

### 修改：`users` 模块

- 登录/获取用户信息接口返回 `lastAgentId`

### 修改：`agent.service.ts`（LangGraph）

**图节点顺序：** `intent_check` → `prepare_context` → `call_model`

**`intent_check` 节点（两阶段检测）：**

1. 第一阶段：用低 maxTokens 调用轻量模型，返回 `{"allowed": true/false}`
2. 如果结果不确定（解析失败或置信度低），进入第二阶段由主 LLM 兜底判断
3. `allowed=false` 时直接输出拒绝消息，跳过 `prepare_context` 和 `call_model`
4. 无 Agent 绑定时跳过意图检测

**意图检测提示词：**
```
你是一个意图分类器。
Agent 职责范围描述：{systemPrompt 前200字}
用户消息：{userMessage}
判断用户消息是否在 Agent 职责范围内。
只返回 JSON：{"allowed": true} 或 {"allowed": false}
```

**动态模型：** `streamResponse()` 接收解析后的 `modelId` 和 `apiKey`，按需实例化 LLM 客户端。

---

## 前端交互

### 页面结构

| 变更 | 说明 |
|------|------|
| `/templates` → `/agents` | Agent 管理页 |
| 新增 `/models` | 模型配置页 |
| Sidebar 导航更新 | 模板管理 → Agent 管理 + 模型配置 |

### Agent 管理页（`/agents`）

- 列表：名称、描述、绑定模型、公开/私有标签
- 创建/编辑表单：名称、描述、系统提示词（textarea）、选择模型（下拉）、公开/私有
- 删除

### 模型配置页（`/models`）

- 列表：provider、模型名称、apiKey 脱敏显示、启用状态
- 新增/编辑：provider 选择、modelId 输入、显示名称、apiKey（password 输入框）

### 对话页（`/chat/:id`）

**默认 Agent 逻辑：**
- 前端登录后从用户信息接口获取 `lastAgentId`
- 新建对话时使用 `lastAgentId` 作为默认 Agent（null 则为通用对话）
- 无需弹窗选择，直接创建

**对话 Header：**
- 显示当前 Agent 名称（通用对话时显示"通用对话"）
- 显示当前模型名称，旁边有切换按钮
- Agent 名称可点击切换 Agent

**模型切换：**
- 点击模型名称弹出下拉，列出用户的 model_configs
- 选择后调用 `PATCH /conversations/:id/model`
- 保留最后一次选择（存于 `conversation.activeModelId`）

**MessageInput：**
- 移除 TemplateSelector 按钮

---

## 废弃

- `templates` 模块（`TemplatesPage`、`TemplatesService`、`Template` entity、`TemplateVersion` entity）全部移除
