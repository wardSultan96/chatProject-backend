import { Controller, Get, Post, Body, Param, Query, Request, Delete } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetUser } from 'src/guards/get-user.decorator';
import { IUserDocument } from '../users/schemas/user.schema';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  @Get('room/:roomId')
  findRoomMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.messagesService.findRoomMessages(roomId, limit, offset);
  }

  @Get('direct/:userId')
  findDirectMessages(
    @Param('userId') otherUserId: string,
    @GetUser() user:IUserDocument,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.messagesService.findDirectMessages(user._id, otherUserId, limit, offset);
  }

  @Get('conversations')
  findUserConversations(@GetUser() user:IUserDocument) {
  
    return this.messagesService.findUserConversations(user._id.toString());
  }

  @Post('mark-read')
  markAsRead(@Body('messageIds') messageIds: string[]) {
    return this.messagesService.markAsRead(messageIds);
  }

  @Delete(':id')
  deleteMessage(@Param('id') id: string, @GetUser() user:IUserDocument) {
    return this.messagesService.deleteMessage(id, user._id);
  }
}