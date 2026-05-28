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
