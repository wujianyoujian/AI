import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { TemplateVisibility } from '../entities/template.entity';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;

  @IsEnum(TemplateVisibility)
  @IsOptional()
  visibility?: TemplateVisibility;
}
