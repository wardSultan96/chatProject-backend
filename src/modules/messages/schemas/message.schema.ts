import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;
export interface IMessage extends Document {
  roomId: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId?: Types.ObjectId;
  content: string;
  type: string,
  isRead: boolean,
  isEdited: boolean,
  editedAt: Date,
  metadata: Record<string, any>
  createdAt: Date;
  updatedAt?: Date;
}

export interface IMessageDocument extends IMessage, Document {
  _id: string
}
@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', default: null })
  roomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  receiverId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'text' })
  type: string; // 'text', 'image', 'file', 'system'

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt: Date;

  @Prop({ type: Object })
  metadata: Record<string, any>; // For file attachments, reactions, etc.
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Critical indexes for performance
MessageSchema.index({ roomId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });
MessageSchema.index({ createdAt: -1 });