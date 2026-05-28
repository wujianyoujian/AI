# AI Agent 平台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建支持多用户的 AI Agent 平台，实现智能问答（多轮对话 + SSE 流式输出）和提示词模板管理（CRUD + 版本控制 + 权限）

**Architecture:** NestJS 后端（TypeORM + PostgreSQL），LangGraph 管理 Agent 状态，DeepSeek LLM，SSE 流式输出。React + Vite 前端，原生 fetch 处理 SSE。JWT 认证存储在 HttpOnly Cookie。

**Tech Stack:** NestJS, TypeORM, PostgreSQL, LangGraph, @langchain/deepseek, React 19, Vite, TypeScript

---

## 文件结构规划

### 后端 (server/)

```
server/
├── src/
│   ├── main.ts                          # NestJS 应用入口
│   ├── app.module.ts                    # 根模块
│   ├── config/
│   │   ├── database.config.ts           # TypeORM 配置
│   │   └── jwt.config.ts                # JWT 配置
│   ├── common/
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts        # JWT 认证守卫
│   │   └── decorators/
│   │       └── current-user.decorator.ts # 当前用户装饰器
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── entities/
│   │       └── user.entity.ts           # User 实体
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   ├── conversations/
│   │   ├── conversations.module.ts
│   │   ├── conversations.service.ts
│   │   ├── conversations.controller.ts
│   │   └── entities/
│   │       ├── conversation.entity.ts
│   │       └── message.entity.ts
│   ├── templates/
│   │   ├── templates.module.ts
│   │   ├── templates.service.ts
│   │   ├── templates.controller.ts
│   │   └── entities/
│   │       ├── template.entity.ts
│   │       └── template-version.entity.ts
│   └── agent/
│       ├── agent.module.ts
│       ├── agent.service.ts             # LangGraph 执行
│       └── graph/
│           └── conversation-graph.ts    # StateGraph 定义
├── package.json
└── tsconfig.json
```

### 前端 (front/)

```
front/
├── src/
│   ├── main.tsx                         # 应用入口
│   ├── App.tsx                          # 根组件 + 路由
│   ├── contexts/
│   │   └── AuthContext.tsx              # 认证上下文
│   ├── components/
│   │   ├── AuthGuard.tsx                # 路由守卫
│   │   ├── Layout.tsx                   # 布局容器
│   │   └── Sidebar.tsx                  # 侧边栏
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── chat/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── TemplateSelector.tsx
│   │   └── templates/
│   │       ├── TemplateListPage.tsx
│   │       ├── TemplateFormPage.tsx
│   │       ├── TemplateDetailPage.tsx
│   │       └── VersionHistory.tsx
│   ├── services/
│   │   ├── api.ts                       # Axios 实例
│   │   ├── auth.service.ts
│   │   ├── conversation.service.ts
│   │   └── template.service.ts
│   └── types/
│       └── index.ts                     # 类型定义
├── package.json
└── tsconfig.json
```

---

## Task 1: NestJS 项目初始化与数据库配置

**Files:**
- Modify: `server/package.json`
- Create: `server/src/main.ts`
- Create: `server/src/app.module.ts`
- Create: `server/src/config/database.config.ts`
- Create: `server/.env`
- Create: `server/ormconfig.ts`

- [ ] **Step 1: 安装 NestJS 核心依赖**

```bash
cd server
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/typeorm typeorm pg bcrypt @nestjs/jwt @nestjs/passport passport passport-jwt cookie-parser
pnpm add -D @nestjs/cli @types/bcrypt @types/passport-jwt @types/cookie-parser
```

- [ ] **Step 2: 创建 NestJS 应用入口**

创建 `server/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}

bootstrap();
```

- [ ] **Step 3: 创建根模块**

创建 `server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
  ],
})
export class AppModule {}
```

- [ ] **Step 4: 创建数据库配置**

创建 `server/src/config/database.config.ts`:

```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_agent',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
});
```

- [ ] **Step 5: 创建环境变量文件**

创建 `server/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=ai_agent

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

DEEPSEEK_API_KEY=your-deepseek-api-key
```

- [ ] **Step 6: 创建 TypeORM 配置文件（用于 CLI）**

创建 `server/ormconfig.ts`:

```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_agent',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
```

- [ ] **Step 7: 更新 package.json 脚本**

修改 `server/package.json` 的 scripts 部分:

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d ormconfig.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d ormconfig.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d ormconfig.ts"
  }
}
```

- [ ] **Step 8: 验证 NestJS 启动**

运行:
```bash
cd server
pnpm dev
```

预期输出: `Server running on http://localhost:3000`

- [ ] **Step 9: 提交**

```bash
git add server/
git commit -m "feat(server): initialize NestJS app with TypeORM config"
```

---

## Task 2: 创建数据库实体

**Files:**
- Create: `server/src/users/entities/user.entity.ts`
- Create: `server/src/conversations/entities/conversation.entity.ts`
- Create: `server/src/conversations/entities/message.entity.ts`
- Create: `server/src/templates/entities/template.entity.ts`
- Create: `server/src/templates/entities/template-version.entity.ts`

- [ ] **Step 1: 创建 User 实体**

创建 `server/src/users/entities/user.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { Template } from '../../templates/entities/template.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations: Conversation[];

  @OneToMany(() => Template, (template) => template.user)
  templates: Template[];
}
```

- [ ] **Step 2: 创建 Conversation 实体**

创建 `server/src/conversations/entities/conversation.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
```

- [ ] **Step 3: 创建 Message 实体**

创建 `server/src/conversations/entities/message.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 4: 创建 Template 实体**

创建 `server/src/templates/entities/template.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TemplateVersion } from './template-version.entity';

