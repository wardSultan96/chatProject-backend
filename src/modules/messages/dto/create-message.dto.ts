import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsMongoId, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateMessageDto {

  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  roomId: Types.ObjectId;

  @IsMongoId()
  @Transform(({ value }) => new Types.ObjectId(value))
  senderId: Types.ObjectId;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => value ? new Types.ObjectId(value) : null)
  receiverId?: Types.ObjectId;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  type?: string;
  
  @IsOptional()
  metadata?: Record<string, any>;
}