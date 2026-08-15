# 杭州 AI Agent 岗位 · 完整技能要求与学习路线

> 基于 BOSS 直聘 2026.08 杭州地区 34 条 AI Agent JD 详情分析  
> 数据来源：`boss-zhipin-scraper` 爬取分析

---

## 📊 完整技能要求分析

### 🤖 AI/LLM 核心技术（决定性技能）

| 层级 | 技能 | JD 占比 | 说明 |
|------|------|---------|------|
| **必会** | 大模型应用开发 | 74% | 基于 LLM 构建应用，不只是调 API |
| **必会** | RAG（检索增强生成） | 68% | 知识库问答、文档检索+生成 |
| **必会** | MCP / Function Calling / 工具调用 | 65% | 让 Agent 调用外部工具和 API |
| **必会** | 记忆管理（短期/长期） | 59% | 对话历史、用户画像持久化 |
| **必会** | Agent 框架 | 56% | LangChain/LangGraph/AutoGen/Dify |
| **重要** | 多 Agent 协作 | 53% | Agent 间通信、任务分配、编排 |
| **重要** | Workflow 编排 | 44% | DAG 流程、任务链、条件分支 |
| **重要** | Prompt Engineering | 35% | 不是简单写 prompt，而是系统性设计 |
| **加分** | 向量数据库 | 38% | Milvus/Chroma/Pinecone/FAISS |
| **加分** | 模型部署/推理 | 18% | vLLM/Triton/模型量化 |
| **加分** | Fine-tuning | 12% | LoRA/SFT/RLHF |
| **加分** | 多模态 | 15% | 视觉、语音等多模态 Agent |

### 💻 编程语言

| 语言 | JD 占比 | 定位 |
|------|---------|------|
| **Python** | 62% | 绝对主力，AI/ML 生态的核心语言 |
| **Java** | 32% | 大厂后端主力，Spring 生态 |
| **TypeScript** | 32% | 全栈/前端标配 |
| **Go** | 24% | 高性能后端服务 |
| **JavaScript** | 15% | Web 前端基础 |
| **SQL** | 12% | 数据库查询和设计 |

> **结论：** Python 必须精通，Java 或 TypeScript/Go 至少掌握一种作为第二语言。

### 🏗️ 后端 & 架构

| 技能 | JD 占比 | 说明 |
|------|---------|------|
| **系统设计** | 50% | 架构能力，不是算法题刷题 |
| **安全** | 44% | 认证鉴权、数据安全、权限控制 |
| **API 设计/RESTful** | 26% | API 规范和设计模式 |
| **分布式** | 24% | 分布式系统理论与实战 |
| **微服务** | 18% | 服务拆分、治理、通信 |
| **高并发** | 15% | 性能优化、并发控制 |

### 🎨 前端（全栈加分）

| 技能 | JD 占比 | 说明 |
|------|---------|------|
| **React** | 41% | 绝对主流框架 |
| **全栈** | 29% | JD 明确要求前后端都能做 |
| **Vue** | 15% | 国内仍有大量用户 |
| **Next.js** | 6% | React 全栈框架 |

### 🐳 DevOps / 运维

| 技能 | JD 占比 | 说明 |
|------|---------|------|
| **Docker** | 21% | 容器化部署 |
| **Kubernetes/K8s** | 15% | 容器编排 |
| **CI/CD** | 9% | 持续集成/部署流水线 |
| **Linux** | 6% | 基础运维能力 |
| **Git** | 6% | 版本控制 |

### 🗄️ 数据存储

| 技能 | JD 占比 | 说明 |
|------|---------|------|
| **MySQL** | 24% | 关系型数据库 |
| **PostgreSQL** | 15% | 高级关系型数据库，支持向量扩展 |
| **Redis** | 15% | 缓存、消息队列、会话存储 |
| **MongoDB** | 12% | 文档型数据库 |
| **Elasticsearch** | 12% | 全文搜索引擎 |

---

## 🗺️ 学习路线图（从零到 AI Agent 工程师）

### 第一阶段：地基（1-2 个月）

#### 学习内容

```
Python 精通 → Linux 基础 → Git → SQL + 一种关系型数据库
```

#### 具体目标

| 模块 | 要达到的程度 | 推荐资源 |
|------|-------------|----------|
| Python | 装饰器、生成器、异步（asyncio）、类型注解、pytest 写测试 | 《流畅的 Python》、realpython.com |
| Linux | 常用命令、Shell 脚本、进程管理、文件权限 | 《鸟哥的 Linux 私房菜》 |
| Git | 分支管理、rebase、cherry-pick、PR 流程 | learngitbranching.js.org |
| 数据库 | 表结构设计、复杂查询（JOIN/子查询/窗口函数）、索引优化、事务 | sqlbolt.com、《SQL 必知必会》 |
| 数据结构 | 链表、栈、队列、树、哈希表、图基础 | LeetCode 简单+中等 50 题 |

#### 🎯 检验标准

- 能用 Python 写一个带 CLI 的工具脚本（如文件批处理）
- 能设计一个电商系统的数据库表结构并写出常用查询
- LeetCode 中等难度能独立完成

---

### 第二阶段：后端工程能力（1-2 个月）

#### 学习内容

```
FastAPI/Flask → RESTful API 设计 → Docker → 一个完整后端项目
```

#### 具体目标

