# Agent 与模型配置重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Templates 模块替换为 Agents + ModelConfigs 模块，支持系统提示词定制、模型配置管理、对话绑定 Agent、两阶段意图检测。

**Architecture:** 新增 `model-configs` 和 `agents` 两个 NestJS 模块；`conversations` 表新增 `agentId`/`activeModelId` 字段；`users` 表新增 `lastAgentId`；`agent.service.ts` 重构为动态模型 + 意图检测；前端替换 Templates 页面为 Agents + Models 页面，对话页新增 Agent/模型切换 Header。

**Tech Stack:** NestJS, TypeORM, PostgreSQL, LangGraph, @langchain/deepseek, React 19, Ant Design, TypeScript, AES-256-GCM (Node.js crypto)

---

## 文件结构规划

### 后端新增/修改

```
server/src/
├── model-configs/
│   ├── model-configs.module.ts          # 新建
│   ├── model-configs.service.ts         # 新建（含 AES-256-GCM 加解密）
│   ├── model-configs.controller.ts      # 新建
│   ├── dto/
│   │   ├── create-model-config.dto.ts   # 新建
│   │   └── update-model-config.dto.ts   # 新建
│   └── entities/
│       └── model-config.entity.ts       # 新建
├── agents/
│   ├── agents.module.ts                 # 新建
│   ├── agents.service.ts                # 新建
│   ├── agents.controller.ts             # 新建
│   ├── dto/
│   │   ├── create-agent.dto.ts          # 新建
│   │   └── update-agent.dto.ts          # 新建
│   └── entities/
│       └── agent.entity.ts              # 新建
├── users/
│   ├── entities/user.entity.ts          # 修改：新增 lastAgentId，移除 templates 关联
│   └── users.service.ts                 # 修改：新增 updateLastAgent()
├── conversations/
│   ├── entities/conversation.entity.ts  # 修改：新增 agentId, activeModelId
│   ├── conversations.service.ts         # 修改：create() 接受 agentId，新增 updateAgent/updateModel
│   ├── conversations.controller.ts      # 修改：create DTO 更新，新增 PATCH model/agent 端点，移除 templateId
│   └── dto/
│       ├── create-conversation.dto.ts   # 修改：新增可选 agentId
│       └── stream-message.dto.ts        # 修改：移除 templateId/variables，无需额外字段
├── agent/
│   ├── agent.service.ts                 # 修改：动态模型实例化 + 意图检测
│   └── graph/conversation-graph.ts      # 修改：支持动态 LLM 实例
├── migrations/                          # 新增迁移文件
├── app.module.ts                        # 修改：注册新模块，移除 TemplatesModule
└── config/database.config.ts            # 不变
```

### 前端新增/修改

```
front/src/
├── types/index.ts                       # 修改：新增 Agent/ModelConfig 类型，移除 Template 类型
├── api/
│   ├── agents.ts                        # 新建
│   ├── model-configs.ts                 # 新建
│   └── conversations.ts                 # 修改：createConversation 接受 agentId，新增 updateAgent/updateModel
├── pages/
│   ├── AgentsPage.tsx                   # 新建（替换 TemplatesPage）
│   ├── ModelsPage.tsx                   # 新建
│   └── ChatPage.tsx                     # 修改：新增 Agent/模型切换 Header，移除 templateId 逻辑
├── components/
│   ├── Sidebar.tsx                      # 修改：模板管理 → Agent 管理 + 模型配置
│   ├── MessageInput.tsx                 # 修改：移除 TemplateSelector 按钮
│   └── ConversationHeader.tsx           # 新建：显示 Agent 名称 + 模型切换
├── contexts/
│   └── AuthContext.tsx                  # 修改：user 包含 lastAgentId
└── App.tsx                              # 修改：路由 /templates→/agents，新增 /models
```

---

## Task 1: 数据库实体与迁移

**Files:**
- Create: `server/src/model-configs/entities/model-config.entity.ts`
- Create: `server/src/agents/entities/agent.entity.ts`
- Modify: `server/src/users/entities/user.entity.ts`
- Modify: `server/src/conversations/entities/conversation.entity.ts`
- Create: `server/src/migrations/[timestamp]-AgentModelConfig.ts`

- [ ] **Step 1: 创建 model-config.entity.ts**

  文件路径: `server/src/model-configs/entities/model-config.entity.ts`

  ```typescript
  import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { User } from '../../users/entities/user.entity';

  @Entity('model_configs')
  export class ModelConfig {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ length: 64 })
    provider: string;

    @Column({ name: 'model_id', length: 128 })
    modelId: string;

    @Column({ length: 128 })
    name: string;

    @Column({ name: 'api_key', type: 'text', nullable: true })
    apiKey: string | null;

    @Column({ name: 'api_key_iv', length: 64, nullable: true })
    apiKeyIv: string | null;

    @Column({ name: 'is_enabled', default: true })
    isEnabled: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
  }
  ```

- [ ] **Step 2: 创建 agent.entity.ts**

  文件路径: `server/src/agents/entities/agent.entity.ts`

  ```typescript
  import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
  } from 'typeorm';
  import { User } from '../../users/entities/user.entity';
  import { ModelConfig } from '../../model-configs/entities/model-config.entity';

  export enum AgentVisibility {
    PRIVATE = 'private',
    PUBLIC = 'public',
  }

  @Entity('agents')
  export class Agent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ length: 128 })
    name: string;

    @Column({ type: 'text', default: '' })
    description: string;

    @Column({ name: 'system_prompt', type: 'text', default: '' })
    systemPrompt: string;

    @Column({ name: 'model_config_id', nullable: true })
    modelConfigId: string | null;

    @ManyToOne(() => ModelConfig, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'model_config_id' })
    modelConfig: ModelConfig | null;

    @Column({
      type: 'enum',
      enum: AgentVisibility,
      default: AgentVisibility.PRIVATE,
    })
    visibility: AgentVisibility;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date | null;
  }
  ```

- [ ] **Step 3: 修改 user.entity.ts，新增 lastAgentId**

  文件路径: `server/src/users/entities/user.entity.ts`

  在现有字段末尾（`updatedAt` 之前）新增：

  ```typescript
  @Column({ name: 'last_agent_id', nullable: true })
  lastAgentId: string | null;
  ```

  同时移除对 `Template` 实体的 `@OneToMany` 关联（如有）。

- [ ] **Step 4: 修改 conversation.entity.ts，新增 agentId 和 activeModelId**

  文件路径: `server/src/conversations/entities/conversation.entity.ts`

  在现有字段末尾新增：

  ```typescript
  @Column({ name: 'agent_id', nullable: true })
  agentId: string | null;

  @ManyToOne(() => Agent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent | null;

  @Column({ name: 'active_model_id', nullable: true })
  activeModelId: string | null;

  @ManyToOne(() => ModelConfig, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'active_model_id' })
  activeModel: ModelConfig | null;
  ```

  同时在文件顶部新增导入：

  ```typescript
  import { Agent } from '../../agents/entities/agent.entity';
  import { ModelConfig } from '../../model-configs/entities/model-config.entity';
  ```

- [ ] **Step 5: 生成并运行迁移**

  运行: `cd server && pnpm migration:generate src/migrations/AgentModelConfig`

  预期输出: 生成 `server/src/migrations/[timestamp]-AgentModelConfig.ts`，包含 `model_configs`、`agents` 表的 CREATE，以及 `users`、`conversations` 表的 ALTER ADD COLUMN。

  运行: `pnpm migration:run`

  预期输出: `Migration AgentModelConfig[timestamp] has been executed successfully.`

- [ ] **Step 6: 提交**

  ```bash
  git add server/src/model-configs/entities/ server/src/agents/entities/ server/src/users/entities/user.entity.ts server/src/conversations/entities/conversation.entity.ts server/src/migrations/
  git commit -m "feat(db): add ModelConfig/Agent entities and migration"
  ```

---

## Task 2: ModelConfigs 模块

**Files:**
- Create: `server/src/model-configs/entities/model-config.entity.ts` (Task 1 已创建)
- Create: `server/src/model-configs/dto/create-model-config.dto.ts`
- Create: `server/src/model-configs/dto/update-model-config.dto.ts`
- Create: `server/src/model-configs/model-configs.service.ts`
- Create: `server/src/model-configs/model-configs.controller.ts`
- Create: `server/src/model-configs/model-configs.module.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/.env`

