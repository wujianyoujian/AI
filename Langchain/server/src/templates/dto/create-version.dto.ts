import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateVersionDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  variables?: Array<{ name: string; default: string }>;
}