| 模块 | 要达到的程度 | 推荐资源 |
|------|-------------|----------|
| Web 框架 | FastAPI（推荐）或 Flask，理解中间件、依赖注入、异常处理 | FastAPI 官方文档 |
| API 设计 | RESTful 规范、状态码、分页、版本管理、OpenAPI/Swagger 文档 | 《RESTful API 设计指南》 |
| 认证鉴权 | JWT、OAuth2.0、Session vs Token | Auth0 官方教程 |
| 数据库 ORM | SQLAlchemy / Prisma，理解连接池、事务、迁移 | SQLAlchemy 文档 |
| 测试 | pytest、fixture、mock、集成测试 | pytest 官方文档 |
| Docker | Dockerfile、docker-compose、多阶段构建、镜像优化 | Docker 官方 Get Started |
| CI/CD | GitHub Actions：自动测试 + 自动部署 | GitHub Actions 文档 |

#### 🎯 项目实战

**做一个"REST API 模板项目"：**
- FastAPI + PostgreSQL + Redis
- 用户注册/登录（JWT 认证）
- CRUD 接口 + 分页 + 过滤 + 排序
- Docker Compose 一键启动
- GitHub Actions 自动跑测试
- OpenAPI 自动生成接口文档

---

### 第三阶段：LLM 基础（3-4 周）🔥 核心

#### 学习内容

```
OpenAI API → Prompt Engineering 系统化 → 结构化输出 → Embedding
```

#### 具体目标