- [ ] **Step 1: 在 .env 中新增 ENCRYPTION_KEY**

  修改 `server/.env`，新增：

  ```env
  ENCRYPTION_KEY=12345678901234567890123456789012
  ```

  （生产环境必须替换为随机 32 字节十六进制字符串）

- [ ] **Step 2: 创建 CreateModelConfigDto**

  创建 `server/src/model-configs/dto/create-model-config.dto.ts`:

  ```typescript
  import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

  export class CreateModelConfigDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    provider: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    modelId: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    name: string;

    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsBoolean()
    @IsOptional()
    isEnabled?: boolean;
  }
  ```

- [ ] **Step 3: 创建 UpdateModelConfigDto**

  创建 `server/src/model-configs/dto/update-model-config.dto.ts`:

  ```typescript
  import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

  export class UpdateModelConfigDto {
    @IsString()
    @IsOptional()
    @MaxLength(128)
    name?: string;

    @IsString()
    @IsOptional()
    apiKey?: string;

    @IsBoolean()
    @IsOptional()
    isEnabled?: boolean;
  }
  ```

- [ ] **Step 4: 创建 ModelConfigsService**

  创建 `server/src/model-configs/model-configs.service.ts`:

  ```typescript
  import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
  import { ModelConfig } from './entities/model-config.entity';
  import { CreateModelConfigDto } from './dto/create-model-config.dto';
  import { UpdateModelConfigDto } from './dto/update-model-config.dto';

  @Injectable()
  export class ModelConfigsService {
    private readonly encryptionKey: Buffer;

    constructor(
      @InjectRepository(ModelConfig)
      private repo: Repository<ModelConfig>,
    ) {
      const key = process.env.ENCRYPTION_KEY;
      if (!key || key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
      }
      this.encryptionKey = Buffer.from(key, 'utf8');
    }

    private encrypt(plaintext: string): { encrypted: string; iv: string } {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return {
        encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
        iv: iv.toString('base64'),
      };
    }

    private decrypt(encryptedBase64: string, ivBase64: string): string {
      const iv = Buffer.from(ivBase64, 'base64');
      const data = Buffer.from(encryptedBase64, 'base64');
      const authTag = data.subarray(data.length - 16);
      const encrypted = data.subarray(0, data.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(encrypted) + decipher.final('utf8');
    }

    private maskApiKey(apiKey: string): string {
      if (apiKey.length <= 8) return '****';
      return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
    }

    async create(userId: string, dto: CreateModelConfigDto): Promise<ModelConfig> {
      const config = this.repo.create({
        userId,
        provider: dto.provider,
        modelId: dto.modelId,
        name: dto.name,
        isEnabled: dto.isEnabled ?? true,
      });

      if (dto.apiKey) {
        const { encrypted, iv } = this.encrypt(dto.apiKey);
        config.apiKey = encrypted;
        config.apiKeyIv = iv;
      }

      return this.repo.save(config);
    }

    async findAllByUser(userId: string): Promise<Array<ModelConfig & { apiKeyMasked?: string }>> {
      const configs = await this.repo.find({ where: { userId }, order: { createdAt: 'ASC' } });
      return configs.map((c) => ({
        ...c,
        apiKey: null,
        apiKeyMasked: c.apiKey ? this.maskApiKey(this.decrypt(c.apiKey, c.apiKeyIv!)) : undefined,
      }));
    }

    async findOne(id: string, userId: string): Promise<ModelConfig> {
      const config = await this.repo.findOne({ where: { id } });
      if (!config) throw new NotFoundException('ModelConfig not found');
      if (config.userId !== userId) throw new ForbiddenException('Access denied');
      return config;
    }

    async update(id: string, userId: string, dto: UpdateModelConfigDto): Promise<ModelConfig> {
      const config = await this.findOne(id, userId);
      if (dto.name !== undefined) config.name = dto.name;
      if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
      if (dto.apiKey !== undefined) {
        const { encrypted, iv } = this.encrypt(dto.apiKey);
        config.apiKey = encrypted;
        config.apiKeyIv = iv;
      }
      return this.repo.save(config);
    }

    async delete(id: string, userId: string): Promise<void> {
      const config = await this.findOne(id, userId);
      await this.repo.remove(config);
    }

    async getDecryptedApiKey(id: string): Promise<string | null> {
      const config = await this.repo.findOne({ where: { id } });
      if (!config || !config.apiKey || !config.apiKeyIv) return null;
      return this.decrypt(config.apiKey, config.apiKeyIv);
    }
  }
  ```

- [ ] **Step 5: 创建 ModelConfigsController**

  创建 `server/src/model-configs/model-configs.controller.ts`:

  ```typescript
  import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
  import { ModelConfigsService } from './model-configs.service';
  import { CreateModelConfigDto } from './dto/create-model-config.dto';
  import { UpdateModelConfigDto } from './dto/update-model-config.dto';
  import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
  import { CurrentUser } from '../common/decorators/current-user.decorator';
  import { AuthenticatedUser } from '../common/types/authenticated-user';

  @Controller('model-configs')
  @UseGuards(JwtAuthGuard)
  export class ModelConfigsController {
    constructor(private readonly service: ModelConfigsService) {}

    @Post()
    create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateModelConfigDto) {
      return this.service.create(user.id, dto);
    }

    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser) {
      return this.service.findAllByUser(user.id);
    }

    @Patch(':id')
    update(
      @Param('id') id: string,
      @CurrentUser() user: AuthenticatedUser,
      @Body() dto: UpdateModelConfigDto,
    ) {
      return this.service.update(id, user.id, dto);
    }

    @Delete(':id')
    @HttpCode(204)
    delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
      return this.service.delete(id, user.id);
    }
  }
  ```

- [ ] **Step 6: 创建 ModelConfigsModule**

  创建 `server/src/model-configs/model-configs.module.ts`:

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { ModelConfig } from './entities/model-config.entity';
  import { ModelConfigsService } from './model-configs.service';
  import { ModelConfigsController } from './model-configs.controller';

  @Module({
    imports: [TypeOrmModule.forFeature([ModelConfig])],
    providers: [ModelConfigsService],
    controllers: [ModelConfigsController],
    exports: [ModelConfigsService],
  })
  export class ModelConfigsModule {}
  ```

- [ ] **Step 7: 在 AppModule 中注册 ModelConfigsModule**

  修改 `server/src/app.module.ts`，新增导入：

  ```typescript
  import { ModelConfigsModule } from './model-configs/model-configs.module';
  ```

  并在 `imports` 数组中添加 `ModelConfigsModule`。

- [ ] **Step 8: 提交**

  ```bash
  git add server/src/model-configs/ server/src/app.module.ts server/.env
  git commit -m "feat(server): add ModelConfigs module with AES-256-GCM encryption"
  ```

---

## Task 3: Agents 模块

**Files:**
- Create: `server/src/agents/dto/create-agent.dto.ts`
- Create: `server/src/agents/dto/update-agent.dto.ts`
- Create: `server/src/agents/agents.service.ts`
- Create: `server/src/agents/agents.controller.ts`
- Create: `server/src/agents/agents.module.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: 创建 CreateAgentDto**

  创建 `server/src/agents/dto/create-agent.dto.ts`:

  ```typescript
  import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
  import { AgentVisibility } from '../entities/agent.entity';

  export class CreateAgentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    systemPrompt?: string;

    @IsUUID()
    @IsOptional()
    modelConfigId?: string;

    @IsEnum(AgentVisibility)
    @IsOptional()
    visibility?: AgentVisibility;
  }
  ```

- [ ] **Step 2: 创建 UpdateAgentDto**

  创建 `server/src/agents/dto/update-agent.dto.ts`:

  ```typescript
  import { IsString, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
  import { AgentVisibility } from '../entities/agent.entity';

  export class UpdateAgentDto {
    @IsString()
    @IsOptional()
    @MaxLength(128)
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    systemPrompt?: string;

    @IsUUID()
    @IsOptional()
    modelConfigId?: string | null;

    @IsEnum(AgentVisibility)
    @IsOptional()
    visibility?: AgentVisibility;
  }
  ```

