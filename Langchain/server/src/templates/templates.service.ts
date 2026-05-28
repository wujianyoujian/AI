import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template, TemplateVisibility } from './entities/template.entity';
import { TemplateVersion } from './entities/template-version.entity';
import { UserRole } from '../users/entities/user.entity';

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
    const template = this.templatesRepository.create({ userId, name, description, visibility });
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
      relations: { versions: true },
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
    if (!template) throw new NotFoundException('Template not found');
    if (template.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }
    Object.assign(template, updates);
    return this.templatesRepository.save(template);
  }

  async delete(id: string, userId: string, userRole: UserRole): Promise<void> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
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
    if (!template) throw new NotFoundException('Template not found');
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

  async getVersion(templateId: string, version: number, userId: string, userRole: UserRole): Promise<TemplateVersion> {
    await this.findOne(templateId, userId, userRole);
    const templateVersion = await this.versionsRepository.findOne({ where: { templateId, version } });
    if (!templateVersion) throw new NotFoundException('Version not found');
    return templateVersion;
  }

  async rollback(templateId: string, version: number, userId: string, userRole: UserRole): Promise<TemplateVersion> {
    const targetVersion = await this.getVersion(templateId, version, userId, userRole);
    return this.createVersion(templateId, userId, userRole, targetVersion.content, targetVersion.variables);
  }

  async getLatestVersion(templateId: string): Promise<TemplateVersion> {
    const version = await this.versionsRepository.findOne({
      where: { templateId },
      order: { version: 'DESC' },
    });
    if (!version) throw new NotFoundException('No versions found for this template');
    return version;
  }

  renderTemplate(content: string, variables: Record<string, string>): string {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.split(`{{${key}}}`).join(value);
    }
    return rendered;
  }
}
