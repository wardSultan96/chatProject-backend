import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetUser } from 'src/guards/get-user.decorator';
import { IUserDocument } from '../users/schemas/user.schema';
import { Roles } from 'src/guards/roles.decorator';
import { ROLES } from '../users/enum/users.role';
import { JwtSocketGuard } from 'src/guards/jwt-socket.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  @Roles(ROLES.ADMIN, ROLES.USER)
  @UseGuards(JwtSocketGuard)
  @Post()
  create(@Body() createRoomDto: CreateRoomDto, @GetUser() user: IUserDocument) {

    return this.roomsService.create(createRoomDto, user._id);
  }

  @Get()
  findAll(@GetUser() user:IUserDocument) {
  
    return this.roomsService.findAll(user._id);
  }

  @Get('my-rooms')
  findUserRooms(@GetUser() user: IUserDocument) {

    return this.roomsService.findUserRooms(user._id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
 
    return this.roomsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto,@GetUser() user:IUserDocument) {
    return this.roomsService.update(id, updateRoomDto, user?._id);
  }

  @Post(':id/join')
  joinRoom(@Param('id') id: string, @GetUser() user:IUserDocument) {
   
    return this.roomsService.joinRoom(id, user._id);
  }

  @Post(':id/leave')
  leaveRoom(@Param('id') id: string, @GetUser() user:IUserDocument) {
    return this.roomsService.leaveRoom(id, user._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string,@GetUser() user:IUserDocument) {
    return this.roomsService.remove(id, user._id);
  }
}