- [ ] **Step 3: 创建 AgentsService**

  创建 `server/src/agents/agents.service.ts`:

  ```typescript
  import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { Agent, AgentVisibility } from './entities/agent.entity';
  import { CreateAgentDto } from './dto/create-agent.dto';
  import { UpdateAgentDto } from './dto/update-agent.dto';

  @Injectable()
  export class AgentsService {
    constructor(
      @InjectRepository(Agent)
      private repo: Repository<Agent>,
    ) {}

    async create(userId: string, dto: CreateAgentDto): Promise<Agent> {
      const agent = this.repo.create({
        userId,
        name: dto.name,
        description: dto.description ?? '',
        systemPrompt: dto.systemPrompt ?? '',
        modelConfigId: dto.modelConfigId ?? null,
        visibility: dto.visibility ?? AgentVisibility.PRIVATE,
      });
      return this.repo.save(agent);
    }

    async findAllAccessible(userId: string): Promise<Agent[]> {
      return this.repo
        .createQueryBuilder('agent')
        .leftJoinAndSelect('agent.modelConfig', 'modelConfig')
        .where('agent.userId = :userId OR agent.visibility = :public', {
          userId,
          public: AgentVisibility.PUBLIC,
        })
        .andWhere('agent.deletedAt IS NULL')
        .orderBy('agent.updatedAt', 'DESC')
        .getMany();
    }

    async findOne(id: string, userId: string): Promise<Agent> {
      const agent = await this.repo.findOne({
        where: { id },
        relations: { modelConfig: true },
      });
      if (!agent) throw new NotFoundException('Agent not found');
      if (
        agent.visibility === AgentVisibility.PRIVATE &&
        agent.userId !== userId
      ) {
        throw new ForbiddenException('Access denied');
      }
      return agent;
    }

    async update(id: string, userId: string, dto: UpdateAgentDto): Promise<Agent> {
      const agent = await this.repo.findOne({ where: { id } });
      if (!agent) throw new NotFoundException('Agent not found');
      if (agent.userId !== userId) throw new ForbiddenException('Access denied');
      Object.assign(agent, {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
        ...(dto.modelConfigId !== undefined && { modelConfigId: dto.modelConfigId }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      });
      return this.repo.save(agent);
    }

    async delete(id: string, userId: string): Promise<void> {
      const agent = await this.repo.findOne({ where: { id } });
      if (!agent) throw new NotFoundException('Agent not found');
      if (agent.userId !== userId) throw new ForbiddenException('Access denied');
      await this.repo.softRemove(agent);
    }
  }
  ```

- [ ] **Step 4: 创建 AgentsController**

  创建 `server/src/agents/agents.controller.ts`:

  ```typescript
  import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
  import { AgentsService } from './agents.service';
  import { CreateAgentDto } from './dto/create-agent.dto';
  import { UpdateAgentDto } from './dto/update-agent.dto';
  import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
  import { CurrentUser } from '../common/decorators/current-user.decorator';
  import { AuthenticatedUser } from '../common/types/authenticated-user';

  @Controller('agents')
  @UseGuards(JwtAuthGuard)
  export class AgentsController {
    constructor(private readonly service: AgentsService) {}

    @Post()
    create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAgentDto) {
      return this.service.create(user.id, dto);
    }

    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser) {
      return this.service.findAllAccessible(user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
      return this.service.findOne(id, user.id);
    }

    @Patch(':id')
    update(
      @Param('id') id: string,
      @CurrentUser() user: AuthenticatedUser,
      @Body() dto: UpdateAgentDto,
    ) {
      return this.service.update(id, user.id, dto);
    }

    @Delete(':id')
    @HttpCode(204)
    delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
      return this.service.delete(id, user.id);
    }
  }
  ```