| 模块 | 要达到的程度 | 推荐资源 |
|------|-------------|----------|
| LLM 原理 | 理解 Token、温度、Top-P、System/User/Assistant 消息角色 | [DeepLearning.AI Short Courses](https://www.deeplearning.ai/short-courses/)（免费） |
| Prompt Engineering | 少样本学习、思维链（CoT）、角色设定、格式约束 | [ChatGPT Prompt Engineering for Developers](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/) |
| Function Calling | 定义 JSON Schema、让 LLM 选择工具并传参、处理调用结果 | OpenAI Cookbook / Function Calling 章节 |
| 结构化输出 | JSON Mode、Pydantic 校验、重试策略 | Instructor 库（Python） |
| Embedding | 文本→向量、余弦相似度、语义搜索原理 | [Understanding Embeddings](https://platform.openai.com/docs/guides/embeddings) |
| Token 计费 | 理解 input/output token 定价、上下文窗口限制、tokenizer | OpenAI Pricing 页面 + tiktoken |

#### 🎯 检验标准

- 能写一个带 System Prompt 的专业对话机器人
- 能用 Function Calling 让 LLM 查询数据库并返回结果
- 能计算任意一段文本的 token 数量和 API 费用
- 理解什么时候用 Embedding、什么时候用 Fine-tuning

---

### 第四阶段：RAG 全链路（4-6 周）🔥 最核心

#### 学习内容

```
文本分块策略 → Embedding → 向量数据库 → 检索+重排 → 生成 → 评估
```

**这是 JD 中出现率 68% 的技能，必须深入！**

#### RAG 全链路分解

| 环节 | 学什么 | 常用工具 | 关键决策点 |
|------|--------|----------|------------|
| 文档解析 | PDF/Word/HTML/Markdown 解析、表格提取 | PyMuPDF, Unstructured, LangChain Document Loaders | 格式兼容性 vs 解析精度 |
| 文本分块 | 固定大小分块、语义分块、递归分块、父子文档 | LangChain Text Splitters, LlamaIndex Node Parser | 块大小影响检索精度和召回率 |
| Embedding | 文本转向量、模型选型、批量处理 | OpenAI text-embedding-3, Cohere Embed, BGE, Jina | 中文效果、维度、价格 |
| 向量存储 | 索引构建、ANN 搜索、元数据过滤、混合检索 | Milvus, Chroma, Pinecone, Weaviate, FAISS | 规模、部署方式、过滤能力 |
| 检索优化 | 混合检索（BM25+向量）、重排序、查询改写、HyDE | BM25, Cohere Rerank, LLM 查询扩展 | 精度 vs 延迟 |
| 生成 | 带上下文的 LLM 调用、引用溯源、幻觉检测 | OpenAI, Claude, 开源模型 | 处理长上下文的策略 |
| 评估 | 检索评估（MRR/NDCG）、生成评估（忠实度/相关性） | RAGAS, LangSmith | 自动化评估 pipeline |

#### 🎯 项目实战

**做一个"公司内部文档问答系统"：**

```
用户上传 PDF/Word
    ↓
文档解析 → 文本分块 → Embedding → 存入向量库
    ↓
用户提问 → 查询改写 → 混合检索 → 重排序
    ↓
取 Top-K 相关片段 → LLM 生成回答 + 引用原文链接
```

**关键功能：**
- 支持多文档上传和管理
- 对话历史 + 上下文窗口管理
- 答案引用溯源（标注来自哪个文档哪一页）
- 流式输出（SSE）

---

### 第五阶段：Agent 开发（4-6 周）🔥 最核心

#### 学习内容

```
Function Calling → ReAct 模式 → 工具定义 → 记忆系统 → 多 Agent 编排
```

**JD 中 56%+ 要求的核心能力！**

#### Agent 核心概念

```
Agent = LLM（大脑）+ 工具（手）+ 记忆（经验）+ 规划（决策）
```

#### 具体模块

| 模块 | 学什么 | 说明 |
|------|--------|------|
| **Agent 本质** | 理解 Agent 的四个组件：推理、工具、记忆、规划 | 推荐读 Anthropic 的 [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) |
| **ReAct 模式** | Thought → Action → Observation → Thought... 循环推理 | 读原始论文《ReAct: Synergizing Reasoning and Acting in Language Models》 |
| **Tool Calling** | 定义工具 Schema、让 LLM 选择调用时机和参数、错误处理 | LangChain Tools, OpenAI Function Calling |
| **MCP 协议** | Anthropic 的 Model Context Protocol，标准化的工具/资源/提示接入 | [MCP 官方文档](https://modelcontextprotocol.io/) |
| **记忆系统** | 短期记忆（上下文窗口管理、摘要压缩）<br>长期记忆（向量化存储、用户画像、知识图谱） | LangChain Memory, Mem0, Zep |
| **多 Agent 编排** | 主 Agent 拆解任务 → 分发给子 Agent → 汇总结果 → 反馈迭代 | LangGraph, AutoGen, CrewAI |
| **安全防护** | Prompt Injection 防御、输入输出过滤、权限隔离、内容审核 | OWASP LLM Top 10 |

#### Agent 框架对比

| 框架 | 特点 | 适用场景 |
|------|------|----------|
| **LangChain + LangGraph** | 41% JD 出现，生态最全，图结构编排 | 复杂工作流、多 Agent 协作 |
| **AutoGen** | 微软出品，对话式多 Agent | 多 Agent 对话、协作编程 |
| **CrewAI** | 角色扮演式多 Agent | 任务委派、团队协作模拟 |
| **Dify / Coze** | 低代码平台，快速原型 | 快速验证想法、非技术人员使用 |
| **OpenAI Agents SDK** | OpenAI 官方，轻量级 | 简单 Agent 场景 |

#### 🎯 项目实战

**做一个"求职助手 Agent"：**

```
用户上传简历
    ↓
主 Agent: 分析用户意图（"帮我找杭州 AI 岗位"）
    ↓
    ├── 搜索 Agent：调用 BOSS API 搜索相关岗位
    ├── 解析 Agent：提取 JD 中的技能要求
    ├── 匹配 Agent：对比简历与 JD，打分
    └── 建议 Agent：生成简历优化建议和技能补齐方案
    ↓
汇总所有 Agent 结果 → 生成综合报告
```

**关键功能：**
- 支持多轮对话（"只看大厂的"、"薪资 25K 以上"）
- Agent 自主选择工具（搜索、解析、匹配）
- 记忆用户偏好（行业、薪资、区域）
- 流式输出过程（用户能看到 Agent 的"思考"）

---

### 第六阶段：前端 + 全栈（可选，4-6 周）

#### 学习内容

```
React → TypeScript → Next.js → 前后端联调 → AI Chat UI
```

#### 具体目标

| 模块 | 要达到的程度 | 推荐资源 |
|------|-------------|----------|
| React 基础 | 组件、Hooks（useState/useEffect/useContext）、状态管理 | [React 官方教程](https://react.dev/learn) |
| TypeScript | 类型注解、泛型、工具类型（Partial/Pick/Omit） | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) |
| Next.js | App Router、SSR/SSG、API Routes、Server Actions | [Next.js 官方教程](https://nextjs.org/learn) |
| AI 前端 | 流式输出（SSE/ReadableStream）、Markdown 渲染、对话 UI | Vercel AI SDK、shadcn/ui |

#### 🎯 项目实战

**做一个 AI Chat UI：**
- 对话列表（多会话管理）
- Markdown 渲染 + 代码高亮
- 流式打字效果（逐字输出）
- 暗色/亮色主题切换
- 响应式布局（移动端适配）

---

### 第七阶段：架构 & 工程化（持续学习）

#### 学习内容

```
微服务设计 → 分布式基础 → 高并发 → 可观测性 → 安全 → LLMOps
```

50% JD 提到系统设计，44% 提到安全。这是从"能做"到"做得好"的分水岭。

#### 具体模块

| 模块 | 核心知识 | 推荐资源 |
|------|---------|----------|
| **系统设计** | CAP 定理、一致性模型、缓存策略、负载均衡、限流熔断、数据库分库分表 | 《Designing Data-Intensive Applications》（DDIA） |
| **分布式** | Raft/Paxos、分布式事务、消息队列、事件驱动架构 | 《数据密集型应用系统设计》 |
| **高并发** | 连接池、异步非阻塞、缓存穿透/雪崩/击穿、读写分离 | ByteByteGo 系统设计 |
| **可观测性** | 日志（ELK）、指标（Prometheus+Grafana）、链路追踪（Jaeger）、LLM 调用追踪 | OpenTelemetry + LangSmith |
| **安全** | Prompt Injection 防御、输入输出过滤、RBAC/ABAC、数据脱敏、HTTPS/TLS | OWASP LLM Top 10、NIST AI 安全框架 |
| **LLMOps** | 模型版本管理、A/B 测试、评估 pipeline、成本监控、延迟优化 | MLflow、LangSmith、Weights & Biases |

#### 🎯 检验标准

- 能设计一个日均百万级请求的 AI 应用架构图
- 能说出 Prompt Injection 的 5 种攻击方式和对应防御
- 能搭建完整的日志-指标-追踪可观测性体系

---

## 🎯 三条学习路径

### 🚀 快速路径：3 个月（适合 3 年+ 后端开发）

> 你的优势：后端工程能力、系统设计、数据库经验都已具备。

| 月份 | 重点 | 产出 |
|------|------|------|
| **第 1 月** | Prompt Engineering → RAG 全链路（文档解析→分块→向量库→检索→生成） | 一个文档问答系统 |
| **第 2 月** | Agent 框架（LangChain/LangGraph）→ Tool Calling → MCP → 记忆系统 | 一个求职助手 Agent |
| **第 3 月** | 多 Agent 编排 → 模型部署基础 → 刷系统设计 → 投简历 | 完整的 AI Agent 项目作品集 |

### 📚 标准路径：6 个月（适合 1-2 年开发经验）

| 月份 | 重点 |
|------|------|
| **第 1 月** | Python 进阶 + Linux + 数据库 |
| **第 2 月** | FastAPI + Docker + 后端项目实战 |
| **第 3 月** | LLM 基础 + Prompt Engineering |
| **第 4-5 月** | RAG 全链路深入 |
| **第 5-6 月** | Agent 开发 + 多 Agent + 项目作品集 |

### 🧱 完整路径：12 个月（适合零基础转行）

| 月份 | 重点 |
|------|------|
| **第 1-2 月** | Python + Linux + Git + 数据库 |
| **第 3-4 月** | 后端工程（FastAPI + Docker + 项目） |
| **第 5 月** | LLM 基础 + Prompt Engineering |
| **第 6-7 月** | RAG 全链路 |
| **第 8-9 月** | Agent 开发 + 多 Agent 编排 |
| **第 10 月** | 前端基础（React + TypeScript） |
| **第 11-12 月** | 架构 + 系统设计 + LLMOps + 项目打磨 |

---

## 📚 推荐学习资源汇总

### 书籍

| 书名 | 阶段 | 说明 |
|------|------|------|
| 《流畅的 Python》 | 第一阶段 | Python 进阶必读 |
| 《SQL 必知必会》 | 第一阶段 | SQL 快速入门 |
| 《鸟哥的 Linux 私房菜》 | 第一阶段 | Linux 基础 |
| 《数据密集型应用系统设计》（DDIA） | 第七阶段 | 分布式系统圣经 |
| 《Designing Machine Learning Systems》 | 第七阶段 | ML 系统工程化 |
| 《Building LLM Apps》 | 第三-五阶段 | LLM 应用开发实战 |

### 在线课程

| 课程 | 阶段 | 说明 |
|------|------|------|
| [DeepLearning.AI Short Courses](https://www.deeplearning.ai/short-courses/) | 第三-五阶段 | **免费**，涵盖 Prompt/Embedding/RAG/Agent/LangChain |
| [FastAPI 官方教程](https://fastapi.tiangolo.com/tutorial/) | 第二阶段 | 最好的 FastAPI 学习资源 |
| [React 官方教程](https://react.dev/learn) | 第六阶段 | React 入门最佳路径 |
| [Next.js Learn](https://nextjs.org/learn) | 第六阶段 | Next.js 官方互动教程 |
| [ByteByteGo](https://bytebytego.com/) | 第七阶段 | 系统设计图解 |

### 官方文档 & 动手实践

| 资源 | 用途 |
|------|------|
| [OpenAI Cookbook](https://cookbook.openai.com/) | Prompt/Embedding/Function Calling 实战代码 |
| [LangChain 文档](https://python.langchain.com/) | RAG + Agent 开发文档 |
| [LangGraph 文档](https://langchain-ai.github.io/langgraph/) | 多 Agent 工作流编排 |
| [LlamaIndex 文档](https://docs.llamaindex.ai/) | RAG 框架替代方案 |
| [Anthropic MCP 文档](https://modelcontextprotocol.io/) | Agent 工具调用标准协议 |
| [Milvus 文档](https://milvus.io/docs/) | 向量数据库 |
| [Docker Get Started](https://docs.docker.com/get-started/) | Docker 入门 |

### 实战项目灵感

| 项目 | 涉及技能 | 难度 |
|------|---------|------|
| 公司内部文档问答 | RAG、Embedding、向量库、分块策略 | ⭐⭐ |
| 个人求职助手 Agent | Agent、Tool Calling、记忆、多 Agent | ⭐⭐⭐ |
| AI Chat UI 全栈应用 | React、Next.js、流式输出、SSE | ⭐⭐ |
| 智能客服系统 | RAG + Agent + 工单系统集成 | ⭐⭐⭐ |
| GitHub Issue 自动分类机器人 | Agent + API 集成 + Webhook | ⭐⭐ |
| BOSS 直聘爬虫 + AI 分析 | 爬虫 + RAG + 数据分析 | ⭐⭐⭐ |

---

## 📊 杭州 AI Agent 岗位 JD · 原始数据统计

> 数据来源：2026.08.11 爬取，共 34 条详情。

### 公司分布

阿里巴巴集团（3）、华为（2），其余集中在中小型科技公司（链坊科技、九州云腾、维妥科技、一知智能、每日互动等）。

### 薪资分布

- 主流区间：**20-30K**（最常见）
- 高薪区间：**25-50K** × 14/15/16薪（大厂标配）
- 顶级薪资：**50-65K**（猎头稀缺岗位，需极深 Agent 经验）
- 薪资中位数约 **25K**

### 经验和学历要求

- 经验：**3-5 年**（81/90，90%）绝对主流
- 学历：**本科**（85/90，94%），硕士仅有 2 个岗位明文要求

### 区域分布

余杭区（阿里/字节所在）> 滨江区 > 西湖区

---

## 💡 关键认知

1. **AI Agent 不等于调 API。** 65%+ JD 要求 Tool Calling、Agent 框架、多 Agent 协作、记忆系统——这些都是超越简单 API 调用的深度工程能力。

2. **Python 是门票，后端能力是基本功。** 74% JD 明确要求后端开发能力。只会 Python 调 API 不够，需要扎实的工程基础。

3. **RAG 是基石。** 68% JD 要求 RAG，这是 LLM 应用最成熟的落地模式，必须深入每个环节。

4. **全栈是加分项。** 29% JD 要求全栈，41% 要求 React。前端能力让你在候选池中脱颖而出。

5. **系统设计和安全是晋升阶梯。** 50% JD 提到系统设计，44% 提到安全。这是 mid-level → senior 的分水岭。

6. **作品集 > 证书。** AI Agent 领域最看实战项目。一个完整的、能跑通的多 Agent 应用比任何证书都有说服力。

---

## 📐 AI Agent / RAG 系统评测指南

> 以下内容从 34 条真实 JD 中提取的评测相关要求整理而来。  
> 126 条 JD 片段直接提到了评测、质量、效果、指标——评测能力是 AI Agent 工程师的必修课。

### 一、JD 中最常出现的评测指标

从真实的杭州 AI Agent JD 中提取，企业实际考核的指标：

#### 1.1 任务执行质量

| 指标 | 说明 | 典型目标 |
|------|------|----------|
| **任务完成率** | Agent 独立完成用户任务的比例（无需人工介入） | > 85% |
| **回答准确率** | 生成答案的事实正确性 | > 90% |
| **工具选择正确率** | Agent 是否选了正确的 Tool/Function | > 90% |
| **参数正确率** | 调用工具时传参是否正确 | > 85% |
| **推荐采纳率** | 用户实际采纳 Agent 推荐结果的比例 | > 60% |

#### 1.2 安全与可靠性

| 指标 | 说明 | 典型目标 |
|------|------|----------|
| **幻觉率** | 生成内容中包含虚假/编造信息的比例 | < 5% |
| **人工兜底率** | 需要转人工处理的比例 | < 15% |
| **异常率** | 系统异常/错误的请求比例 | < 1% |
| **投诉率** | 用户投诉的比例 | < 0.5% |

#### 1.3 效率与成本

| 指标 | 说明 | 典型目标 |
|------|------|----------|
| **Token 消耗** | 单次任务的平均 Token 用量 | 持续优化 |
| **响应延迟** | 端到端响应时间（含 LLM 推理） | P95 < 5s |
| **人工交付效率提升** | 引入 Agent 后人工效率提升比例 | > 30% |
| **ROI / 付费转化率** | Agent 对业务收入的贡献 | 持续跟踪 |

#### 1.4 RAG 专项指标

| 指标 | 说明 |
|------|------|
| **检索命中率（Recall@K）** | Top-K 片段中包含正确答案的比例 |
| **检索精确率（Precision@K）** | Top-K 片段中相关片段的比例 |
| **MRR（Mean Reciprocal Rank）** | 第一个正确答案的平均排名倒数 |
| **NDCG** | 考虑排序位置的归一化折损累积增益 |
| **答案忠实度（Faithfulness）** | 生成的答案是否基于检索到的上下文（非编造） |
| **答案相关性（Answer Relevance）** | 生成的答案与问题的相关程度 |
| **上下文召回率（Context Recall）** | 检索到的上下文是否能支持 ground truth 答案 |
| **上下文精确率（Context Precision）** | 检索到的上下文中相关信息的比例 |

---

### 二、评测体系架构（来自真实 JD 要求）

以下架构综合了阿里云、深睿医疗、乌鸫科技、正晔集团等公司 JD 中的要求：

```
                         ┌─────────────────────────────┐
                         │      AI Agent 评测体系        │
                         └─────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼──────┐            ┌──────▼──────┐            ┌──────▼──────┐
    │  离线评测    │            │   在线评测    │            │  人工评测    │
    │ (Offline)   │            │  (Online)    │            │  (Human)    │
    └─────┬──────┘            └──────┬──────┘            └──────┬──────┘
          │                           │                           │
  ┌───────┼───────────┐     ┌────────┼───────────┐     ┌─────────┼─────────┐
  │       │           │     │        │           │     │         │         │
  ▼       ▼           ▼     ▼        ▼           ▼     ▼         ▼         ▼
基准测试  A/B对比    回归   线上指标  用户行为   BadCase  专家评审  众包标注  A/B实验
Benchmark 评测      测试   Dashboard 分析       分析
```

#### 2.1 离线评测（上线前）

**（1）基准测试集（Benchmark Dataset）**

```python
# 示例：Agent 评测数据集结构
eval_dataset = [
    {
        "id": "eval_001",
        "user_query": "帮我查一下上周杭州AI Agent岗位的平均薪资",
        "expected_tools": ["search_jobs", "calculate_average"],
        "expected_params": {"keyword": "AI Agent", "city": "杭州", "date_range": "last_week"},
        "expected_answer_contains": ["平均薪资", "25K"],
        "ground_truth": "杭州AI Agent岗位上周平均薪资约25K",
        "difficulty": "medium",
        "category": "数据查询"
    },
    # ... 更多用例
]
```

**（2）RAG 评测流程**

```python
# RAG 评测示例（使用 RAGAS 框架）
from ragas import evaluate
from ragas.metrics import (
    faithfulness,          # 答案忠实度：回答是否基于检索内容
    answer_relevancy,      # 答案相关性：回答是否切题
    context_recall,        # 上下文召回：检索是否覆盖了答案所需信息
    context_precision,     # 上下文精确率：检索结果中相关信息的比例
    context_entity_recall, # 实体召回：关键实体的召回情况
)

# 评测数据集
from datasets import Dataset

eval_data = Dataset.from_dict({
    "question": [
        "Python在AI Agent开发中的优势是什么？",
        "如何优化RAG系统的检索效果？",
        "LangChain和LlamaIndex有什么区别？",
    ],
    "answer": [
        "Python拥有最丰富的AI/ML生态系统...",
        "可以通过混合检索、重排序、查询改写等方式优化...",
        "LangChain侧重Agent和工作流编排，LlamaIndex侧重数据索引...",
    ],
    "contexts": [
        ["Python是AI开发的主流语言，拥有TensorFlow、PyTorch等框架..."],
        ["RAG优化策略包括：1.混合检索 2.重排序 3.查询改写..."],
        ["LangChain提供Agent框架，LlamaIndex提供数据连接框架..."],
    ],
    "ground_truth": [
        "Python拥有丰富的AI库和框架生态，语法简洁，社区活跃",
        "优化RAG的关键策略包括混合检索、重排序和查询改写",
        "LangChain聚焦Agent编排，LlamaIndex聚焦数据索引和检索",
    ],
})

# 运行评测
result = evaluate(eval_data, metrics=[
    faithfulness,
    answer_relevancy,
    context_recall,
    context_precision,
])
print(result)
# 输出各指标的分数和平均值
```

**（3）Agent 评测流程**

```python
# Agent 评测示例（概念代码）
class AgentEvaluator:
    """Agent 评测器 - 从多家公司 JD 中提取的模式"""

    def __init__(self):
        self.metrics = {
            "tool_selection_accuracy": [],   # 工具选择正确率
            "param_accuracy": [],             # 参数正确率
            "task_completion_rate": [],       # 任务完成率
            "hallucination_rate": [],         # 幻觉率
            "avg_token_usage": [],            # 平均 Token 消耗
            "avg_latency": [],                # 平均延迟
        }

    def evaluate_single(self, test_case):
        """评测单个测试用例"""
        # 1. 运行 Agent
        result = run_agent(test_case["user_query"])

        # 2. 工具选择正确性
        if "expected_tools" in test_case:
            actual_tools = [t["name"] for t in result["tool_calls"]]
            self.metrics["tool_selection_accuracy"].append(
                actual_tools == test_case["expected_tools"]
            )

        # 3. 参数正确性
        if "expected_params" in test_case:
            for tool_call in result["tool_calls"]:
                tool_name = tool_call["name"]
                actual_params = tool_call["params"]
                expected = test_case["expected_params"].get(tool_name, {})
                param_match = all(
                    str(actual_params.get(k)) == str(v)
                    for k, v in expected.items()
                )
                self.metrics["param_accuracy"].append(param_match)

        # 4. 幻觉检测
        if "ground_truth" in test_case:
            hallucination_score = detect_hallucination(
                result["answer"],
                test_case["ground_truth"],
                result.get("retrieved_contexts", [])
            )
            self.metrics["hallucination_rate"].append(hallucination_score)

        # 5. 成本与延迟
        self.metrics["avg_token_usage"].append(result["token_usage"])
        self.metrics["avg_latency"].append(result["latency"])

        # 6. 任务完成判定
        if "expected_answer_contains" in test_case:
            all_found = all(
                keyword in result["answer"]
                for keyword in test_case["expected_answer_contains"]
            )
            self.metrics["task_completion_rate"].append(all_found)

        return self.metrics

    def generate_report(self):
        """生成评测报告"""
        report = {
            "tool_selection_accuracy": sum(self.metrics["tool_selection_accuracy"]) / len(self.metrics["tool_selection_accuracy"]) if self.metrics["tool_selection_accuracy"] else None,
            "param_accuracy": sum(self.metrics["param_accuracy"]) / len(self.metrics["param_accuracy"]) if self.metrics["param_accuracy"] else None,
            "task_completion_rate": sum(self.metrics["task_completion_rate"]) / len(self.metrics["task_completion_rate"]) if self.metrics["task_completion_rate"] else None,
            "hallucination_rate": sum(self.metrics["hallucination_rate"]) / len(self.metrics["hallucination_rate"]) if self.metrics["hallucination_rate"] else None,
            "avg_token_usage": sum(self.metrics["avg_token_usage"]) / len(self.metrics["avg_token_usage"]) if self.metrics["avg_token_usage"] else None,
            "avg_latency_ms": sum(self.metrics["avg_latency"]) / len(self.metrics["avg_latency"]) if self.metrics["avg_latency"] else None,
        }
        return report
```

#### 2.2 在线评测（上线后监控）

**JD 中明确要求的监控指标和工具：**

| 监控维度 | 工具推荐 | 说明 |
|----------|---------|------|
| LLM 调用追踪 | LangSmith / Langfuse | 记录每次 LLM 调用的输入/输出/延迟/Token |
| Agent 轨迹回放 | LangGraph Studio / 自建 | 回放 Agent 的每一步决策过程 |
| 线上指标大盘 | Grafana + Prometheus | 实时监控任务成功率、延迟、错误率 |
| 成本监控 | 自建 + API 账单 | 按模型/用户/任务维度的成本归因 |
| Bad Case 收集 | 自建数据库 | 自动/手动收集失败案例，形成回归测试集 |

```python
# Langfuse 集成示例
from langfuse import Langfuse
from langfuse.decorators import observe

langfuse = Langfuse()

@observe()
async def agent_run(user_query: str):
    """带完整追踪的 Agent 执行"""
    # Langfuse 自动记录：输入、输出、延迟、Token 用量
    # 如果出错，也会记录错误信息
    result = await agent.execute(user_query)

    # 手动记录业务指标
    langfuse.score(
        trace_id=result.trace_id,
        name="task_completed",
        value=1.0 if result.success else 0.0,
    )
    return result
```

#### 2.3 Bad Case 分析流程（来自中科昊萌 JD 的明确要求）

```
发现 Bad Case
      │
      ▼
┌─────────────────────────────────────────┐
│  问题归因：区分问题来源                    │
│  ├── 业务规则问题（P0）- 修改业务逻辑      │
│  ├── 上下文问题（P1）- 调整 Prompt/记忆    │
│  ├── Prompt 问题（P1）- Prompt 工程优化    │
│  ├── 工具定义问题（P2）- 修改 Tool Schema  │
│  ├── 模型能力问题（P2）- 考虑模型升级      │
│  ├── 后端数据问题（P2）- 修复数据源        │
│  └── 前端交互问题（P3）- 改进 UI/UX       │
└─────────────────────────────────────────┘
      │
      ▼
加入回归测试集 → 修复 → 重新评测 → 确认修复
```

```python
# Bad Case 管理示例
bad_case = {
    "id": "bc_20260812_001",
    "user_query": "帮我找一个25K以上的AI Agent岗位",
    "agent_response": "抱歉，我无法理解您的问题",  # 错误输出
    "expected_response": "找到3个25K以上的AI Agent岗位...",
    "agent_trace": {
        "tools_called": [],
        "error": "Tool 'search_jobs' not found",  # 工具调用失败
        "reasoning_steps": [...],
    },
    "root_cause": "工具定义问题",  # 归因分类
    "severity": "P1",
    "status": "待修复",
    "fix_commit": None,
    "added_to_regression": False,
}
```

---

### 三、评测工具链全景

```
┌────────────────────────────────────────────────────────────────────┐
│                        AI Agent 评测工具链                           │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│   RAG 评测    │  Agent 评测   │  追踪/监控    │   A/B 实验            │
├──────────────┼──────────────┼──────────────┼───────────────────────┤
│ RAGAS        │ LangSmith    │ Langfuse     │ 自建 A/B 平台         │
│ TruLens      │ AgentBench   │ LangSmith    │ LaunchDarkly          │
│ DeepEval     │ AgentEval    │ OpenTelemetry│ Statsig               │
│ ARES         │ BEE (自建)    │ Prometheus   │ 灰度发布 + Feature Flag│
│ RagEval      │ 自定义 Benchmark│ Grafana     │                       │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

#### 各工具选型建议

| 工具 | 适用场景 | 上手难度 | 费用 |
|------|---------|---------|------|
| **RAGAS** | RAG 系统的标准评测，开箱即用 | ⭐ 低 | 开源免费 |
| **DeepEval** | RAG + LLM 评测，指标丰富 | ⭐ 低 | 开源免费 |
| **LangSmith** | Agent 全链路追踪、评测、Prompt 管理 | ⭐⭐ 中 | 免费层 + 付费 |
| **Langfuse** | 开源替代 LangSmith，自部署 | ⭐⭐ 中 | 开源免费/云付费 |
| **TruLens** | RAG 应用的反馈评测 | ⭐⭐ 中 | 开源免费 |
| **MLflow** | 模型实验管理 + LLM 评测 | ⭐⭐⭐ 高 | 开源免费 |

---

### 四、实战：搭建一个最小的 Agent 评测 Pipeline

```python
"""
最小的 Agent 评测流水线
从零搭建，覆盖：数据 → 运行 → 评分 → 报告
"""

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvalCase:
    """评测用例"""
    id: str
    query: str
    expected_tools: list[str] = field(default_factory=list)
    expected_keywords: list[str] = field(default_factory=list)
    ground_truth: str = ""
    category: str = "general"


@dataclass
class EvalResult:
    """评测结果"""
    case_id: str
    passed: bool
    tool_match: bool = False
    keyword_match: bool = False
    hallucination_score: float = 0.0
    latency_ms: float = 0.0
    token_usage: int = 0
    notes: str = ""


class MinimalEvalPipeline:
    """最小评测流水线"""

    def __init__(self, agent_fn):
        self.agent_fn = agent_fn  # 被评测的 Agent 函数
        self.test_cases: list[EvalCase] = []
        self.results: list[EvalResult] = []

    def add_case(self, case: EvalCase):
        self.test_cases.append(case)

    def load_cases_from_json(self, path: str):
        """从 JSON 文件加载评测集"""
        with open(path) as f:
            data = json.load(f)
        for item in data:
            self.add_case(EvalCase(**item))

    def run(self) -> list[EvalResult]:
        """运行全部评测"""
        import time

        for case in self.test_cases:
            start = time.time()
            try:
                result = self.agent_fn(case.query)
                latency = (time.time() - start) * 1000

                # 1. 关键词检查
                keyword_match = all(
                    kw in result.get("answer", "")
                    for kw in case.expected_keywords
                )

                # 2. 工具检查
                actual_tools = [t.get("name", "") for t in result.get("tool_calls", [])]
                tool_match = set(case.expected_tools) == set(actual_tools)

                # 3. 幻觉评分（简化版：检查回答是否基于检索内容）
                h_score = self._simple_hallucination_check(
                    result.get("answer", ""),
                    result.get("contexts", []),
                )

                ev = EvalResult(
                    case_id=case.id,
                    passed=keyword_match and tool_match,
                    tool_match=tool_match,
                    keyword_match=keyword_match,
                    hallucination_score=h_score,
                    latency_ms=latency,
                    token_usage=result.get("token_usage", 0),
                )
            except Exception as e:
                ev = EvalResult(
                    case_id=case.id,
                    passed=False,
                    notes=f"执行异常: {str(e)}",
                )
            self.results.append(ev)

        return self.results

    def report(self) -> dict:
        """生成评测报告"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        return {
            "总用例": total,
            "通过": passed,
            "通过率": f"{passed/total*100:.1f}%" if total else "N/A",
            "工具正确率": f"{sum(1 for r in self.results if r.tool_match)/total*100:.1f}%" if total else "N/A",
            "关键词命中率": f"{sum(1 for r in self.results if r.keyword_match)/total*100:.1f}%" if total else "N/A",
            "平均延迟(ms)": f"{sum(r.latency_ms for r in self.results)/total:.0f}" if total else "N/A",
            "总Token": sum(r.token_usage for r in self.results),
        }

    def _simple_hallucination_check(self, answer: str, contexts: list[str]) -> float:
        """简化版幻觉检测：如果答案中的关键实体不在上下文中，可能是幻觉"""
        if not contexts:
            return 0.0
        combined_context = " ".join(contexts).lower()
        # 提取答案中的英文大写词（通常是专有名词/技术术语）
        import re
        entities = set(re.findall(r'\b[A-Z][a-zA-Z]{2,}\b', answer))
        if not entities:
            return 1.0  # 没有可检查的实体，假设无幻觉
        found = sum(1 for e in entities if e.lower() in combined_context)
        return found / len(entities) if entities else 1.0


# ============================================================
# 使用示例
# ============================================================

# 你的 Agent 函数
def my_agent(query: str) -> dict:
    """这是一个示例，替换为你的实际 Agent"""
    # 实际项目中，这里调用你的 LangChain/LangGraph Agent
    return {
        "answer": "...",
        "tool_calls": [{"name": "search", "params": {}}],
        "contexts": ["..."],
        "token_usage": 1500,
    }


# 组装评测流水线
pipeline = MinimalEvalPipeline(my_agent)

# 添加评测用例
pipeline.add_case(EvalCase(
    id="case_001",
    query="杭州AI Agent岗位平均薪资是多少？",
    expected_tools=["search_jobs"],
    expected_keywords=["AI Agent", "薪资"],
    category="数据查询",
))

pipeline.add_case(EvalCase(
    id="case_002",
    query="帮我找5个Python后端的AI Agent岗位，要求薪资25K以上",
    expected_tools=["search_jobs", "filter_by_salary"],
    expected_keywords=["25K", "Python"],
    category="多条件筛选",
))

pipeline.add_case(EvalCase(
    id="case_003",
    query="我的简历里缺什么技能？（上传了一份Python后端简历）",
    expected_tools=["parse_resume", "compare_with_jd", "suggest_skills"],
    expected_keywords=["建议", "技能"],
    category="简历分析",
))

# 运行评测
results = pipeline.run()

# 输出报告
import pprint
pprint.pprint(pipeline.report())

# 输出失败用例
for r in pipeline.results:
    if not r.passed:
        print(f"❌ {r.case_id}: {r.notes}")
```

---

### 五、不同阶段的评测策略

#### 开发阶段（你一个人写代码）

```
目标：快速验证功能是否正常
┌─────────────────────────────────────────┐
│ 1. 手工跑 10-20 个核心场景                │
│ 2. 用 print/logger 检查中间结果          │
│ 3. 关注：能不能跑通？输出格式对不对？       │
│ 4. 记录遇到的 Bad Case                   │
└─────────────────────────────────────────┘
```

#### 提测阶段（准备给其他人用）

```
目标：确保基本质量，不出严重问题
┌─────────────────────────────────────────┐
│ 1. 建立 50-100 条结构化评测集             │
│ 2. 每个 commit 自动跑评测                 │
│ 3. 关注：工具正确率 > 80%，幻觉率 < 10%   │
│ 4. 建立 Bad Case 库，每次新的 Bad Case 加入回归 │
└─────────────────────────────────────────┘
```

#### 上线阶段（真实用户使用）

```
目标：线上质量可控，问题可追溯
┌─────────────────────────────────────────┐
│ 1. LangSmith/Langfuse 追踪全量调用        │
│ 2. 线上指标大盘：任务成功率、延迟、成本    │
│ 3. 灰度发布：先 5% → 20% → 100%          │
│ 4. A/B 实验对比新旧版本                    │
│ 5. 用户反馈 + 人工抽检                     │
└─────────────────────────────────────────┘
```

---

### 六、面试中的评测问题（来自真实 JD）

以下是 JD 中透露的公司面试可能考察的评测能力：

| 问题类型 | 示例 | 考察点 |
|----------|------|--------|
| **指标设计** | "如何设计一个Agent系统的评测指标？" | 理解业务目标和量化方法 |
| **RAG评测** | "RAG系统有哪些评测维度？如何测量检索质量和生成质量？" | RAGAS指标理解 |
| **幻觉检测** | "如何检测和降低Agent的幻觉？" | 多维度幻觉治理方案 |
| **Bad Case分析** | "Agent回答错误时，你如何定位问题出在哪个环节？" | 系统归因能力 |
| **A/B实验** | "如何设计一个A/B实验来验证Prompt优化的效果？" | 实验设计+统计学 |
| **成本优化** | "在保证效果的前提下，如何降低Token成本？" | 模型选型+Prompt压缩 |
| **评测体系建设** | "从0到1搭建一个Agent评测体系，你会怎么做？" | 系统性思维+工程能力 |
| **Code Review** | "AI生成的代码如何评估质量？" | 代码质量判断标准 |

---

### 七、推荐资源

| 资源 | 说明 |
|------|------|
| [RAGAS 官方文档](https://docs.ragas.io/) | RAG 评测框架，开箱即用 |
| [LangSmith 文档](https://docs.smith.langchain.com/) | Agent 全链路追踪和评测平台 |
| [Langfuse 文档](https://langfuse.com/docs) | 开源 LLM 可观测性平台 |
| [DeepEval 文档](https://docs.confident-ai.com/) | RAG + LLM 评测，单元测试风格 |
| [TruLens 文档](https://www.trulens.org/) | RAG 应用反馈评测 |
| [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) | LLM 安全风险清单 |
| [Anthropic Eval Guide](https://docs.anthropic.com/en/docs/build-with-claude/eval) | Anthropic 官方评测指南 |
| [OpenAI Evals](https://github.com/openai/evals) | OpenAI 开源的 LLM 评测框架 |
