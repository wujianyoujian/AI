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
    const conversation = this.conversationsRepository.create({ userId, title });
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

  async saveMessage(conversationId: string, role: MessageRole, content: string): Promise<Message> {
    const message = this.messagesRepository.create({ conversationId, role, content });
    return this.messagesRepository.save(message);
  }
}
