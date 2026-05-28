import { Controller, Get, Post, Delete, Param, Body, UseGuards, Sse, HttpCode } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { StreamMessageDto } from './dto/stream-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AgentService } from '../agent/agent.service';
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
          await this.conversationsService.findOne(id, user.id);

          await this.conversationsService.saveMessage(
            id,
            MessageRole.USER,
            streamMessageDto.content,
          );

          let fullResponse = '';

          for await (const token of this.agentService.streamResponse(
            id,
            streamMessageDto.content,
            undefined,
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
