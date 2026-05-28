import { IsString, IsEnum, IsOptional } from 'class-validator';
import { TemplateVisibility } from '../entities/template.entity';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TemplateVisibility)
  @IsOptional()
  visibility?: TemplateVisibility;
}
