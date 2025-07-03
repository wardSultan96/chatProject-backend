import { IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class CreateRoomDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  password?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;
}