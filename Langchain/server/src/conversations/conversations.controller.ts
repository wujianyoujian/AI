import { Controller, Get, Post, Delete, Param, Body, UseGuards, Sse, HttpCode } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { StreamMessageDto } from './dto/stream-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AgentService, HistoryMessage, BufferResult } from '../agent/agent.service';
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
        try {
          const conversation = await this.conversationsService.findOne(id, user.id);

          // Build history from existing messages
          const existingMessages = await this.conversationsService.getMessages(id, user.id);
          if (existingMessages.length === 0) {
            const title = streamMessageDto.content.slice(0, 30).replace(/\n/g, ' ');
            await this.conversationsService.updateTitle(id, title);
          }

          const history: HistoryMessage[] = existingMessages.map((m) => ({
            role: m.role === MessageRole.USER ? 'user' : 'assistant',
            content: m.content,
          }));

          // Manage buffer: summarize overflow, keep recent messages
          const buffer = await this.agentService.prepareBuffer(
            history,
            conversation.summary,
          );

          if (buffer.summaryUpdated && buffer.summary) {
            await this.conversationsService.updateSummary(id, buffer.summary);
          }

          await this.conversationsService.saveMessage(
            id,
            MessageRole.USER,
            streamMessageDto.content,
          );

          // Build system prompt: summary (if any) + template prompt (if any)
          let systemPrompt: string | undefined;

          if (streamMessageDto.templateId) {
            const latestVersion = await this.templatesService.getLatestVersion(
              streamMessageDto.templateId,
            );
            const templatePrompt = this.templatesService.renderTemplate(
              latestVersion.content,
              streamMessageDto.variables || {},
            );
            systemPrompt = buffer.summary
              ? `[对话历史摘要]\n${buffer.summary}\n\n${templatePrompt}`
              : templatePrompt;
          } else if (buffer.summary) {
            systemPrompt = `[对话历史摘要]\n${buffer.summary}`;
          }

          let fullResponse = '';

          for await (const token of this.agentService.streamResponse(
            id,
            streamMessageDto.content,
            systemPrompt,
            buffer.recentHistory,
          )) {
            fullResponse += token;
            subscriber.next({ data: JSON.stringify({ token }) });
          }

          await this.conversationsService.saveMessage(
            id,
            MessageRole.ASSISTANT,
            fullResponse,
          );

          subscriber.next({ data: '[DONE]' });
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
