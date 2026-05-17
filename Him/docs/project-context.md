# Him — 项目上下文文档

> 切换对话时带上这份文档，可以完整恢复上下文。

---

## 项目概览

**项目名称**: Him — AI 对话电台  
**路径**: `/Users/wangshi/project/AI/Him`  
**技术栈**: Next.js 15 + TypeScript + Tailwind CSS + Prisma + SQLite  
**AI 服务**: OpenAI (GPT-4o) + Anthropic (Claude)  
**端口**: 3000  
**启动命令**: `npm run dev`

---

## 文件结构

```
Him/
├── app/
│   ├── page.tsx                    # 首页 — 粒子背景、录音、最近对话
│   ├── layout.tsx                  # 根布局
│   ├── globals.css                 # 全局样式 + CSS 变量
│   ├── chat/
│   │   ├── page.tsx                # 重定向到新建对话
│   │   └── [id]/page.tsx           # 对话详情 — 消息流、双语、TTS
│   ├── history/page.tsx            # 对话历史列表
│   ├── ideas/page.tsx              # 想法管理 — 记录 + AI 完善
│   ├── settings/page.tsx           # 设置 — AI 服务、音色
│   └── api/
│       ├── chat/route.ts           # 流式对话 (SSE)
│       ├── conversations/
│       │   ├── route.ts            # GET 列表 / POST 新建
│       │   └── [id]/route.ts       # GET 详情 / PATCH 更新 / DELETE 删除
│       ├── ideas/
│       │   ├── route.ts            # GET 列表 / POST 新建 / PUT 流式完善
│       │   └── [id]/route.ts       # DELETE 删除
│       └── voice/
│           ├── stt/route.ts        # Whisper 语音转文字
│           └── tts/route.ts        # OpenAI TTS 文字转语音
├── components/
│   ├── ChatInput.tsx               # 输入框 — 文字/录音/想法标记
│   └── MessageList.tsx             # 消息列表 — 双语气泡、自动滚动
├── lib/
│   ├── ai.ts                       # AI 服务 — streamChat / translate / enhanceIdea / generateTitle
│   ├── prisma.ts                   # Prisma 单例客户端
│   ├── types.ts                    # TypeScript 类型定义
│   ├── user.ts                     # 本地用户管理 (DEFAULT_USER_ID)
│   └── utils.ts                    # cn() / formatDate() / parseJson()
├── prisma/
│   ├── schema.prisma               # 数据库模型
│   └── dev.db                      # SQLite 数据库文件
└── docs/
    ├── requirements.md             # 产品需求文档
    ├── tech-spec.md                # 技术方案文档
    └── project-context.md          # 本文件
```

---

## 数据库模型

```prisma
User          id, name, settings(JSON), createdAt
Conversation  id, userId, title, summary, coverImageUrl, moodTags(JSON),
              aiProvider, voiceConfig(JSON), musicPlaylist(JSON),
              isPrivate, createdAt, updatedAt
Message       id, conversationId, role(user|assistant),
              contentPrimary, contentSecondary, audioUrl,
              duration, isIdeaMarked, createdAt
Idea          id, userId, conversationId?, messageId?,
              rawContent, enhancedContent(JSON), tags(JSON),
              status(draft|enhanced|archived), createdAt, updatedAt
MusicRecommendation  id, conversationId, trackName, artist,
                     platform, externalUrl, moodTags(JSON), recommendedAt
```

---

## API 设计

### POST /api/chat — 流式对话
```
Request:  { conversationId, message, provider: "openai"|"anthropic" }
Response: SSE
  { type: "text",        content: "..." }       # 流式文本块
  { type: "translation", content: "..." }       # 翻译结果
  { type: "title",       content: "..." }       # 自动生成标题 (第4条消息触发)
  { type: "done",        messageId: "..." }     # 完成
```

### GET /api/conversations
```
Response: Array<{ id, title, summary, coverImageUrl, moodTags, createdAt, messageCount }>
```

### POST /api/conversations
```
Request:  { title?, aiProvider?, voiceConfig? }
Response: Conversation 对象
```