export enum TemplateVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.templates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: TemplateVisibility, default: TemplateVisibility.PRIVATE })
  visibility: TemplateVisibility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TemplateVersion, (version) => version.template)
  versions: TemplateVersion[];
}
```

- [ ] **Step 5: 创建 TemplateVersion 实体**

创建 `server/src/templates/entities/template-version.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Template } from './template.entity';

@Entity('template_versions')
export class TemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => Template, (template) => template.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: Template;

  @Column()
  version: number;

  @Column('text')
  content: string;

  @Column('jsonb')
  variables: Array<{ name: string; default: string }>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 6: 生成数据库迁移**

运行:
```bash
cd server
pnpm migration:generate src/migrations/InitialSchema
```

预期输出: 生成迁移文件 `src/migrations/[timestamp]-InitialSchema.ts`

- [ ] **Step 7: 执行迁移**

运行:
```bash
pnpm migration:run
```

预期输出: `Migration InitialSchema has been executed successfully`

- [ ] **Step 8: 提交**

```bash
git add server/src/
git commit -m "feat(server): add database entities and initial migration"
```

---

## Task 3: 实现用户认证模块

**Files:**
- Create: `server/src/users/users.module.ts`
- Create: `server/src/users/users.service.ts`
- Create: `server/src/auth/auth.module.ts`
- Create: `server/src/auth/auth.service.ts`
- Create: `server/src/auth/auth.controller.ts`
- Create: `server/src/auth/dto/register.dto.ts`
- Create: `server/src/auth/dto/login.dto.ts`
- Create: `server/src/config/jwt.config.ts`
- Create: `server/src/common/guards/jwt-auth.guard.ts`
- Create: `server/src/common/decorators/current-user.decorator.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: 创建 UsersModule**

创建 `server/src/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 2: 创建 UsersService**

创建 `server/src/users/users.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}
```

- [ ] **Step 3: 创建 JWT 配置**

创建 `server/src/config/jwt.config.ts`:

```typescript
import { JwtModuleOptions } from '@nestjs/jwt';

export default (): JwtModuleOptions => ({
  secret: process.env.JWT_SECRET || 'default-secret',
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
});
```

- [ ] **Step 4: 创建 DTO**

创建 `server/src/auth/dto/register.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

创建 `server/src/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

- [ ] **Step 5: 安装验证依赖**

```bash
cd server
pnpm add class-validator class-transformer
```

- [ ] **Step 6: 创建 AuthService**

创建 `server/src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.usersService.create(registerDto.email, registerDto.password);
    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return { user: { id: user.id, email: user.email, role: user.role }, token };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.usersService.validatePassword(user, loginDto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return { user: { id: user.id, email: user.email, role: user.role }, token };
  }
}
```

- [ ] **Step 7: 创建 AuthController**

创建 `server/src/auth/auth.controller.ts`:

```typescript
import { Controller, Post, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
}
```

- [ ] **Step 8: 创建 JWT 守卫**

创建 `server/src/common/guards/jwt-auth.guard.ts`:

```typescript
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
```

- [ ] **Step 9: 创建 JWT 策略**

安装依赖:
```bash
cd server
pnpm add passport-jwt @nestjs/passport passport
pnpm add -D @types/passport-jwt
```

创建 `server/src/auth/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.token;
        },
      ]),
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, role: user.role };
  }
}
```

- [ ] **Step 10: 创建当前用户装饰器**

创建 `server/src/common/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 11: 创建 AuthModule**

创建 `server/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import jwtConfig from '../config/jwt.config';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: jwtConfig,
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
```

- [ ] **Step 12: 更新 AppModule**

修改 `server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 13: 启用全局验证管道**

修改 `server/src/main.ts`，在 `bootstrap()` 中添加:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  
  await app.listen(3000);
  console.log('Server running on http://localhost:3000');
}

bootstrap();
```

- [ ] **Step 14: 测试认证接口**

运行服务器:
```bash
cd server
pnpm dev
```

测试注册:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt
```

预期输出: `{"user":{"id":"...","email":"test@example.com","role":"user"}}`

- [ ] **Step 15: 提交**

```bash
git add server/src/
git commit -m "feat(server): implement authentication module with JWT"
```

---

## Task 4: 实现对话管理模块（不含 Agent）

**Files:**
- Create: `server/src/conversations/conversations.module.ts`
- Create: `server/src/conversations/conversations.service.ts`
- Create: `server/src/conversations/conversations.controller.ts`
- Create: `server/src/conversations/dto/create-conversation.dto.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: 创建 DTO**

创建 `server/src/conversations/dto/create-conversation.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
```

- [ ] **Step 2: 创建 ConversationsService**

创建 `server/src/conversations/conversations.service.ts`:

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

  async create(userId: string, title: string): Promise<Conversation> {
    const conversation = this.conversationsRepository.create({
      userId,
      title,
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
    const conversation = await this.conversationsRepository.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return conversation;
  }

  async delete(id: string, userId: string): Promise<void> {
    const conversation = await this.findOne(id, userId);
    await this.conversationsRepository.remove(conversation);
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    await this.findOne(conversationId, userId);
    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async saveMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Promise<Message> {
    const message = this.messagesRepository.create({
      conversationId,
      role,
      content,
    });
    return this.messagesRepository.save(message);
  }
}
```

- [ ] **Step 3: 创建 ConversationsController**

创建 `server/src/conversations/conversations.controller.ts`:

```typescript
import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.conversationsService.findAllByUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(user.id, dto.title);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.conversationsService.delete(id, user.id);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: any) {
    return this.conversationsService.getMessages(id, user.id);
  }
}
```

- [ ] **Step 4: 创建 ConversationsModule**

创建 `server/src/conversations/conversations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
```

- [ ] **Step 5: 更新 AppModule**

