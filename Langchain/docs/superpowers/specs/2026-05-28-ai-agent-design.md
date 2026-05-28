# AI Agent 平台设计文档

**日期：** 2026-05-28  
**状态：** 已审批

---

## 概述

基于现有 React + NestJS + PostgreSQL 技术栈，构建一个支持多用户的 AI Agent 平台，核心功能为智能问答（多轮对话）和提示词模板管理（含版本控制与权限）。AI 层使用 LangGraph 管理 Agent 状态，DeepSeek 作为 LLM，通过 SSE 实现流式输出。

**技术选型补充：**
- ORM：TypeORM（NestJS 官方集成，支持 PostgreSQL，与 NestJS 模块系统无缝配合）
- 数据库迁移：TypeORM Migration，版本化管理 schema 变更
- 现有 `server/main.ts` 为独立脚本，需重构为标准 NestJS 应用入口（`bootstrap()` + `AppModule`），原 LangChain 调用逻辑迁移至 `AgentModule`

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                    前端 (React + Vite)                │
│  - 登录/注册页                                        │
│  - 对话页（SSE 接收流式输出）                          │
│  - 模板管理页（CRUD + 版本历史）                       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│                  后端 (NestJS)                        │
│                                                      │
│  AuthModule        — JWT 认证 + 权限守卫              │
│  ConversationModule — 会话 & 消息 CRUD + SSE 流       │
│  AgentModule       — LangGraph Agent 执行             │
│  TemplateModule    — 提示词模板 CRUD + 版本管理        │
│  UserModule        — 用户管理                         │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼──────┐     ┌──────────▼──────────────────┐
│  PostgreSQL     │     │  LangGraph + DeepSeek        │
│  - users        │     │  - StateGraph 管理对话状态    │
│  - conversations│     │  - PostgresSaver 持久化       │
│  - messages     │     │  - 流式输出 via SSE           │
│  - templates    │     └─────────────────────────────┘
│  - template_vers│
└─────────────────┘
```

**关键决策：**
- NestJS 模块化结构，每个功能域独立模块
- JWT 存储在 HttpOnly Cookie，避免 XSS
- LangGraph 的 `PostgresSaver` 直接复用已有 PostgreSQL，不引入额外存储
- SSE 端点独立于普通 REST 端点，路径为 `POST /conversations/:id/stream`

---

## 二、数据模型

**users**
```
id          UUID, PK
email       VARCHAR, UNIQUE
password    VARCHAR (bcrypt hash)
role        ENUM('admin', 'user')
created_at  TIMESTAMP
```

**conversations**
```
id          UUID, PK
user_id     UUID, FK → users
title       VARCHAR
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

**messages**
```
id              UUID, PK
conversation_id UUID, FK → conversations
role            ENUM('user', 'assistant')
content         TEXT
created_at      TIMESTAMP
```

**templates**
```
id          UUID, PK
user_id     UUID, FK → users
name        VARCHAR
description TEXT
visibility  ENUM('private', 'public')
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

**template_versions**
```
id          UUID, PK
template_id UUID, FK → templates
version     INTEGER
content     TEXT        — 模板正文，含 {{变量}} 占位符
variables   JSONB       — 变量定义列表，如 [{"name":"用户名","default":""}]
created_at  TIMESTAMP
```

**关键决策：**
- `template_versions` 独立表存版本，`templates` 只存元信息，当前生效版本取最新 `version` 号
- `messages` 表作为对话历史的业务记录，LangGraph `PostgresSaver` 另存 checkpoint（内部状态），两者并行不冲突
- `visibility` 控制模板公开/私有，`role=admin` 可管理所有公开模板

---

## 三、API 接口设计

**认证**
```
POST /auth/register     — 注册
POST /auth/login        — 登录，返回 JWT (HttpOnly Cookie)
POST /auth/logout       — 登出
```

**对话**
```
GET    /conversations                    — 获取当前用户会话列表
POST   /conversations                    — 新建会话
DELETE /conversations/:id                — 删除会话
GET    /conversations/:id/messages       — 获取历史消息

