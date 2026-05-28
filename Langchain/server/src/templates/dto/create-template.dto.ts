import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TemplateVisibility } from '../entities/template.entity';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(TemplateVisibility)
  @IsOptional()
  visibility?: TemplateVisibility;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  variables?: Array<{ name: string; default: string }>;
}