修改 `server/src/app.module.ts`，添加 ConversationsModule:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    UsersModule,
    AuthModule,
    ConversationsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: 测试对话接口**

创建对话:
```bash
curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"测试对话"}'
```

预期输出: `{"id":"...","userId":"...","title":"测试对话","createdAt":"...","updatedAt":"..."}`

获取对话列表:
```bash
curl http://localhost:3000/conversations -b cookies.txt
```

预期输出: 对话数组

- [ ] **Step 7: 提交**

```bash
git add server/src/
git commit -m "feat(server): implement conversations module"
```

---

## Task 5: 实现 LangGraph Agent 模块

**Files:**
- Create: `server/src/agent/agent.module.ts`
- Create: `server/src/agent/agent.service.ts`
- Create: `server/src/agent/graph/conversation-graph.ts`
- Create: `server/src/conversations/dto/stream-message.dto.ts`
- Modify: `server/src/conversations/conversations.controller.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: 安装 LangGraph 依赖**

```bash
cd server
pnpm add @langchain/langgraph @langchain/core @langchain/deepseek
```

- [ ] **Step 2: 创建 StreamMessageDto**

创建 `server/src/conversations/dto/stream-message.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject } from 'class-validator';

export class StreamMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
```

- [ ] **Step 3: 创建 LangGraph 状态定义**

创建 `server/src/agent/types/conversation-state.ts`:

```typescript
import { BaseMessage } from '@langchain/core/messages';

export interface ConversationState {
  messages: BaseMessage[];
  conversationId: string;
  systemPrompt?: string;
}
```

- [ ] **Step 4: 创建 LangGraph 对话图**

创建 `server/src/agent/graph/conversation-graph.ts`:

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ChatDeepSeek } from '@langchain/deepseek';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ConversationState } from '../types/conversation-state';

export class ConversationGraph {
  private graph: StateGraph<ConversationState>;
  private llm: ChatDeepSeek;

  constructor(apiKey: string) {
    this.llm = new ChatDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      temperature: 0,
      streaming: true,
    });

    this.graph = new StateGraph<ConversationState>({
      channels: {
        messages: {
          reducer: (left: BaseMessage[], right: BaseMessage[]) => left.concat(right),
          default: () => [],
        },
        conversationId: {
          reducer: (left: string, right: string) => right || left,
          default: () => '',
        },
        systemPrompt: {
          reducer: (left: string | undefined, right: string | undefined) => right || left,
          default: () => undefined,
        },
      },
    });

    this.buildGraph();
  }

  private buildGraph() {
    this.graph.addNode('prepare_context', this.prepareContext.bind(this));
    this.graph.addNode('call_model', this.callModel.bind(this));
    
    this.graph.setEntryPoint('prepare_context');
    this.graph.addEdge('prepare_context', 'call_model');
    this.graph.addEdge('call_model', END);
  }

  private async prepareContext(state: ConversationState): Promise<Partial<ConversationState>> {
    const messages = [...state.messages];
    
    if (state.systemPrompt) {
      messages.unshift(new SystemMessage(state.systemPrompt));
    }
    
    return { messages };
  }

  private async callModel(state: ConversationState): Promise<Partial<ConversationState>> {
    const response = await this.llm.invoke(state.messages);
    return {
      messages: [new AIMessage(response.content as string)],
    };
  }

  compile() {
    return this.graph.compile();
  }
}
```

- [ ] **Step 5: 创建 AgentService**

创建 `server/src/agent/agent.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage } from '@langchain/core/messages';
import { ConversationGraph } from './graph/conversation-graph';
import { ConversationState } from './types/conversation-state';
import { Pool } from 'pg';

@Injectable()
export class AgentService {
  private checkpointer: PostgresSaver;
  private conversationGraph: ConversationGraph;

  constructor(private configService: ConfigService) {
    const pool = new Pool({
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      database: this.configService.get('DB_NAME'),
      user: this.configService.get('DB_USER'),
      password: this.configService.get('DB_PASSWORD'),
    });

    this.checkpointer = PostgresSaver.fromConnString(
      `postgresql://${this.configService.get('DB_USER')}:${this.configService.get('DB_PASSWORD')}@${this.configService.get('DB_HOST')}:${this.configService.get('DB_PORT')}/${this.configService.get('DB_NAME')}`
    );
    
    const deepseekApiKey = this.configService.get('DEEPSEEK_API_KEY');
    this.conversationGraph = new ConversationGraph(deepseekApiKey);
  }

  async *streamResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt?: string,
  ): AsyncGenerator<string, void, unknown> {
    const graph = this.conversationGraph.compile();
    const graphWithCheckpoint = graph.withConfig({
      checkpointer: this.checkpointer,
    });

    const input: ConversationState = {
      messages: [new HumanMessage(userMessage)],
      conversationId,
      systemPrompt,
    };

    const config = {
      configurable: {
        thread_id: conversationId,
      },
    };

    const stream = await graphWithCheckpoint.stream(input, config);

    for await (const chunk of stream) {
      if (chunk.call_model?.messages?.[0]?.content) {
        const content = chunk.call_model.messages[0].content;
        if (typeof content === 'string') {
          for (const char of content) {
            yield char;
          }
        }
      }
    }
  }
}
```

- [ ] **Step 6: 创建 AgentModule**

创建 `server/src/agent/agent.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentService } from './agent.service';

