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
