import { IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  roomId: string;

  @IsNotEmpty()
  content: string;

  @IsOptional()
  type?: string;
}

export class SendDirectMessageDto {
  @IsNotEmpty()
  @IsMongoId()
  receiverId: string;

  @IsNotEmpty()
  content: string;

  @IsOptional()
  type?: string;
}

export class JoinRoomDto {
  @IsNotEmpty()
  roomId: string;

  @IsOptional()
  password?: string;
}

export class LoadOlderMessagesDto {
  @IsNotEmpty()
  roomId: string;

  @IsNotEmpty()
  lastMessageId: string;

  @IsOptional()
  limit?: number;
}