- [ ] **Step 5: 创建 AgentsModule**

  创建 `server/src/agents/agents.module.ts`:

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { Agent } from './entities/agent.entity';
  import { AgentsService } from './agents.service';
  import { AgentsController } from './agents.controller';

  @Module({
    imports: [TypeOrmModule.forFeature([Agent])],
    providers: [AgentsService],
    controllers: [AgentsController],
    exports: [AgentsService],
  })
  export class AgentsModule {}
  ```

- [ ] **Step 6: 在 AppModule 中注册 AgentsModule**

  修改 `server/src/app.module.ts`，新增导入：

  ```typescript
  import { AgentsModule } from './agents/agents.module';
  ```

  并在 `imports` 数组中添加 `AgentsModule`。

- [ ] **Step 7: 提交**

  ```bash
  git add server/src/agents/ server/src/app.module.ts
  git commit -m "feat(server): add Agents module with CRUD and soft delete"
  ```


---

## Task 4: 修改 Users 模块 + Auth 返回 lastAgentId

**Files:**
- Modify: `server/src/users/users.service.ts`
- Modify: `server/src/auth/auth.controller.ts`

- [ ] **Step 1: 在 UsersService 中新增 updateLastAgent 方法**

  修改 `server/src/users/users.service.ts`，在类末尾新增：

  ```typescript
  async updateLastAgent(userId: string, agentId: string | null): Promise<void> {
    await this.usersRepository.update(userId, { lastAgentId: agentId });
  }
  ```

- [ ] **Step 2: 修改 auth/me 端点返回 lastAgentId**

  修改 `server/src/auth/auth.controller.ts` 的 `me()` 方法，确保返回的 user 对象包含 `lastAgentId`。

  当前 `me()` 返回 `req.user`（来自 JWT 策略的 payload），但 JWT payload 不含 `lastAgentId`。需要从数据库查询完整用户信息。

  修改 `server/src/auth/auth.controller.ts`：

  ```typescript
  import { Controller, Post, Get, Body, Res, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
  import { Response, Request } from 'express';
  import { AuthGuard } from '@nestjs/passport';
  import { AuthService } from './auth.service';
  import { RegisterDto } from './dto/register.dto';
  import { LoginDto } from './dto/login.dto';
  import { UsersService } from '../users/users.service';
  import { CurrentUser } from '../common/decorators/current-user.decorator';
  import { AuthenticatedUser } from '../common/types/authenticated-user';

  @Controller('auth')
  export class AuthController {
    constructor(
      private authService: AuthService,
      private usersService: UsersService,
    ) {}

    @Post('register')
    async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
      const result = await this.authService.register(registerDto);
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return { user: result.user };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
      const result = await this.authService.login(loginDto);
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return { user: result.user };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Res({ passthrough: true }) res: Response) {
      res.clearCookie('token');
      return { message: 'Logged out successfully' };
    }

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    async me(@CurrentUser() user: AuthenticatedUser) {
      const fullUser = await this.usersService.findById(user.id);
      if (!fullUser) return { user: null };
      return {
        user: {
          id: fullUser.id,
          email: fullUser.email,
          role: fullUser.role,
          lastAgentId: fullUser.lastAgentId,
          createdAt: fullUser.createdAt,
        },
      };
    }
  }
  ```

- [ ] **Step 3: 在 AuthModule 中注入 UsersModule**

  确认 `server/src/auth/auth.module.ts` 已导入 `UsersModule`（现有代码已有，无需修改）。

- [ ] **Step 4: 提交**

  ```bash
  git add server/src/users/users.service.ts server/src/auth/auth.controller.ts
  git commit -m "feat(server): expose lastAgentId in auth/me and add updateLastAgent"
  ```

---

## Task 5: 修改 Conversations 模块

**Files:**
- Modify: `server/src/conversations/dto/create-conversation.dto.ts`
- Modify: `server/src/conversations/dto/stream-message.dto.ts`
- Modify: `server/src/conversations/conversations.service.ts`
- Modify: `server/src/conversations/conversations.controller.ts`
- Modify: `server/src/conversations/conversations.module.ts`

- [ ] **Step 1: 修改 CreateConversationDto，新增可选 agentId**

  修改 `server/src/conversations/dto/create-conversation.dto.ts`:

  ```typescript
  import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID } from 'class-validator';

  export class CreateConversationDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;

    @IsUUID()
    @IsOptional()
    agentId?: string;
  }
  ```

- [ ] **Step 2: 修改 StreamMessageDto，移除 templateId/variables**

  修改 `server/src/conversations/dto/stream-message.dto.ts`:

  ```typescript
  import { IsString, IsNotEmpty } from 'class-validator';

  export class StreamMessageDto {
    @IsString()
    @IsNotEmpty()
    content: string;
  }
  ```

- [ ] **Step 3: 修改 ConversationsService，新增 agentId 支持和 updateAgent/updateModel**

  修改 `server/src/conversations/conversations.service.ts`：

  ```typescript
  import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { Conversation } from './entities/conversation.entity';
  import { Message, MessageRole } from './entities/message.entity';

  @Injectable()
  export class ConversationsService {
    constructor(
      @InjectRepository(Conversation)
      private conversationsRepository: Repository<Conversation>,
      @InjectRepository(Message)
      private messagesRepository: Repository<Message>,
    ) {}

    async create(userId: string, title: string, agentId?: string): Promise<Conversation> {
      const conversation = this.conversationsRepository.create({
        userId,
        title,
        agentId: agentId ?? null,
      });
      return this.conversationsRepository.save(conversation);
    }

    async findAllByUser(userId: string): Promise<Conversation[]> {
      return this.conversationsRepository.find({
        where: { userId },
        order: { updatedAt: 'DESC' },
      });
    }

    async findOne(id: string, userId: string): Promise<Conversation> {
      const conversation = await this.conversationsRepository.findOne({ where: { id } });
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.userId !== userId) throw new ForbiddenException('Access denied');
      return conversation;
    }

    async delete(id: string, userId: string): Promise<void> {
      const conversation = await this.findOne(id, userId);
      await this.conversationsRepository.softRemove(conversation);
    }

    async getMessages(conversationId: string, userId: string): Promise<Message[]> {
      await this.findOne(conversationId, userId);
      return this.messagesRepository.find({
        where: { conversationId },
        order: { createdAt: 'ASC' },
      });
    }

    async updateTitle(id: string, title: string): Promise<void> {
      await this.conversationsRepository.update(id, { title });
    }

    async updateSummary(id: string, summary: string): Promise<void> {
      await this.conversationsRepository.update(id, { summary });
    }

    async updateAgent(id: string, userId: string, agentId: string | null): Promise<Conversation> {
      const conversation = await this.findOne(id, userId);
      conversation.agentId = agentId;
      return this.conversationsRepository.save(conversation);
    }

    async updateActiveModel(id: string, userId: string, modelConfigId: string | null): Promise<Conversation> {
      const conversation = await this.findOne(id, userId);
      conversation.activeModelId = modelConfigId;
      return this.conversationsRepository.save(conversation);
    }

    async saveMessage(conversationId: string, role: MessageRole, content: string): Promise<Message> {
      const message = this.messagesRepository.create({ conversationId, role, content });
      return this.messagesRepository.save(message);
    }
  }
  ```

- [ ] **Step 4: 修改 ConversationsController**

  修改 `server/src/conversations/conversations.controller.ts`：

  ```typescript
  import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Sse, HttpCode } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { ConversationsService } from './conversations.service';
  import { CreateConversationDto } from './dto/create-conversation.dto';
  import { StreamMessageDto } from './dto/stream-message.dto';
  import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
  import { CurrentUser } from '../common/decorators/current-user.decorator';
  import { AuthenticatedUser } from '../common/types/authenticated-user';
  import { AgentService, HistoryMessage, BufferResult } from '../agent/agent.service';
  import { AgentsService } from '../agents/agents.service';
  import { ModelConfigsService } from '../model-configs/model-configs.service';
  import { UsersService } from '../users/users.service';
  import { MessageRole } from './entities/message.entity';

  interface MessageEvent {
    data: string;
  }

  @Controller('conversations')
  @UseGuards(JwtAuthGuard)
  export class ConversationsController {
    constructor(
      private conversationsService: ConversationsService,
      private agentService: AgentService,
      private agentsService: AgentsService,
      private modelConfigsService: ModelConfigsService,
      private usersService: UsersService,
    ) {}

    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser) {
      return this.conversationsService.findAllByUser(user.id);
    }

    @Post()
    async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
      const conversation = await this.conversationsService.create(user.id, dto.title, dto.agentId);
      if (dto.agentId !== undefined) {
        await this.usersService.updateLastAgent(user.id, dto.agentId);
      }
      return conversation;
    }

    @Delete(':id')
    @HttpCode(204)
    delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
      return this.conversationsService.delete(id, user.id);
    }

    @Get(':id/messages')
    getMessages(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
      return this.conversationsService.getMessages(id, user.id);
    }

    @Patch(':id/agent')
    async updateAgent(
      @Param('id') id: string,
      @CurrentUser() user: AuthenticatedUser,
      @Body() body: { agentId: string | null },
    ) {
      const conversation = await this.conversationsService.updateAgent(id, user.id, body.agentId);
      await this.usersService.updateLastAgent(user.id, body.agentId);
      return conversation;
    }

    @Patch(':id/model')
    updateModel(
      @Param('id') id: string,
      @CurrentUser() user: AuthenticatedUser,
      @Body() body: { modelConfigId: string | null },
    ) {
      return this.conversationsService.updateActiveModel(id, user.id, body.modelConfigId);
    }

    @Post(':id/stream')
    @Sse()
    streamMessage(
      @Param('id') id: string,
      @Body() streamMessageDto: StreamMessageDto,
      @CurrentUser() user: AuthenticatedUser,
    ): Observable<MessageEvent> {
      return new Observable<MessageEvent>((subscriber) => {
        (async () => {
          try {
            const conversation = await this.conversationsService.findOne(id, user.id);

            const existingMessages = await this.conversationsService.getMessages(id, user.id);
            if (existingMessages.length === 0) {
              const title = streamMessageDto.content.slice(0, 30).replace(/\n/g, ' ');
              await this.conversationsService.updateTitle(id, title);
            }

            const history: HistoryMessage[] = existingMessages.map((m) => ({
              role: m.role === MessageRole.USER ? 'user' : 'assistant',
              content: m.content,
            }));

            const buffer = await this.agentService.prepareBuffer(history, conversation.summary);
            if (buffer.summaryUpdated && buffer.summary) {
              await this.conversationsService.updateSummary(id, buffer.summary);
            }

            await this.conversationsService.saveMessage(id, MessageRole.USER, streamMessageDto.content);

            // 解析 Agent 和模型配置
            let systemPrompt: string | undefined;
            let intentCheckPrompt: string | undefined;
            let modelId: string | undefined;
            let apiKey: string | undefined;

            // 模型优先级：activeModelId > agent.modelConfigId > 系统默认
            const activeModelId = conversation.activeModelId;
            const agentId = conversation.agentId;

            if (agentId) {
              const agent = await this.agentsService.findOne(agentId, user.id);
              systemPrompt = buffer.summary
                ? `[对话历史摘要]\n${buffer.summary}\n\n${agent.systemPrompt}`
                : agent.systemPrompt || undefined;
              intentCheckPrompt = agent.systemPrompt.slice(0, 200);

              const resolvedModelId = activeModelId ?? agent.modelConfigId;
              if (resolvedModelId) {
                const decrypted = await this.modelConfigsService.getDecryptedApiKey(resolvedModelId);
                const config = await this.modelConfigsService.findOne(resolvedModelId, user.id);
                modelId = config.modelId;
                apiKey = decrypted ?? undefined;
              }
            } else {
              systemPrompt = buffer.summary ? `[对话历史摘要]\n${buffer.summary}` : undefined;
              if (activeModelId) {
                const decrypted = await this.modelConfigsService.getDecryptedApiKey(activeModelId);
                const config = await this.modelConfigsService.findOne(activeModelId, user.id);
                modelId = config.modelId;
                apiKey = decrypted ?? undefined;
              }
            }

            let fullResponse = '';

            for await (const token of this.agentService.streamResponse(id, streamMessageDto.content, {
              systemPrompt,
              history: buffer.recentHistory,
              modelId,
              apiKey,
              intentCheckPrompt,
            })) {
              fullResponse += token;
              subscriber.next({ data: JSON.stringify({ token }) });
            }

            await this.conversationsService.saveMessage(id, MessageRole.ASSISTANT, fullResponse);
            subscriber.next({ data: '[DONE]' });
            subscriber.complete();
          } catch (error) {
            subscriber.error(error);
          }
        })();
      });
    }
  }
  ```

- [ ] **Step 5: 修改 ConversationsModule，注入新依赖**

  修改 `server/src/conversations/conversations.module.ts`:

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { Conversation } from './entities/conversation.entity';
  import { Message } from './entities/message.entity';
  import { ConversationsService } from './conversations.service';
  import { ConversationsController } from './conversations.controller';
  import { AgentModule } from '../agent/agent.module';
  import { AgentsModule } from '../agents/agents.module';
  import { ModelConfigsModule } from '../model-configs/model-configs.module';
  import { UsersModule } from '../users/users.module';

  @Module({
    imports: [
      TypeOrmModule.forFeature([Conversation, Message]),
      AgentModule,
      AgentsModule,
      ModelConfigsModule,
      UsersModule,
    ],
    controllers: [ConversationsController],
    providers: [ConversationsService],
  })
  export class ConversationsModule {}
  ```

