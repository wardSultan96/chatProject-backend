import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: '' })
  password: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];

  @Prop({ default: 100 })
  maxMembers: number;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Indexes for performance
RoomSchema.index({ name: 1 });
RoomSchema.index({ createdBy: 1 });
RoomSchema.index({ members: 1 });
RoomSchema.index({ isPrivate: 1 });