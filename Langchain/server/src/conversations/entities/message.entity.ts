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

  @Column({ name: 'reasoning_content', type: 'text', nullable: true })
  reasoningContent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  timing: { ttft: number; thinking: number; total: number } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