POST   /conversations/:id/stream         — 发送消息，SSE 流式返回 AI 回复
  body: { content: string, templateId?: string, variables?: Record<string, string> }
  response: text/event-stream
```

**模板**
```
GET    /templates                                    — 获取模板列表（自己的 + 公开的）
POST   /templates                                    — 创建模板
GET    /templates/:id                                — 获取模板详情（含最新版本内容）
PATCH  /templates/:id                                — 更新元信息（名称、描述、可见性）
DELETE /templates/:id                                — 删除模板

POST   /templates/:id/versions                       — 发布新版本
GET    /templates/:id/versions                       — 获取版本历史列表
GET    /templates/:id/versions/:version              — 获取指定版本内容
POST   /templates/:id/versions/:version/rollback     — 回滚到指定版本（创建新版本）
```

**关键决策：**
- 回滚操作是"创建新版本"而非修改历史，保证版本历史不可变
- SSE 端点用 `POST` 而非 `GET`，因为需要携带消息体
- 模板在对话时可选传入，`templateId + variables` 由 AgentModule 渲染后注入 system prompt

---

## 四、Agent 执行流程

**LangGraph 状态图结构**

```
用户消息
    │
    ▼
┌─────────────────┐
│  prepare_context │  — 加载对话历史 + 渲染模板为 system prompt
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   call_model    │  — 调用 DeepSeek，流式输出 token
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   save_message  │  — 将完整回复写入 messages 表
└─────────────────┘
```

**SSE 流式输出时序**

```
前端                          NestJS                        LangGraph
 │                               │                               │
 │── POST /conversations/:id/stream ──▶│                        │
 │                               │── graph.stream(input) ──────▶│
 │                               │                               │ token1
 │◀── data: {"token":"你"} ──────│◀──────────────────────────── │
 │                               │                               │ token2
 │◀── data: {"token":"好"} ──────│◀──────────────────────────── │
 │                               │                               │ done
 │◀── data: [DONE] ──────────────│◀──────────────────────────── │
 │                               │── save_message() ───────────▶│
```

**模板渲染逻辑**

```
templateId + variables
        │
        ▼
取最新版本 content（"你是{{角色}}，请用{{语言}}回答"）
        │
        ▼
替换变量 → "你是翻译专家，请用英文回答"
        │
        ▼
注入为 SystemMessage，拼接到对话历史前
```

**关键决策：**
- LangGraph `thread_id` 与 `conversation_id` 一一对应，checkpoint 自动持久化到 PostgreSQL
- 流式过程中前端收到每个 token 即时渲染，`[DONE]` 事件标志本次回复结束
- 模板变量替换在 NestJS 层完成，不进入 LangGraph 内部

---

## 五、前端页面结构

**路由结构**
```
/login              — 登录页
/register           — 注册页
/                   — 重定向到 /chat
/chat               — 新建对话
/chat/:id           — 已有对话（含历史消息 + 流式输入框）
/templates          — 模板列表（公开 + 我的）
/templates/new      — 创建模板
/templates/:id      — 模板详情 + 版本历史
/templates/:id/edit — 编辑模板
```

**核心组件划分**
```
App
├── AuthGuard           — 路由守卫，未登录跳转 /login
├── Layout
│   ├── Sidebar         — 会话列表 + 新建按钮
│   └── Outlet
│       ├── ChatPage
│       │   ├── MessageList     — 渲染历史消息 + 流式 token
│       │   ├── MessageInput    — 输入框 + 模板选择器
│       │   └── TemplateSelector — 选模板 + 填变量弹窗
│       └── TemplatePage
│           ├── TemplateList
│           ├── TemplateForm    — 创建/编辑
│           └── VersionHistory  — 版本列表 + 回滚按钮
```

**SSE 处理方式**
- 使用原生 `fetch` + `ReadableStream` 读取 SSE，不引入额外库
- 流式 token 追加到当前 assistant 消息的末尾，`[DONE]` 后标记消息完成
- 请求中断（用户关闭页面）时前端调用 `AbortController.abort()`

**关键决策：**
- 状态管理用 React 内置 `useState` + `useContext`，当前规模不需要引入 Redux/Zustand
- 模板选择器作为输入框的可选附件，不强制每次对话都选模板
