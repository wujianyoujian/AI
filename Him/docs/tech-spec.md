# AI 对话电台 - 技术方案文档

## 一、技术栈

### 前端
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Framer Motion
- **状态管理**: Zustand
- **音频处理**: Web Audio API + Howler.js

### 后端
- **运行时**: Next.js API Routes / Route Handlers
- **数据库**: PostgreSQL (Neon) + Prisma ORM
- **文件存储**: Cloudflare R2 / Vercel Blob
- **实时通信**: Server-Sent Events (SSE) for streaming

### AI 服务（多服务支持，可配置切换）
| 服务 | 用途 |
|------|------|
| OpenAI GPT-4o | 对话 + 实时语音（Realtime API）|
| Claude API | 对话 + 想法完善 |
| 文心一言 / 通义千问 | 国内备选对话 |
| OpenAI Whisper | 语音识别 (STT) |
| OpenAI TTS / ElevenLabs | 语音合成 (TTS) |
| 阿里云语音 | 国内 STT/TTS 备选 |

### 部署
- **平台**: Vercel
- **CDN**: Cloudflare
- **数据库**: Neon (Serverless PostgreSQL)

---

## 二、系统架构

```
┌─────────────────────────────────────────┐
│              Next.js App                │
│  ┌──────────┐  ┌──────────┐            │
│  │  Pages   │  │   API    │            │
│  │  /chat   │  │ /ai/*    │            │
│  │  /ideas  │  │ /voice/* │            │
│  │  /gallery│  │ /music/* │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
         │                │
    SSE/WebSocket      REST API
         │                │
┌────────┴────────────────┴───────────┐
│           AI Service Layer          │
│  ┌──────┐ ┌──────┐ ┌────────────┐  │
│  │ Chat │ │ STT  │ │    TTS     │  │
│  │ LLM  │ │Voice │ │ Voice Syn. │  │
│  └──────┘ └──────┘ └────────────┘  │
└─────────────────────────────────────┘
         │
┌────────┴──────────┐
│     Database      │
│  PostgreSQL(Neon) │
│  + R2 (Audio/Img) │
└───────────────────┘
```

---

## 三、数据库设计

### 用户表 `users`
```sql
id, email, name, avatar, settings(json), created_at
```

### 对话表 `conversations`
```sql
id, user_id, title, summary, cover_image_url,
language_primary, language_secondary,
ai_provider, voice_config(json),
mood_tags(array), music_playlist(json),
is_private, created_at, updated_at
```

### 消息表 `messages`
```sql
id, conversation_id, role(user/assistant),
content_primary, content_secondary,  -- 双语内容
audio_url, duration,
is_idea_marked, created_at
```

### 想法表 `ideas`
```sql
id, user_id, conversation_id(nullable),
message_id(nullable),
raw_content, enhanced_content(json),
tags(array), status(draft/enhanced/archived),
created_at, updated_at
```

### 音乐表 `music_recommendations`
```sql
id, conversation_id, track_name, artist,
platform, external_url, mood_tags(array),
recommended_at
```

---

## 四、核心模块设计

### 4.1 AI 服务抽象层

```typescript
// 统一接口，支持多 AI 服务切换
interface AIProvider {
  chat(messages: Message[], config: ChatConfig): AsyncIterator<string>
  stt(audio: Blob): Promise<string>
  tts(text: string, voice: VoiceConfig): Promise<Blob>
  translate(text: string, target: string): Promise<string>
}

// 具体实现
class OpenAIProvider implements AIProvider { ... }
class ClaudeProvider implements AIProvider { ... }
class QianwenProvider implements AIProvider { ... }
```

### 4.2 语音对话流程

```
用户说话
  → 浏览器录音 (MediaRecorder API)
  → 发送音频流到 /api/voice/stt
  → Whisper / 阿里云 STT 识别
  → 文字发送到 /api/chat (SSE)
  → LLM 流式响应
  → 同步调用 /api/voice/tts
  → 浏览器播放音频
  → 双语文字实时展示
```

### 4.3 双语显示系统

- 主语言：用户设置（中文/英文）
- 副语言：AI 响应时同步翻译
- 流式翻译：每个句子完成后立即翻译
- 本地缓存：避免重复翻译请求

### 4.4 画廊系统

```typescript
// 对话封面自动生成
async function generateCoverImage(conversation: Conversation) {
  // 提取关键词 → 调用 AI 生成描述 → 调用图片生成 API
  // 或使用预设的抽象艺术图案 + 主题色
}

// 视图模式
type GalleryView = 'masonry' | 'timeline' | 'grid' | 'list'
```

---

## 五、页面结构

```
/                     → 首页 / 欢迎页
/chat                 → 新建对话
/chat/[id]            → 对话详情
/ideas                → 想法列表
/ideas/[id]           → 想法详情
/gallery              → 对话画廊（默认）
/gallery?view=timeline → 时间轴视图
/settings             → 设置（AI服务、音色、语言）
```

---

## 六、关键 API 设计

### 对话流式接口
```
POST /api/chat
Body: { conversationId, message, provider, config }
Response: SSE stream
  → data: { type: 'text', content: '...' }
  → data: { type: 'translation', content: '...' }
  → data: { type: 'done', metadata: { ... } }
```

### 语音接口
```
POST /api/voice/stt   → 音频转文字
POST /api/voice/tts   → 文字转音频（返回音频 URL）
```

### 想法接口
```
POST /api/ideas          → 创建想法
POST /api/ideas/enhance  → AI 完善想法（SSE）
GET  /api/ideas          → 想法列表
```

### 音乐接口
```
POST /api/music/recommend → AI 推荐音乐
GET  /api/music/library   → 音乐库
```

---

## 七、开发阶段规划

### Phase 1 - MVP（2-3周）
- [ ] 基础对话界面
- [ ] 文字输入 + AI 回复（Claude/OpenAI）
- [ ] 双语显示
- [ ] 对话历史保存
- [ ] 基础画廊展示

### Phase 2 - 语音（1-2周）
- [ ] 语音输入（STT）
- [ ] 语音输出（TTS）
- [ ] 音色配置
- [ ] 实时语音对话

### Phase 3 - 想法系统（1周）
- [ ] 想法独立入口
- [ ] 对话内标记
- [ ] AI 完善功能

### Phase 4 - 音乐&画廊（1-2周）
- [ ] 音乐推荐
- [ ] 背景音乐播放
- [ ] 画廊多视图
- [ ] 封面图生成

### Phase 5 - 优化
- [ ] 性能优化
- [ ] 移动端适配
- [ ] 多 AI 服务切换 UI
- [ ] 数据导出

---

## 八、待确认事项

- [ ] 是否需要用户注册/登录系统？还是本地存储？
- [ ] 音乐版权方案：自建库 or 接入第三方平台 API？
- [ ] 封面图生成：AI 生成 or 预设主题风格？
- [ ] 是否需要移动端 App（PWA 或 Native）？
- [ ] 部署区域：国内 or 海外？影响 AI 服务选择