- [ ] **Step 6: 提交**

  ```bash
  git add server/src/conversations/
  git commit -m "feat(server): update conversations module with agent/model support"
  ```


---

## Task 6: 重构 agent.service.ts（动态模型 + 意图检测）

**Files:**
- Modify: `server/src/agent/graph/conversation-graph.ts`
- Modify: `server/src/agent/agent.service.ts`

- [ ] **Step 1: 修改 conversation-graph.ts，支持动态 LLM**

  修改 `server/src/agent/graph/conversation-graph.ts`：

  ```typescript
  import { StateGraph, Annotation, messagesStateReducer, CompiledStateGraph, MemorySaver } from '@langchain/langgraph';
  import { ChatDeepSeek } from '@langchain/deepseek';
  import { SystemMessage, AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';

  const ConversationAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    conversationId: Annotation<string>({
      reducer: (left: string, right: string) => right || left,
      default: () => '',
    }),
    systemPrompt: Annotation<string | undefined>({
      reducer: (left: string | undefined, right: string | undefined) => right ?? left,
      default: () => undefined,
    }),
  });

  type ConversationStateType = typeof ConversationAnnotation.State;

  export class ConversationGraph {
    private defaultLlm: ChatDeepSeek;

    constructor(defaultApiKey: string) {
      this.defaultLlm = new ChatDeepSeek({
        apiKey: defaultApiKey,
        model: 'deepseek-v4-flash',
        temperature: 0,
        streaming: true,
      });
    }

    createLlm(modelId?: string, apiKey?: string): ChatDeepSeek {
      if (modelId && apiKey) {
        return new ChatDeepSeek({
          apiKey,
          model: modelId,
          temperature: 0,
          streaming: true,
        });
      }
      return this.defaultLlm;
    }

    compile(checkpointer: MemorySaver, llm: ChatDeepSeek): CompiledStateGraph<any, any, any> {
      const callModel = async (state: ConversationStateType): Promise<Partial<ConversationStateType>> => {
        const response = await llm.invoke(state.messages);
        return {
          messages: [new AIMessage(typeof response.content === 'string' ? response.content : JSON.stringify(response.content))],
        };
      };

      const prepareContext = async (state: ConversationStateType): Promise<Partial<ConversationStateType>> => {
        if (state.systemPrompt) {
          return { messages: [new SystemMessage(state.systemPrompt)] };
        }
        return {};
      };

      const graph = new StateGraph(ConversationAnnotation)
        .addNode('prepare_context', prepareContext)
        .addNode('call_model', callModel)
        .addEdge('__start__', 'prepare_context')
        .addEdge('prepare_context', 'call_model')
        .addEdge('call_model', '__end__');

      return graph.compile({ checkpointer }) as CompiledStateGraph<any, any, any>;
    }

    async summarizeConversation(
      messages: { role: 'user' | 'assistant'; content: string }[],
      existingSummary?: string | null,
    ): Promise<string> {
      const formatted = messages
        .map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
        .join('\n\n');

      const summaryPart = existingSummary
        ? `以下是之前的对话摘要：\n${existingSummary}\n\n请将以下新内容整合进去，生成新的完整摘要。`
        : '请用中文简要总结以下对话，保留关键信息（用户需求、重要事实、决定、上下文）。';

      const prompt = `${summaryPart}\n\n对话内容：\n${formatted}\n\n请用 2-3 段总结，保留所有重要细节。`;

      const response = await this.defaultLlm.invoke([new HumanMessage(prompt)]);
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }
  }
  ```

- [ ] **Step 2: 修改 agent.service.ts，新增动态模型 + 意图检测**

  修改 `server/src/agent/agent.service.ts`：

  ```typescript
  import { Injectable } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import { MemorySaver } from '@langchain/langgraph';
  import { HumanMessage, AIMessageChunk, SystemMessage, AIMessage } from '@langchain/core/messages';
  import type { BaseMessage } from '@langchain/core/messages';
  import { ConversationGraph } from './graph/conversation-graph';

  export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  export interface BufferResult {
    summary: string | null;
    recentHistory: HistoryMessage[];
    summaryUpdated: boolean;
  }

  export interface StreamOptions {
    systemPrompt?: string;
    history?: HistoryMessage[];
    modelId?: string;
    apiKey?: string;
    intentCheckPrompt?: string;
  }

  const MAX_BUFFER_TOKENS = 8000;

  function estimateTokens(text: string): number {
    return Math.ceil(text.length / 2);
  }

  @Injectable()
  export class AgentService {
    private checkpointer: MemorySaver;
    private conversationGraph: ConversationGraph;

    constructor(private configService: ConfigService) {
      this.checkpointer = new MemorySaver();
      const deepseekApiKey = this.configService.getOrThrow<string>('DEEPSEEK_API_KEY');
      this.conversationGraph = new ConversationGraph(deepseekApiKey);
    }

    async prepareBuffer(
      history: HistoryMessage[],
      existingSummary: string | null,
    ): Promise<BufferResult> {
      const totalTokens = history.reduce((sum, m) => sum + estimateTokens(m.content), 0);

      if (totalTokens <= MAX_BUFFER_TOKENS) {
        return { summary: existingSummary, recentHistory: history, summaryUpdated: false };
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

      const oldMessages = history.slice(0, cutoffIndex);
      const recentHistory = history.slice(cutoffIndex);
      const newSummary = await this.conversationGraph.summarizeConversation(oldMessages, existingSummary);
      return { summary: newSummary, recentHistory, summaryUpdated: true };
    }

    private async checkIntent(
      userMessage: string,
      intentCheckPrompt: string,
      modelId?: string,
      apiKey?: string,
    ): Promise<boolean> {
      const llm = this.conversationGraph.createLlm(modelId, apiKey);
      const prompt = `你是一个意图分类器。\nAgent 职责范围描述：${intentCheckPrompt}\n用户消息：${userMessage}\n判断用户消息是否在 Agent 职责范围内。\n只返回 JSON：{"allowed": true} 或 {"allowed": false}`;

      try {
        // 第一阶段：低 maxTokens 快速判断
        const fastLlm = this.conversationGraph.createLlm(modelId, apiKey);
        const response = await (fastLlm as any).invoke([new HumanMessage(prompt)], { max_tokens: 20 });
        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        const match = text.match(/\{[^}]*"allowed"\s*:\s*(true|false)[^}]*\}/);
        if (match) {
          return JSON.parse(match[0]).allowed === true;
        }
        // 第二阶段：主 LLM 兜底
        const fallbackResponse = await llm.invoke([new HumanMessage(prompt)]);
        const fallbackText = typeof fallbackResponse.content === 'string' ? fallbackResponse.content : JSON.stringify(fallbackResponse.content);
        const fallbackMatch = fallbackText.match(/\{[^}]*"allowed"\s*:\s*(true|false)[^}]*\}/);
        if (fallbackMatch) {
          return JSON.parse(fallbackMatch[0]).allowed === true;
        }
        return true; // 解析失败时默认放行
      } catch {
        return true; // 出错时默认放行
      }
    }

    async *streamResponse(
      conversationId: string,
      userMessage: string,
      options: StreamOptions = {},
    ): AsyncGenerator<string, void, unknown> {
      const { systemPrompt, history = [], modelId, apiKey, intentCheckPrompt } = options;

      // 意图检测（仅当有 Agent 绑定时）
      if (intentCheckPrompt) {
        const allowed = await this.checkIntent(userMessage, intentCheckPrompt, modelId, apiKey);
        if (!allowed) {
          yield '抱歉，您的问题超出了我的服务范围。';
          return;
        }
      }

      const llm = this.conversationGraph.createLlm(modelId, apiKey);
      const compiledGraph = this.conversationGraph.compile(this.checkpointer, llm);

      const messages: BaseMessage[] = [];
      if (systemPrompt) messages.push(new SystemMessage(systemPrompt));
      for (const m of history) {
        messages.push(m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content));
      }
      messages.push(new HumanMessage(userMessage));

      const input = { messages, conversationId };
      const config = {
        configurable: { thread_id: conversationId },
        streamMode: 'messages' as const,
      };

      const stream = await compiledGraph.stream(input, config);

      for await (const [chunk] of stream as AsyncIterable<[AIMessageChunk, Record<string, unknown>]>) {
        if (chunk instanceof AIMessageChunk && chunk.content) {
          const token = typeof chunk.content === 'string'
            ? chunk.content
            : JSON.stringify(chunk.content);
          if (token) yield token;
        }
      }
    }
  }
  ```

