import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ROLES } from '../enum/users.role';

export type UserDocument = User & Document;

export interface IUser {
  username: string;
  email: string;
  password: string;
  displayName: string;
  avatar: string;
  isOnline: boolean;
  isblocked: boolean;
  isDeleted: boolean;
  lastSeen: Date;
  joinedRooms: string[];
  createdAt: Date;
  updatedAt?: Date;
  roles: ROLES[];
  sockets: string[]
}

export interface IUserDocument extends IUser, Document {
  _id: string
}
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: '' })
  displayName: string;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: false })
  isblocked: boolean;


  @Prop({ default: false })
  isDeleted: boolean;



  @Prop({ default: Date.now })
  lastSeen: Date;

  @Prop({ type: [String], default: [] })
  joinedRooms: string[];


  @Prop({
    type: [String],
    enum: Object.values(ROLES),
    default: [ROLES.USER]
  })
  roles: ROLES[];

  @Prop({ type: [String], default: [] })
  sockets: string[]; 

}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ isOnline: 1 });