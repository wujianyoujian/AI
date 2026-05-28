import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, ParseIntPipe } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { TemplateVisibility } from './entities/template.entity';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthenticatedUser) {
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
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const template = await this.templatesService.findOne(id, user.id, user.role);
    const latestVersion = await this.templatesService.getLatestVersion(id);
    return { ...template, latestVersion };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.templatesService.delete(id, user.id, user.role);
  }

  @Post(':id/versions')
  async createVersion(@Param('id') id: string, @Body() dto: CreateVersionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.createVersion(id, user.id, user.role, dto.content, dto.variables || []);
  }

  @Get(':id/versions')
  async getVersions(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.getVersions(id, user.id, user.role);
  }

  @Get(':id/versions/:version')
  async getVersion(@Param('id') id: string, @Param('version', ParseIntPipe) version: number, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.getVersion(id, version, user.id, user.role);
  }

  @Post(':id/versions/:version/rollback')
  async rollback(@Param('id') id: string, @Param('version', ParseIntPipe) version: number, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.rollback(id, version, user.id, user.role);
  }
}
