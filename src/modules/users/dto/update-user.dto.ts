import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  displayName?: string;

  @IsOptional()
  avatar?: string;

  @IsOptional()
  isOnline?: boolean;
}