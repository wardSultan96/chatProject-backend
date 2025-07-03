import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IUserDocument, User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<IUserDocument>) {}

  async create(createUserDto: CreateUserDto): Promise<IUserDocument> {
    const existingUser = await this.userModel.findOne({
      $or: [
        { email: createUserDto.email },
        { username: createUserDto.username },
      ],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').exec();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<IUserDocument> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByUsername(username: string): Promise<User> {
    return this.userModel.findOne({ username }).select('-password').exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();
    
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastSeen: new Date() }).exec();
  }

  async setOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { 
        isOnline,
        lastSeen: new Date(),
      })
      .exec();
  }
}