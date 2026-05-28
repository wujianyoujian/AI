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
