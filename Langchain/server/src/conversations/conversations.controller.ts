import { Controller, Get, Post, Delete, Param, Body, UseGuards, Sse, HttpCode } from '@nestjs/common';
import { Observable } from 'rxjs';
import { performance } from 'perf_hooks';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { StreamMessageDto } from './dto/stream-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AgentService, HistoryMessage } from '../agent/agent.service';
import { TemplatesService } from '../templates/templates.service';
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
    private templatesService: TemplatesService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.findAllByUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(user.id, dto.title);
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

          const history: HistoryMessage[] = existingMessages.map((m) => ({
            role: m.role === MessageRole.USER ? 'user' : 'assistant',
            content: m.content,
          }));

          const { recentHistory, needsSummarize } = this.agentService.trimBuffer(history);

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
          let fullReasoning = '';
          const streamStart = performance.now();
          let firstChunk = true;
          let ttft: number | null = null;

          for await (const chunk of this.agentService.streamResponse(
            id,
            streamMessageDto.content,
            systemPrompt,
            recentHistory,
          )) {
            if (firstChunk) {
              ttft = (performance.now() - streamStart) / 1000;
              t('firstChunk', s);
              firstChunk = false;
            }
            // chunk is already JSON: { token } or { reasoning }
            const parsed = JSON.parse(chunk) as { token?: string; reasoning?: string };
            if (parsed.token) fullResponse += parsed.token;
            if (parsed.reasoning) fullReasoning += parsed.reasoning;
            subscriber.next({ data: chunk });
          }
          t('streamComplete', s);

          const total = (performance.now() - streamStart) / 1000;
          const timing = ttft !== null
            ? { ttft: Math.round(ttft * 10) / 10, total: Math.round(total * 10) / 10 }
            : null;

          s = performance.now();
          await this.conversationsService.saveMessage(
            id,
            MessageRole.ASSISTANT,
            fullResponse,
            fullReasoning || null,
            timing,
          );
          t('saveAssistantMessage', s);

          subscriber.next({ data: '[DONE]' });
          subscriber.complete();

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
}