### GET /api/conversations/[id]
```
Response: { ...conversation, messages: MessageData[] }
```

### PUT /api/ideas — 流式 AI 完善
```
Request:  { id }
Response: SSE
  { type: "text", content: "..." }
  { type: "done" }
```

### POST /api/voice/stt
```
Request:  FormData { audio: File (webm) }
Response: { text: "识别文字" }
```

### POST /api/voice/tts
```
Request:  { text, voice?: string, speed?: number }
Response: audio/mpeg 二进制
```

---

## 核心功能实现

### 首页 (app/page.tsx)
- `AmbientCanvas` — Canvas 动画：5 个流动光晕 orbs + 120 个漂浮粒子 + 噪点纹理
- `Waveform` — 28 根波形条，录音时触发 CSS keyframe 动画
- 顶部导航：Him · 想法 · 历史 · 设置（纯文字，无图标）
- 底部：最近 3 条对话快捷入口
- 语音模式：MediaRecorder → Whisper STT → 跳转对话页
- 文字模式：textarea → Enter 发送 → 跳转对话页
- 跳转携带 `?first=` 参数，对话页自动发送第一条消息

### 对话页 (app/chat/[id]/page.tsx)
- `useSearchParams` 读取 `?first=` 自动触发首条消息
- 用 `Suspense` 包裹（Next.js 要求）
- 顶部工具栏：返回 / 标题 / AI 切换 / 双语开关 / TTS 开关 / 想法 / 删除
- 流式渲染：SSE 逐字追加到消息气泡
- TTS：AI 回复完成后自动播放（需手动开启）

### AI 服务 (lib/ai.ts)
- `streamChat(messages, provider)` — 返回 ReadableStream
- `translateText(text)` — Claude Haiku 快速翻译
- `enhanceIdea(content)` — 核心洞察 + 3 个方向 + 挑战 + 问题
- `generateConversationTitle(messages)` — 8 字以内标题

---

## 环境变量 (.env.local)

```env
OPENAI_API_KEY=           # OpenAI Key（STT/TTS/GPT-4o）
ANTHROPIC_API_KEY=        # Anthropic Key（Claude，必需）
DEFAULT_AI_PROVIDER=anthropic
DEFAULT_USER_ID=local-user
```

---

## 样式系统

**Tailwind 自定义颜色**:
```
surface.DEFAULT  #0f0f13
surface.1        #16161d
surface.2        #1e1e28
surface.3        #262633
accent           #a78bfa
accent.dim       #7c5cbf
```

**全局 CSS 变量** (globals.css):
```
--bg, --surface-1/2/3, --accent, --text, --muted
```

**常用自定义类**:
- `.glass` — 毛玻璃效果
- `.glow` — 紫色发光

---

## 当前状态（最后更新）

### 已完成
- [x] 首页重设计：粒子 + 光晕 canvas 背景
- [x] 去掉 Sidebar，所有页面改为顶部导航
- [x] `/history` 页面（对话列表 + 删除 + 新建）
- [x] `/ideas` 页面（记录 + AI 流式完善 + 删除）
- [x] `/settings` 页面（AI 服务 + 音色，localStorage 持久化）
- [x] `/chat/[id]` 页面（流式消息 + 双语 + TTS + 想法标记）
- [x] `?first=` 参数自动发送首条消息
- [x] 删除 Sidebar.tsx、ConversationCard.tsx 无用组件
- [x] Build 验证通过，无报错

### 待完善 / 可扩展
- [ ] 消息气泡内的想法标记交互（当前在 ChatInput 实现）
- [ ] 设置页的配置同步到 API（当前仅 localStorage）
- [ ] 音乐推荐功能（MusicRecommendation 模型已建，API 未实现）
- [ ] 对话封面图生成（coverImageUrl 字段已有）
- [ ] 多用户支持（User 模型已建，当前固定 local-user）

---

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建验证
npm run db:push      # 同步 Prisma schema 到数据库
npm run db:studio    # 打开 Prisma Studio GUI
```
