import { IsString, IsNotEmpty, IsOptional, IsUUID, IsObject } from 'class-validator';

export class StreamMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