- [ ] **Step 3: 提交**

  ```bash
  git add server/src/agent/
  git commit -m "feat(server): refactor agent service with dynamic model and intent detection"
  ```

---

## Task 7: 移除 Templates 模块

**Files:**
- Delete: `server/src/templates/` (整个目录)
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: 从 AppModule 中移除 TemplatesModule**

  修改 `server/src/app.module.ts`，移除 `TemplatesModule` 的导入和注册，最终内容：

  ```typescript
  import { Module } from '@nestjs/common';
  import { TypeOrmModule } from '@nestjs/typeorm';
  import { ConfigModule } from '@nestjs/config';
  import databaseConfig from './config/database.config';
  import { UsersModule } from './users/users.module';
  import { AuthModule } from './auth/auth.module';
  import { ConversationsModule } from './conversations/conversations.module';
  import { AgentModule } from './agent/agent.module';
  import { ModelConfigsModule } from './model-configs/model-configs.module';
  import { AgentsModule } from './agents/agents.module';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
      UsersModule,
      AuthModule,
      ConversationsModule,
      AgentModule,
      ModelConfigsModule,
      AgentsModule,
    ],
  })
  export class AppModule {}
  ```

- [ ] **Step 2: 删除 templates 目录**

  运行: `cd server && rm -rf src/templates`

  （Windows PowerShell: `Remove-Item -Recurse -Force src/templates`）

- [ ] **Step 3: 验证编译通过**

  运行: `cd server && pnpm build`

  预期输出: 编译成功，无错误。

- [ ] **Step 4: 提交**

  ```bash
  git add -A server/src/
  git commit -m "feat(server): remove templates module, register new modules"
  ```

---

## Task 8: 前端重构

**Files:**
- Modify: `front/src/types/index.ts`
- Create: `front/src/api/agents.ts`
- Create: `front/src/api/model-configs.ts`
- Modify: `front/src/api/conversations.ts`
- Modify: `front/src/contexts/AuthContext.tsx`
- Create: `front/src/pages/AgentsPage.tsx`
- Create: `front/src/pages/ModelsPage.tsx`
- Create: `front/src/components/ConversationHeader.tsx`
- Modify: `front/src/components/Sidebar.tsx`
- Modify: `front/src/components/MessageInput.tsx`
- Modify: `front/src/pages/ChatPage.tsx`
- Modify: `front/src/App.tsx`


- [ ] **Step 1: 修改 types/index.ts**

  修改 `front/src/types/index.ts`，移除 Template 相关类型，新增 Agent/ModelConfig 类型：

  ```typescript
  export const UserRole = {
    ADMIN: 'admin',
    USER: 'user',
  } as const;
  export type UserRole = (typeof UserRole)[keyof typeof UserRole];

  export const MessageRole = {
    USER: 'user',
    ASSISTANT: 'assistant',
  } as const;
  export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

  export const AgentVisibility = {
    PRIVATE: 'private',
    PUBLIC: 'public',
  } as const;
  export type AgentVisibility = (typeof AgentVisibility)[keyof typeof AgentVisibility];

  export interface User {
    id: string;
    email: string;
    role: UserRole;
    lastAgentId: string | null;
    createdAt: string;
  }

  export interface Conversation {
    id: string;
    userId: string;
    title: string;
    agentId: string | null;
    activeModelId: string | null;
    createdAt: string;
    updatedAt: string;
  }

  export interface Message {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    createdAt: string;
  }

  export interface ModelConfig {
    id: string;
    userId: string;
    provider: string;
    modelId: string;
    name: string;
    apiKeyMasked?: string;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface Agent {
    id: string;
    userId: string;
    name: string;
    description: string;
    systemPrompt: string;
    modelConfigId: string | null;
    modelConfig?: ModelConfig | null;
    visibility: AgentVisibility;
    createdAt: string;
    updatedAt: string;
  }
  ```