@Module({
  imports: [ConfigModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
```

- [ ] **Step 7: 在 ConversationsModule 中导入 AgentModule**

修改 `server/src/conversations/conversations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    AgentModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
```

- [ ] **Step 8: 在 ConversationsController 中添加 SSE 流式端点**

修改 `server/src/conversations/conversations.controller.ts`，添加以下导入和方法:

```typescript
// 添加导入
import { Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentService } from '../agent/agent.service';
import { StreamMessageDto } from './dto/stream-message.dto';

// 在 ConversationsController 类中修改 constructor:
constructor(
  private readonly conversationsService: ConversationsService,
  private readonly agentService: AgentService,
) {}

// 添加新方法:
@Post(':id/stream')
@UseGuards(JwtAuthGuard)
@Sse()
async streamMessage(
  @Param('id') id: string,
  @Body() streamMessageDto: StreamMessageDto,
  @CurrentUser() user: User,
): Promise<Observable<MessageEvent>> {
  const conversation = await this.conversationsService.findOne(id, user.id);
  
  await this.conversationsService.saveMessage(
    id,
    MessageRole.USER,
    streamMessageDto.content,
  );

  let systemPrompt: string | undefined;
  
  if (streamMessageDto.templateId) {
    // 模板渲染逻辑将在 Task 6 实现，这里先预留
    systemPrompt = undefined;
  }

  return new Observable<MessageEvent>((subscriber) => {
    (async () => {
      try {
        let fullResponse = '';
        
        for await (const token of this.agentService.streamResponse(
          id,
          streamMessageDto.content,
          systemPrompt,
        )) {
          fullResponse += token;
          subscriber.next({
            data: JSON.stringify({ token }),
          });
        }

        await this.conversationsService.saveMessage(
          id,
          MessageRole.ASSISTANT,
          fullResponse,
        );

        subscriber.next({
          data: '[DONE]',
        });
        
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
```

- [ ] **Step 9: 在 AppModule 中注册 AgentModule**

修改 `server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AgentModule } from './agent/agent.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    AuthModule,
    UsersModule,
    ConversationsModule,
    AgentModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 10: 安装 PostgresSaver 依赖**

```bash
cd server
pnpm add @langchain/langgraph-checkpoint-postgres pg
pnpm add -D @types/pg
```

- [ ] **Step 11: 测试 SSE 流式端点**

运行服务器:
```bash
cd server
pnpm start:dev
```

使用 curl 测试:

```bash
# 先登录获取 cookie
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# 创建会话
CONV_ID=$(curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"测试会话"}' \
  -b cookies.txt | jq -r '.id')

# 测试流式输出
curl -X POST "http://localhost:3000/conversations/$CONV_ID/stream" \
  -H "Content-Type: application/json" \
  -d '{"content":"你好"}' \
  -b cookies.txt \
  --no-buffer
```

预期输出:
```
data: {"token":"你"}
data: {"token":"好"}
data: {"token":"！"}
...
data: [DONE]
```

- [ ] **Step 12: 提交**

```bash
git add server/src/conversations/dto/stream-message.dto.ts \
  server/src/agent/types/conversation-state.ts \
  server/src/agent/graph/conversation-graph.ts \
  server/src/agent/agent.service.ts \
  server/src/agent/agent.module.ts \
  server/src/conversations/conversations.module.ts \
  server/src/conversations/conversations.controller.ts \
  server/src/app.module.ts \
  server/package.json

git commit -m "feat(server): implement LangGraph Agent with SSE streaming

- Add StreamMessageDto for stream endpoint validation
- Create ConversationState type for LangGraph state management
- Implement ConversationGraph with prepare_context and call_model nodes
- Add AgentService with PostgresSaver checkpoint and streaming support
- Create AgentModule and wire into ConversationsModule
- Add POST /conversations/:id/stream SSE endpoint
- Install @langchain/langgraph, @langchain/langgraph-checkpoint-postgres, and pg"
```

---

## Task 6: 实现模板管理模块

**Files:**
- Create: `server/src/templates/templates.module.ts`
- Create: `server/src/templates/templates.service.ts`
- Create: `server/src/templates/templates.controller.ts`
- Create: `server/src/templates/dto/create-template.dto.ts`
- Create: `server/src/templates/dto/update-template.dto.ts`
- Create: `server/src/templates/dto/create-version.dto.ts`
- Modify: `server/src/app.module.ts`
- Modify: `server/src/agent/agent.service.ts`

- [ ] **Step 1: 创建 DTO**

创建 `server/src/templates/dto/create-template.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TemplateVisibility } from '../entities/template.entity';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(TemplateVisibility)
  @IsOptional()
  visibility?: TemplateVisibility;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  variables?: Array<{ name: string; default: string }>;
}
```

创建 `server/src/templates/dto/update-template.dto.ts`:

```typescript
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { TemplateVisibility } from '../entities/template.entity';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TemplateVisibility)
  @IsOptional()
  visibility?: TemplateVisibility;
}
```

创建 `server/src/templates/dto/create-version.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateVersionDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  variables?: Array<{ name: string; default: string }>;
}
```

- [ ] **Step 2: 创建 TemplatesService**

创建 `server/src/templates/templates.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template, TemplateVisibility } from './entities/template.entity';
import { TemplateVersion } from './entities/template-version.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templatesRepository: Repository<Template>,
    @InjectRepository(TemplateVersion)
    private versionsRepository: Repository<TemplateVersion>,
  ) {}

  async create(
    userId: string,
    name: string,
    description: string,
    visibility: TemplateVisibility,
    content: string,
    variables: Array<{ name: string; default: string }>,
  ): Promise<Template> {
    const template = this.templatesRepository.create({
      userId,
      name,
      description,
      visibility,
    });
    const savedTemplate = await this.templatesRepository.save(template);

    const version = this.versionsRepository.create({
      templateId: savedTemplate.id,
      version: 1,
      content,
      variables: variables || [],
    });
    await this.versionsRepository.save(version);

    return savedTemplate;
  }

  async findAll(userId: string): Promise<Template[]> {
    return this.templatesRepository.find({
      where: [
        { userId },
        { visibility: TemplateVisibility.PUBLIC },
      ],
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, userRole: UserRole): Promise<Template> {
    const template = await this.templatesRepository.findOne({
      where: { id },
      relations: ['versions'],
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (
      template.visibility === TemplateVisibility.PRIVATE &&
      template.userId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Access denied');
    }

    return template;
  }

  async update(
    id: string,
    userId: string,
    userRole: UserRole,
    updates: { name?: string; description?: string; visibility?: TemplateVisibility },
  ): Promise<Template> {
    const template = await this.templatesRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(template, updates);
    return this.templatesRepository.save(template);
  }

  async delete(id: string, userId: string, userRole: UserRole): Promise<void> {
    const template = await this.templatesRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    await this.templatesRepository.remove(template);
  }

  async createVersion(
    templateId: string,
    userId: string,
    userRole: UserRole,
    content: string,
    variables: Array<{ name: string; default: string }>,
  ): Promise<TemplateVersion> {
    const template = await this.templatesRepository.findOne({ where: { id: templateId } });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    const latestVersion = await this.versionsRepository.findOne({
      where: { templateId },
      order: { version: 'DESC' },
    });

    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const version = this.versionsRepository.create({
      templateId,
      version: newVersionNumber,
      content,
      variables: variables || [],
    });

    return this.versionsRepository.save(version);
  }

  async getVersions(templateId: string, userId: string, userRole: UserRole): Promise<TemplateVersion[]> {
    await this.findOne(templateId, userId, userRole);
    return this.versionsRepository.find({
      where: { templateId },
      order: { version: 'DESC' },
    });
  }

  async getVersion(
    templateId: string,
    version: number,
    userId: string,
    userRole: UserRole,
  ): Promise<TemplateVersion> {
    await this.findOne(templateId, userId, userRole);
    const templateVersion = await this.versionsRepository.findOne({
      where: { templateId, version },
    });

    if (!templateVersion) {
      throw new NotFoundException('Version not found');
    }

    return templateVersion;
  }

  async rollback(
    templateId: string,
    version: number,
    userId: string,
    userRole: UserRole,
  ): Promise<TemplateVersion> {
    const targetVersion = await this.getVersion(templateId, version, userId, userRole);
    return this.createVersion(
      templateId,
      userId,
      userRole,
      targetVersion.content,
      targetVersion.variables,
    );
  }

  async getLatestVersion(templateId: string): Promise<TemplateVersion> {
    const version = await this.versionsRepository.findOne({
      where: { templateId },
      order: { version: 'DESC' },
    });

    if (!version) {
      throw new NotFoundException('No versions found for this template');
    }

    return version;
  }

  renderTemplate(content: string, variables: Record<string, string>): string {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    return rendered;
  }
}
```

- [ ] **Step 3: 创建 TemplatesController**

创建 `server/src/templates/templates.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { TemplateVisibility } from './entities/template.entity';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: User) {
    return this.templatesService.create(
      user.id,
      dto.name,
      dto.description,
      dto.visibility || TemplateVisibility.PRIVATE,
      dto.content,
      dto.variables || [],
    );
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.templatesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const template = await this.templatesService.findOne(id, user.id, user.role);
    const latestVersion = await this.templatesService.getLatestVersion(id);
    return {
      ...template,
      latestVersion,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: User,
  ) {
    return this.templatesService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.templatesService.delete(id, user.id, user.role);
    return { message: 'Template deleted successfully' };
  }

  @Post(':id/versions')
  async createVersion(
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.templatesService.createVersion(
      id,
      user.id,
      user.role,
      dto.content,
      dto.variables || [],
    );
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string, @CurrentUser() user: User) {
    return this.templatesService.getVersions(id, user.id, user.role);
  }

  @Get(':id/versions/:version')
  async getVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentUser() user: User,
  ) {
    return this.templatesService.getVersion(id, parseInt(version), user.id, user.role);
  }

  @Post(':id/versions/:version/rollback')
  async rollback(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentUser() user: User,
  ) {
    return this.templatesService.rollback(id, parseInt(version), user.id, user.role);
  }
}
```

- [ ] **Step 4: 创建 TemplatesModule**

创建 `server/src/templates/templates.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { Template } from './entities/template.entity';
import { TemplateVersion } from './entities/template-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Template, TemplateVersion])],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
```

- [ ] **Step 5: 在 AppModule 中注册 TemplatesModule**

修改 `server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AgentModule } from './agent/agent.module';
import { TemplatesModule } from './templates/templates.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    AuthModule,
    UsersModule,
    ConversationsModule,
    AgentModule,
    TemplatesModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: 在 ConversationsModule 中导入 TemplatesModule**

修改 `server/src/conversations/conversations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { AgentModule } from '../agent/agent.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    AgentModule,
    TemplatesModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
```

- [ ] **Step 7: 在 ConversationsController 中集成模板渲染**

修改 `server/src/conversations/conversations.controller.ts` 的 `streamMessage` 方法:

```typescript
// 在 ConversationsController 类中添加 TemplatesService 注入:
constructor(
  private readonly conversationsService: ConversationsService,
  private readonly agentService: AgentService,
  private readonly templatesService: TemplatesService,
) {}

// 修改 streamMessage 方法中的模板处理部分:
@Post(':id/stream')
@UseGuards(JwtAuthGuard)
@Sse()
async streamMessage(
  @Param('id') id: string,
  @Body() streamMessageDto: StreamMessageDto,
  @CurrentUser() user: User,
): Promise<Observable<MessageEvent>> {
  const conversation = await this.conversationsService.findOne(id, user.id);
  
  await this.conversationsService.saveMessage(
    id,
    MessageRole.USER,
    streamMessageDto.content,
  );

  let systemPrompt: string | undefined;
  
  if (streamMessageDto.templateId) {
    const latestVersion = await this.templatesService.getLatestVersion(
      streamMessageDto.templateId,
    );
    systemPrompt = this.templatesService.renderTemplate(
      latestVersion.content,
      streamMessageDto.variables || {},
    );
  }

  return new Observable<MessageEvent>((subscriber) => {
    (async () => {
      try {
        let fullResponse = '';
        
        for await (const token of this.agentService.streamResponse(
          id,
          streamMessageDto.content,
          systemPrompt,
        )) {
          fullResponse += token;
          subscriber.next({
            data: JSON.stringify({ token }),
          });
        }

        await this.conversationsService.saveMessage(
          id,
          MessageRole.ASSISTANT,
          fullResponse,
        );

        subscriber.next({
          data: '[DONE]',
        });
        
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
```

- [ ] **Step 8: 测试模板 API**

运行服务器:
```bash
cd server
pnpm start:dev
```

测试创建模板:
```bash
curl -X POST http://localhost:3000/templates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "翻译助手",
    "description": "将内容翻译成指定语言",
    "visibility": "private",
    "content": "你是一个专业的{{角色}}，请将用户的内容翻译成{{语言}}。",
    "variables": [
      {"name": "角色", "default": "翻译专家"},
      {"name": "语言", "default": "英文"}
    ]
  }'
```

预期输出: 模板对象包含 id

测试使用模板对话:
```bash
TEMPLATE_ID="<上一步返回的模板ID>"

curl -X POST "http://localhost:3000/conversations/$CONV_ID/stream" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"content\": \"你好，世界\",
    \"templateId\": \"$TEMPLATE_ID\",
    \"variables\": {
      \"角色\": \"翻译专家\",
      \"语言\": \"英文\"
    }
  }" \
  --no-buffer
```

预期输出: AI 按照模板指令翻译内容

- [ ] **Step 9: 提交**

```bash
git add server/src/templates/ \
  server/src/conversations/conversations.module.ts \
  server/src/conversations/conversations.controller.ts \
  server/src/app.module.ts

git commit -m "feat(server): implement template management module

- Add CreateTemplateDto, UpdateTemplateDto, CreateVersionDto
- Implement TemplatesService with CRUD, version control, and rollback
- Add TemplatesController with all template endpoints
- Create TemplatesModule and wire into AppModule
- Integrate template rendering into conversation streaming
- Support variable substitution with {{variable}} syntax"
```

---

## Task 7: 实现前端应用

**Files:**
- Create: `front/src/types/index.ts`
- Create: `front/src/api/client.ts`
- Create: `front/src/api/auth.ts`
- Create: `front/src/api/conversations.ts`
- Create: `front/src/api/templates.ts`
- Create: `front/src/contexts/AuthContext.tsx`
- Create: `front/src/components/Layout.tsx`
- Create: `front/src/components/Sidebar.tsx`
- Create: `front/src/pages/LoginPage.tsx`
- Create: `front/src/pages/RegisterPage.tsx`
- Create: `front/src/pages/ChatPage.tsx`
- Create: `front/src/pages/TemplatesPage.tsx`
- Create: `front/src/components/MessageList.tsx`
- Create: `front/src/components/MessageInput.tsx`
- Create: `front/src/components/TemplateSelector.tsx`
- Modify: `front/src/App.tsx`
- Modify: `front/src/main.tsx`

- [ ] **Step 1: 安装依赖**

```bash
cd front
pnpm add react-router-dom
pnpm add -D @types/react-router-dom
```

- [ ] **Step 2: 创建类型定义**

创建 `front/src/types/index.ts`:

```typescript
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum TemplateVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
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

export interface Template {
  id: string;
  userId: string;
  name: string;
  description: string;
  visibility: TemplateVisibility;
  createdAt: string;
  updatedAt: string;
  latestVersion?: TemplateVersion;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  variables: Array<{ name: string; default: string }>;
  createdAt: string;
}
```

- [ ] **Step 3: 创建 API 客户端**

创建 `front/src/api/client.ts`:

```typescript
const API_BASE_URL = 'http://localhost:3000';

export async function fetchAPI(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response;
}
```

创建 `front/src/api/auth.ts`:

```typescript
import { fetchAPI } from './client';
import { User } from '../types';

export async function register(email: string, password: string): Promise<User> {
  const response = await fetchAPI('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetchAPI('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function logout(): Promise<void> {
  await fetchAPI('/auth/logout', { method: 'POST' });
}
```

创建 `front/src/api/conversations.ts`:

```typescript
import { fetchAPI } from './client';
import { Conversation, Message } from '../types';

export async function getConversations(): Promise<Conversation[]> {
  const response = await fetchAPI('/conversations');
  return response.json();
}

export async function createConversation(title: string): Promise<Conversation> {
  const response = await fetchAPI('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
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

export async function streamMessage(
  conversationId: string,
  content: string,
  templateId?: string,
  variables?: Record<string, string>,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`http://localhost:3000/conversations/${conversationId}/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, templateId, variables }),
  });

  if (!response.ok || !response.body) {
    throw new Error('Stream failed');
  }

  return response.body;
}
```

创建 `front/src/api/templates.ts`:

```typescript
import { fetchAPI } from './client';
import { Template, TemplateVersion, TemplateVisibility } from '../types';

export async function getTemplates(): Promise<Template[]> {
  const response = await fetchAPI('/templates');
  return response.json();
}

export async function createTemplate(data: {
  name: string;
  description: string;
  visibility: TemplateVisibility;
  content: string;
  variables: Array<{ name: string; default: string }>;
}): Promise<Template> {
  const response = await fetchAPI('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getTemplate(id: string): Promise<Template> {
  const response = await fetchAPI(`/templates/${id}`);
  return response.json();
}

export async function updateTemplate(
  id: string,
  data: { name?: string; description?: string; visibility?: TemplateVisibility },
): Promise<Template> {
  const response = await fetchAPI(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetchAPI(`/templates/${id}`, { method: 'DELETE' });
}

export async function getVersions(templateId: string): Promise<TemplateVersion[]> {
  const response = await fetchAPI(`/templates/${templateId}/versions`);
  return response.json();
}
```

- [ ] **Step 4: 创建 AuthContext**

创建 `front/src/contexts/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import * as authAPI from '../api/auth';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const user = await authAPI.login(email, password);
    setUser(user);
  };

  const register = async (email: string, password: string) => {
    const user = await authAPI.register(email, password);
    setUser(user);
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

- [ ] **Step 5: 创建登录页面**

创建 `front/src/pages/LoginPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>登录</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>邮箱:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
        <button type="submit" style={{ width: '100%', padding: '10px' }}>
          登录
        </button>
      </form>
      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        还没有账号? <Link to="/register">注册</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 6: 创建注册页面**

创建 `front/src/pages/RegisterPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h1>注册</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>邮箱:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>密码:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
        <button type="submit" style={{ width: '100%', padding: '10px' }}>
          注册
        </button>
      </form>
      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        已有账号? <Link to="/login">登录</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 7: 创建 Sidebar 组件**

创建 `front/src/components/Sidebar.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Conversation } from '../types';
import * as conversationsAPI from '../api/conversations';

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await conversationsAPI.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const conversation = await conversationsAPI.createConversation('新对话');
      setConversations([conversation, ...conversations]);
      navigate(`/chat/${conversation.id}`);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  return (
    <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '20px' }}>
      <button onClick={handleNewChat} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
        新建对话
      </button>
      <Link to="/templates" style={{ display: 'block', marginBottom: '20px' }}>
        模板管理
      </Link>
      <h3>对话列表</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {conversations.map((conv) => (
          <li key={conv.id} style={{ marginBottom: '10px' }}>
            <Link to={`/chat/${conv.id}`}>{conv.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: 创建 Layout 组件**

创建 `front/src/components/Layout.tsx`:

```typescript
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export function Layout() {
  const { logout } = useAuth();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '10px 20px', borderBottom: '1px solid #ccc' }}>
          <button onClick={logout}>退出登录</button>
        </header>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: 创建 MessageList 组件**

创建 `front/src/components/MessageList.tsx`:

```typescript
import { Message, MessageRole } from '../types';

interface MessageListProps {
  messages: Message[];
  streamingMessage?: string;
}

export function MessageList({ messages, streamingMessage }: MessageListProps) {
  return (
    <div style={{ padding: '20px' }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: msg.role === MessageRole.USER ? '#e3f2fd' : '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <strong>{msg.role === MessageRole.USER ? '你' : 'AI'}:</strong>
          <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        </div>
      ))}
      {streamingMessage && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
          }}
        >
          <strong>AI:</strong>
          <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{streamingMessage}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 10: 创建 TemplateSelector 组件**

创建 `front/src/components/TemplateSelector.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { Template } from '../types';
import * as templatesAPI from '../api/templates';

interface TemplateSelectorProps {
  onSelect: (templateId: string, variables: Record<string, string>) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templatesAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    const initialVars: Record<string, string> = {};
    template.latestVersion?.variables.forEach((v) => {
      initialVars[v.name] = v.default;
    });
    setVariables(initialVars);
  };

  const handleSubmit = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate.id, variables);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '500px' }}>
        <h2>选择模板</h2>
        <select
          onChange={(e) => {
            const template = templates.find((t) => t.id === e.target.value);
            if (template) handleTemplateSelect(template);
          }}
          style={{ width: '100%', padding: '8px', marginBottom: '15px' }}
        >
          <option value="">-- 选择模板 --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {selectedTemplate && selectedTemplate.latestVersion && (
          <div>
            <h3>变量</h3>
            {selectedTemplate.latestVersion.variables.map((v) => (
              <div key={v.name} style={{ marginBottom: '10px' }}>
                <label>{v.name}:</label>
                <input
                  type="text"
                  value={variables[v.name] || ''}
                  onChange={(e) => setVariables({ ...variables, [v.name]: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} disabled={!selectedTemplate} style={{ flex: 1, padding: '10px' }}>
            确定
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '10px' }}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: 创建 MessageInput 组件**

创建 `front/src/components/MessageInput.tsx`:

```typescript
import { useState } from 'react';
import { TemplateSelector } from './TemplateSelector';

interface MessageInputProps {
  onSend: (content: string, templateId?: string, variables?: Record<string, string>) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
      onSend(content);
      setContent('');
    }
  };

  const handleTemplateSelect = (templateId: string, variables: Record<string, string>) => {
    if (content.trim() && !disabled) {
      onSend(content, templateId, variables);
      setContent('');
    }
  };

  return (
    <div style={{ padding: '20px', borderTop: '1px solid #ccc' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入消息..."
            disabled={disabled}
            style={{ flex: 1, padding: '10px', fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            disabled={disabled || !content.trim()}
            style={{ padding: '10px 20px' }}
          >
            使用模板
          </button>
          <button type="submit" disabled={disabled || !content.trim()} style={{ padding: '10px 20px' }}>
            发送
          </button>
        </div>
      </form>
      {showTemplateSelector && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 12: 创建 ChatPage 组件**

创建 `front/src/pages/ChatPage.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Message, MessageRole } from '../types';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import * as conversationsAPI from '../api/conversations';

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (id) {
      loadMessages();
    }
  }, [id]);

  const loadMessages = async () => {
    if (!id) return;
    try {
      const data = await conversationsAPI.getMessages(id);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSend = async (
    content: string,
    templateId?: string,
    variables?: Record<string, string>,
  ) => {
    let conversationId = id;

    if (!conversationId) {
      const conversation = await conversationsAPI.createConversation('新对话');
      conversationId = conversation.id;
      navigate(`/chat/${conversationId}`);
    }

    setIsStreaming(true);
    setStreamingMessage('');

    try {
      const stream = await conversationsAPI.streamMessage(
        conversationId,
        content,
        templateId,
        variables,
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
              await loadMessages();
              setStreamingMessage('');
              setIsStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                setStreamingMessage((prev) => prev + parsed.token);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Stream failed:', err);
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <MessageList messages={messages} streamingMessage={streamingMessage} />
      </div>
      <MessageInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
```

- [ ] **Step 13: 创建 TemplatesPage 组件**

创建 `front/src/pages/TemplatesPage.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Template, TemplateVisibility } from '../types';
import * as templatesAPI from '../api/templates';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: TemplateVisibility.PRIVATE,
    content: '',
    variables: [] as Array<{ name: string; default: string }>,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templatesAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await templatesAPI.createTemplate(formData);
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        visibility: TemplateVisibility.PRIVATE,
        content: '',
        variables: [],
      });
      loadTemplates();
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    try {
      await templatesAPI.deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const addVariable = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, { name: '', default: '' }],
    });
  };

  const updateVariable = (index: number, field: 'name' | 'default', value: string) => {
    const newVariables = [...formData.variables];
    newVariables[index][field] = value;
    setFormData({ ...formData, variables: newVariables });
  };

  const removeVariable = (index: number) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index),
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>模板管理</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px' }}>
          {showForm ? '取消' : '创建模板'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '15px' }}>
            <label>名称:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>描述:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>可见性:</label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as TemplateVisibility })}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value={TemplateVisibility.PRIVATE}>私有</option>
              <option value={TemplateVisibility.PUBLIC}>公开</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>内容 (使用 {'{{'} 变量名 {'}}'}  作为占位符):</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '100px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>变量:</label>
            <button type="button" onClick={addVariable} style={{ marginLeft: '10px', padding: '5px 10px' }}>
              添加变量
            </button>
            {formData.variables.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="变量名"
                  value={v.name}
                  onChange={(e) => updateVariable(i, 'name', e.target.value)}
                  style={{ flex: 1, padding: '8px' }}
                />
                <input
                  type="text"
                  placeholder="默认值"
                  value={v.default}
                  onChange={(e) => updateVariable(i, 'default', e.target.value)}
                  style={{ flex: 1, padding: '8px' }}
                />
                <button type="button" onClick={() => removeVariable(i)} style={{ padding: '8px' }}>
                  删除
                </button>
              </div>
            ))}
          </div>
          <button type="submit" style={{ padding: '10px 20px' }}>
            创建
          </button>
        </form>
      )}

      <div>
        {templates.map((template) => (
          <div key={template.id} style={{ padding: '15px', marginBottom: '15px', border: '1px solid #ccc' }}>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <p>
              <small>
                可见性: {template.visibility === TemplateVisibility.PUBLIC ? '公开' : '私有'} | 版本:{' '}
                {template.latestVersion?.version || 0}
              </small>
            </p>
            <button onClick={() => handleDelete(template.id)} style={{ padding: '5px 10px' }}>
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 14: 修改 App.tsx 配置路由**

修改 `front/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { Layout } from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
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
            <Route index element={<Navigate to="/chat" />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:id" element={<ChatPage />} />
            <Route path="templates" element={<TemplatesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

- [ ] **Step 15: 修改 main.tsx**

修改 `front/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 16: 测试前端应用**

运行前端:
```bash
cd front
pnpm dev
```

测试流程:
1. 访问 http://localhost:5173
2. 注册新用户
3. 登录
4. 创建新对话
5. 发送消息，观察 SSE 流式输出
6. 进入模板管理页面
7. 创建新模板（包含变量）
8. 返回对话页面，使用模板发送消息
9. 验证模板变量替换正确

预期结果: 所有功能正常工作，SSE 流式输出逐字显示

- [ ] **Step 17: 提交**

```bash
git add front/src/
git commit -m "feat(front): implement React frontend with SSE streaming

- Add type definitions for all entities
- Create API client with auth, conversations, and templates endpoints
- Implement AuthContext for authentication state management
- Add LoginPage and RegisterPage
- Create Layout with Sidebar for navigation
- Implement ChatPage with MessageList, MessageInput, and SSE streaming
- Add TemplateSelector for choosing and configuring templates
- Create TemplatesPage for template CRUD operations
- Configure React Router with private routes
- Support real-time streaming message display"
```

---

## 计划自审

**占位符检查:** ✓ 无 TBD、TODO 或不完整部分

**类型一致性检查:**
- `User.role` → `UserRole` enum ✓
- `Message.role` → `MessageRole` enum ✓
- `Template.visibility` → `TemplateVisibility` enum ✓
- `ConversationState` 在 LangGraph 中定义并使用 ✓
- API 端点路径在前后端保持一致 ✓

**规范覆盖检查:**
- ✓ NestJS 初始化与模块化架构
- ✓ TypeORM 实体与数据库迁移
- ✓ JWT 认证（HttpOnly Cookie）
- ✓ 对话 CRUD 与消息管理
- ✓ LangGraph Agent 与 SSE 流式输出
- ✓ 模板 CRUD、版本控制、变量替换
- ✓ React 前端与路由
- ✓ SSE 流式消息显示
- ✓ 模板选择器与变量填充

**所有需求已覆盖，无遗漏。**

---

## 执行方式选择

计划已完成并保存至 `docs/superpowers/plans/2026-05-28-ai-agent-platform.md`。

**两种执行方式:**

**1. 子代理驱动（推荐）** - 每个任务派发新的子代理，任务间审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 技能执行任务，批量执行带检查点

**选择哪种方式？**
