import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(@InjectModel(Room.name) private roomModel: Model<RoomDocument>) {}

  async create(createRoomDto: CreateRoomDto, creatorId: string): Promise<Room> {
    const createdRoom = new this.roomModel({
      ...createRoomDto,
      createdBy: creatorId,
      members: [creatorId],
    });
    return createdRoom.save();
  }

  async findAll(userId:string): Promise<Room[]> {
 
    return this.roomModel.find({ isPrivate: false }).populate('createdBy', 'username displayName').exec();
  }

  async findUserRooms(userIdString: string): Promise<Room[]> {
    const  userId =new Types.ObjectId(userIdString)
    return this.roomModel
      .find({ members: userId })
      .populate('createdBy', 'username displayName')
      .exec();
  }

  async findOne(id: string): Promise<Room> {
   
    const room = await this.roomModel
      .findById(id)
      .populate('createdBy', 'username displayName')
      .populate('members', 'username displayName isOnline')
      .exec();
    
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, userId: string): Promise<Room> {
    const room = await this.roomModel.findById(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only room creator can update room settings');
    }

    const updatedRoom = await this.roomModel
      .findByIdAndUpdate(id, updateRoomDto, { new: true })
      .populate('createdBy', 'username displayName')
      .exec();
    
    return updatedRoom;
  }

  async joinRoom(roomId: string, userIdString: string): Promise<Room> {
    const userId=new Types.ObjectId(userIdString)
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.members.includes(userId as unknown as Types.ObjectId)) {
      return room; // User already in room
    }

    return this.roomModel
      .findByIdAndUpdate(
        roomId,
        { $addToSet: { members: userId } },
        { new: true }
      )
      .populate('members', 'username displayName isOnline')
      .exec();
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomModel.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.roomModel
      .findByIdAndUpdate(
        roomId,
        { $pull: { members: userId } },
        { new: true }
      )
      .populate('members', 'username displayName isOnline')
      .exec();
  }

  async remove(id: string, userId: string): Promise<void> {
    const room = await this.roomModel.findById(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only room creator can delete the room');
    }

    await this.roomModel.findByIdAndDelete(id).exec();
  }
}