- [ ] **Step 2: 创建 api/agents.ts**

  创建 `front/src/api/agents.ts`:

  ```typescript
  import { fetchAPI } from './client';
  import type { Agent, AgentVisibility } from '../types';

  export async function getAgents(): Promise<Agent[]> {
    const response = await fetchAPI('/agents');
    return response.json();
  }

  export async function createAgent(data: {
    name: string;
    description?: string;
    systemPrompt?: string;
    modelConfigId?: string;
    visibility?: AgentVisibility;
  }): Promise<Agent> {
    const response = await fetchAPI('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  export async function updateAgent(
    id: string,
    data: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      modelConfigId?: string | null;
      visibility?: AgentVisibility;
    },
  ): Promise<Agent> {
    const response = await fetchAPI(`/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  export async function deleteAgent(id: string): Promise<void> {
    await fetchAPI(`/agents/${id}`, { method: 'DELETE' });
  }
  ```

- [ ] **Step 3: 创建 api/model-configs.ts**

  创建 `front/src/api/model-configs.ts`:

  ```typescript
  import { fetchAPI } from './client';
  import type { ModelConfig } from '../types';

  export async function getModelConfigs(): Promise<ModelConfig[]> {
    const response = await fetchAPI('/model-configs');
    return response.json();
  }

  export async function createModelConfig(data: {
    provider: string;
    modelId: string;
    name: string;
    apiKey?: string;
    isEnabled?: boolean;
  }): Promise<ModelConfig> {
    const response = await fetchAPI('/model-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  export async function updateModelConfig(
    id: string,
    data: { name?: string; apiKey?: string; isEnabled?: boolean },
  ): Promise<ModelConfig> {
    const response = await fetchAPI(`/model-configs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  export async function deleteModelConfig(id: string): Promise<void> {
    await fetchAPI(`/model-configs/${id}`, { method: 'DELETE' });
  }
  ```


- [ ] **Step 4: 修改 api/conversations.ts**

  修改 `front/src/api/conversations.ts`，更新 `createConversation` 和新增 `updateAgent`/`updateModel`：

  ```typescript
  import { fetchAPI } from './client';
  import type { Conversation, Message } from '../types';

  export async function getConversations(): Promise<Conversation[]> {
    const response = await fetchAPI('/conversations');
    return response.json();
  }

  export async function createConversation(title: string, agentId?: string | null): Promise<Conversation> {
    const response = await fetchAPI('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, ...(agentId !== undefined && { agentId }) }),
    });
    return response.json();
  }

  export async function deleteConversation(id: string): Promise<void> {
    await fetchAPI(`/conversations/${id}`, { method: 'DELETE' });
  }

  export async function getMessages(conversationId: string): Promise<Message[]> {
    const response = await fetchAPI(`/conversations/${conversationId}/messages`);
    return response.json();
  }

  export async function updateConversationAgent(
    id: string,
    agentId: string | null,
  ): Promise<Conversation> {
    const response = await fetchAPI(`/conversations/${id}/agent`, {
      method: 'PATCH',
      body: JSON.stringify({ agentId }),
    });
    return response.json();
  }

  export async function updateConversationModel(
    id: string,
    modelConfigId: string | null,
  ): Promise<Conversation> {
    const response = await fetchAPI(`/conversations/${id}/model`, {
      method: 'PATCH',
      body: JSON.stringify({ modelConfigId }),
    });
    return response.json();
  }

  export async function streamMessage(
    conversationId: string,
    content: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(`http://localhost:3000/conversations/${conversationId}/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!response.ok || !response.body) {
      throw new Error('Stream failed');
    }

    return response.body;
  }
  ```

- [ ] **Step 5: 修改 AuthContext.tsx，user 包含 lastAgentId**

  修改 `front/src/contexts/AuthContext.tsx`，更新 `User` 接口引用（已在 types/index.ts 中更新），确保 `me` 接口返回的 `lastAgentId` 被正确存储。

  当前 `AuthContext.tsx` 在 `useEffect` 中调用 `fetchAPI('/auth/me')` 获取用户信息。确认 `setUser` 接收的对象包含 `lastAgentId` 字段（后端已在 Task 4 中更新）。无需修改逻辑，只需确认类型兼容。

  如果 `AuthContext.tsx` 中有本地 `User` 接口定义，将其删除，改为从 `../types` 导入。

- [ ] **Step 6: 创建 ConversationHeader 组件**

  创建 `front/src/components/ConversationHeader.tsx`:

  ```typescript
  import { useState, useEffect } from 'react';
  import { Select, Typography, Space, Tag } from 'antd';
  import type { Conversation, Agent, ModelConfig } from '../types';
  import * as conversationsAPI from '../api/conversations';
  import * as agentsAPI from '../api/agents';
  import * as modelConfigsAPI from '../api/model-configs';

  const { Text } = Typography;

  interface ConversationHeaderProps {
    conversation: Conversation | null;
    onConversationUpdate: (updated: Conversation) => void;
  }

  export function ConversationHeader({ conversation, onConversationUpdate }: ConversationHeaderProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);

    useEffect(() => {
      agentsAPI.getAgents().then(setAgents).catch(console.error);
      modelConfigsAPI.getModelConfigs().then(setModelConfigs).catch(console.error);
    }, []);

    if (!conversation) return null;

    const currentAgent = agents.find((a) => a.id === conversation.agentId);
    const currentModel = modelConfigs.find((m) => m.id === (conversation.activeModelId ?? currentAgent?.modelConfigId));

    const handleAgentChange = async (agentId: string | null) => {
      const updated = await conversationsAPI.updateConversationAgent(conversation.id, agentId);
      onConversationUpdate(updated);
    };

    const handleModelChange = async (modelConfigId: string | null) => {
      const updated = await conversationsAPI.updateConversationModel(conversation.id, modelConfigId);
      onConversationUpdate(updated);
    };

    return (
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Agent:</Text>
          <Select
            size="small"
            style={{ minWidth: 140 }}
            value={conversation.agentId ?? 'none'}
            onChange={(v) => handleAgentChange(v === 'none' ? null : v)}
            options={[
              { value: 'none', label: '通用对话' },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>模型:</Text>
          <Select
            size="small"
            style={{ minWidth: 160 }}
            value={conversation.activeModelId ?? 'default'}
            onChange={(v) => handleModelChange(v === 'default' ? null : v)}
            options={[
              { value: 'default', label: currentAgent?.modelConfig?.name ?? '默认模型' },
              ...modelConfigs.filter((m) => m.isEnabled).map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </Space>
        {currentAgent && (
          <Tag color="blue" style={{ fontSize: 11 }}>{currentAgent.name}</Tag>
        )}
      </div>
    );
  }
  ```


- [ ] **Step 7: 修改 Sidebar.tsx**

  修改 `front/src/components/Sidebar.tsx`，将"模板管理"菜单项替换为"Agent 管理"和"模型配置"：

  将以下代码：
  ```typescript
  {
    key: 'templates',
    icon: <AppstoreOutlined />,
    label: <Link to="/templates">模板管理</Link>,
  },
  ```

  替换为：
  ```typescript
  {
    key: 'agents',
    icon: <AppstoreOutlined />,
    label: <Link to="/agents">Agent 管理</Link>,
  },
  {
    key: 'models',
    icon: <SettingOutlined />,
    label: <Link to="/models">模型配置</Link>,
  },
  ```

  同时在文件顶部导入中新增 `SettingOutlined`：
  ```typescript
  import { PlusOutlined, MessageOutlined, AppstoreOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
  ```

- [ ] **Step 8: 修改 MessageInput.tsx，移除 TemplateSelector**

  修改 `front/src/components/MessageInput.tsx`，移除"使用模板"按钮和 `TemplateSelector` 相关逻辑。

  将 `onSend` 的签名从 `(content: string, templateId?: string, variables?: Record<string, string>) => void` 改为 `(content: string) => void`。

  最终 `MessageInput.tsx` 内容：

  ```typescript
  import { useState, useRef } from 'react';
  import { Input, Button } from 'antd';
  import { SendOutlined } from '@ant-design/icons';

  interface MessageInputProps {
    onSend: (content: string) => void;
    disabled: boolean;
  }

  export function MessageInput({ onSend, disabled }: MessageInputProps) {
    const [content, setContent] = useState('');

    const handleSubmit = () => {
      if (content.trim() && !disabled) {
        onSend(content.trim());
        setContent('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    return (
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
        <Input.TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 6 }}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          disabled={disabled || !content.trim()}
        >
          发送
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 9: 修改 ChatPage.tsx**

  修改 `front/src/pages/ChatPage.tsx`，新增 `ConversationHeader`，更新 `handleSend` 签名，使用 `user.lastAgentId` 创建对话：

  ```typescript
  import { useEffect, useState } from 'react';
  import { useParams, useNavigate } from 'react-router-dom';
  import type { Message, Conversation } from '../types';
  import { MessageRole } from '../types';
  import { MessageList } from '../components/MessageList';
  import { MessageInput } from '../components/MessageInput';
  import { ConversationHeader } from '../components/ConversationHeader';
  import { useConversations } from '../contexts/ConversationsContext';
  import { useAuth } from '../contexts/AuthContext';
  import * as conversationsAPI from '../api/conversations';

  export function ChatPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { loadConversations } = useConversations();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
      if (id) {
        conversationsAPI.getMessages(id).then(setMessages).catch(console.error);
        // 获取对话详情（含 agentId/activeModelId）
        conversationsAPI.getConversations().then((convs) => {
          const conv = convs.find((c) => c.id === id);
          if (conv) setConversation(conv);
        }).catch(console.error);
      } else {
        setMessages([]);
        setConversation(null);
      }
    }, [id]);

    const handleSend = async (content: string) => {
      let conversationId = id;

      if (!conversationId) {
        const agentId = user?.lastAgentId ?? undefined;
        const conv = await conversationsAPI.createConversation('新对话', agentId);
        conversationId = conv.id;
        setConversation(conv);
        navigate(`/chat/${conversationId}`);
      }

      const optimisticUserMsg: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId: conversationId,
        role: MessageRole.USER,
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setIsWaiting(true);
      setIsStreaming(true);
      setStreamingMessage('');

      try {
        const stream = await conversationsAPI.streamMessage(conversationId, content);
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
                const updated = await conversationsAPI.getMessages(conversationId!);
                setMessages(updated);
                setStreamingMessage('');
                setIsStreaming(false);
                setIsWaiting(false);
                await loadConversations();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.token) {
                  setIsWaiting(false);
                  setStreamingMessage((prev) => prev + parsed.token);
                }
              } catch {
                // ignore malformed SSE data
              }
            }
          }
        }
      } catch (err) {
        console.error('Stream failed:', err);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      } finally {
        setIsStreaming(false);
        setIsWaiting(false);
        setStreamingMessage('');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ConversationHeader
          conversation={conversation}
          onConversationUpdate={setConversation}
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MessageList
            messages={messages}
            streamingMessage={streamingMessage}
            isWaiting={isWaiting}
          />
        </div>
        <MessageInput onSend={handleSend} disabled={isStreaming} />
      </div>
    );
  }
  ```

- [ ] **Step 10: 创建 AgentsPage.tsx**

  创建 `front/src/pages/AgentsPage.tsx`:

  ```typescript
  import { useEffect, useState } from 'react';
  import { Button, Card, Form, Input, Select, Space, Tag, Typography, Popconfirm, Modal } from 'antd';
  import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
  import type { Agent, ModelConfig } from '../types';
  import { AgentVisibility } from '../types';
  import * as agentsAPI from '../api/agents';
  import * as modelConfigsAPI from '../api/model-configs';

  const { Title, Text } = Typography;
  const { TextArea } = Input;

  export function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
      loadData();
    }, []);

    const loadData = async () => {
      const [agentList, modelList] = await Promise.all([
        agentsAPI.getAgents(),
        modelConfigsAPI.getModelConfigs(),
      ]);
      setAgents(agentList);
      setModelConfigs(modelList);
    };

    const handleOpenCreate = () => {
      setEditingAgent(null);
      form.resetFields();
      setModalOpen(true);
    };

    const handleOpenEdit = (agent: Agent) => {
      setEditingAgent(agent);
      form.setFieldsValue({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        modelConfigId: agent.modelConfigId ?? 'none',
        visibility: agent.visibility,
      });
      setModalOpen(true);
    };

    const handleSubmit = async (values: any) => {
      const data = {
        ...values,
        modelConfigId: values.modelConfigId === 'none' ? null : values.modelConfigId,
      };
      if (editingAgent) {
        await agentsAPI.updateAgent(editingAgent.id, data);
      } else {
        await agentsAPI.createAgent(data);
      }
      setModalOpen(false);
      loadData();
    };

    const handleDelete = async (id: string) => {
      await agentsAPI.deleteAgent(id);
      loadData();
    };

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>Agent 管理</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建 Agent
          </Button>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {agents.map((agent) => (
            <Card
              key={agent.id}
              size="small"
              extra={
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(agent)} />
                  <Popconfirm
                    title="确定删除此 Agent？"
                    onConfirm={() => handleDelete(agent.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              }
            >
              <Space>
                <Text strong>{agent.name}</Text>
                <Tag color={agent.visibility === AgentVisibility.PUBLIC ? 'green' : 'default'}>
                  {agent.visibility === AgentVisibility.PUBLIC ? '公开' : '私有'}
                </Tag>
                {agent.modelConfig && <Tag color="blue">{agent.modelConfig.name}</Tag>}
              </Space>
              {agent.description && <div style={{ marginTop: 4, color: '#666', fontSize: 13 }}>{agent.description}</div>}
              {agent.systemPrompt && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
                  {agent.systemPrompt.slice(0, 100)}{agent.systemPrompt.length > 100 ? '...' : ''}
                </div>
              )}
            </Card>
          ))}
        </Space>

        <Modal
          title={editingAgent ? '编辑 Agent' : '创建 Agent'}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={() => form.submit()}
          okText={editingAgent ? '保存' : '创建'}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input />
            </Form.Item>
            <Form.Item name="systemPrompt" label="系统提示词">
              <TextArea rows={4} placeholder="描述 Agent 的职责和行为..." />
            </Form.Item>
            <Form.Item name="modelConfigId" label="默认模型" initialValue="none">
              <Select
                options={[
                  { value: 'none', label: '使用系统默认' },
                  ...modelConfigs.filter((m) => m.isEnabled).map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            </Form.Item>
            <Form.Item name="visibility" label="可见性" initialValue={AgentVisibility.PRIVATE}>
              <Select
                options={[
                  { value: AgentVisibility.PRIVATE, label: '私有' },
                  { value: AgentVisibility.PUBLIC, label: '公开' },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
  ```

- [ ] **Step 11: 创建 ModelsPage.tsx**

  创建 `front/src/pages/ModelsPage.tsx`:

  ```typescript
  import { useEffect, useState } from 'react';
  import { Button, Card, Form, Input, Select, Space, Switch, Typography, Popconfirm, Modal, Tag } from 'antd';
  import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
  import type { ModelConfig } from '../types';
  import * as modelConfigsAPI from '../api/model-configs';

  const { Title, Text } = Typography;

  const PROVIDER_OPTIONS = [
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'openai', label: 'OpenAI' },
  ];

  export function ModelsPage() {
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
      loadModels();
    }, []);

    const loadModels = async () => {
      const data = await modelConfigsAPI.getModelConfigs();
      setModels(data);
    };

    const handleOpenCreate = () => {
      setEditingModel(null);
      form.resetFields();
      setModalOpen(true);
    };

    const handleOpenEdit = (model: ModelConfig) => {
      setEditingModel(model);
      form.setFieldsValue({
        name: model.name,
        isEnabled: model.isEnabled,
      });
      setModalOpen(true);
    };

    const handleSubmit = async (values: any) => {
      if (editingModel) {
        await modelConfigsAPI.updateModelConfig(editingModel.id, {
          name: values.name,
          isEnabled: values.isEnabled,
          ...(values.apiKey && { apiKey: values.apiKey }),
        });
      } else {
        await modelConfigsAPI.createModelConfig({
          provider: values.provider,
          modelId: values.modelId,
          name: values.name,
          apiKey: values.apiKey,
          isEnabled: values.isEnabled ?? true,
        });
      }
      setModalOpen(false);
      loadModels();
    };

    const handleDelete = async (id: string) => {
      await modelConfigsAPI.deleteModelConfig(id);
      loadModels();
    };

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>模型配置</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            添加模型
          </Button>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {models.map((model) => (
            <Card
              key={model.id}
              size="small"
              extra={
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(model)} />
                  <Popconfirm
                    title="确定删除此模型配置？"
                    onConfirm={() => handleDelete(model.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" icon={<DeleteOutlined />} danger />
                  </Popconfirm>
                </Space>
              }
            >
              <Space>
                <Text strong>{model.name}</Text>
                <Tag>{model.provider}</Tag>
                <Tag color="purple">{model.modelId}</Tag>
                {!model.isEnabled && <Tag color="red">已禁用</Tag>}
              </Space>
              {model.apiKeyMasked && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#999', fontFamily: 'monospace' }}>
                  API Key: {model.apiKeyMasked}
                </div>
              )}
            </Card>
          ))}
        </Space>

        <Modal
          title={editingModel ? '编辑模型配置' : '添加模型配置'}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={() => form.submit()}
          okText={editingModel ? '保存' : '添加'}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {!editingModel && (
              <>
                <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
                  <Select options={PROVIDER_OPTIONS} />
                </Form.Item>
                <Form.Item name="modelId" label="Model ID" rules={[{ required: true }]}>
                  <Input placeholder="如 deepseek-chat, gpt-4o" />
                </Form.Item>
              </>
            )}
            <Form.Item name="name" label="显示名称" rules={[{ required: true }]}>
              <Input placeholder="如 DeepSeek Chat" />
            </Form.Item>
            <Form.Item name="apiKey" label={editingModel ? '新 API Key（留空不修改）' : 'API Key'}>
              <Input.Password placeholder="sk-..." />
            </Form.Item>
            <Form.Item name="isEnabled" label="启用" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
  ```

- [ ] **Step 12: 修改 App.tsx**

  修改 `front/src/App.tsx`，将 `/templates` 路由替换为 `/agents` 和 `/models`：

  ```typescript
  import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
  import { Spin } from 'antd';
  import { AuthProvider, useAuth } from './contexts/AuthContext';
  import { LoginPage } from './pages/LoginPage';
  import { RegisterPage } from './pages/RegisterPage';
  import { ChatPage } from './pages/ChatPage';
  import { AgentsPage } from './pages/AgentsPage';
  import { ModelsPage } from './pages/ModelsPage';
  import { Layout } from './components/Layout';

  function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      );
    }

    return user ? <>{children}</> : <Navigate to="/login" replace />;
  }

  function App() {
    return (
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/chat" replace />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:id" element={<ChatPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="models" element={<ModelsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  export default App;
  ```

- [ ] **Step 13: 提交**

  ```bash
  git add front/src/
  git commit -m "feat(front): replace templates with agents/models, add ConversationHeader"
  ```

---

## 计划自审

**规范覆盖检查：**
- ✅ model_configs 表（AES-256-GCM 加密，脱敏展示）
- ✅ agents 表（软删除，公开/私有）
- ✅ conversations 新增 agentId/activeModelId
- ✅ users 新增 lastAgentId
- ✅ 模型优先级：activeModelId > agent.modelConfigId > 系统默认
- ✅ 两阶段意图检测（allowed=false 时直接拒绝）
- ✅ 动态 LLM 实例化
- ✅ 前端 /agents 和 /models 页面
- ✅ ConversationHeader（Agent 切换 + 模型切换）
- ✅ 新建对话使用 lastAgentId
- ✅ MessageInput 移除 TemplateSelector
- ✅ Templates 模块完全移除

**类型一致性检查：**
- `AgentVisibility` enum 在 entity/dto/types 中一致 ✅
- `StreamOptions` 接口在 agent.service.ts 中定义，conversations.controller.ts 中使用 ✅
- `ModelConfig.apiKeyMasked` 在 service 返回，types/index.ts 中定义 ✅
- `Conversation.agentId`/`activeModelId` 在 entity/service/types 中一致 ✅

**占位符检查：** 无 TBD/TODO ✅
