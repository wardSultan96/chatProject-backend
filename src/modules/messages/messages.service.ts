import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IMessageDocument, Message, MessageDocument } from './schemas/message.schema';
import { CreateMessageDto } from './dto/create-message.dto';
import { da } from 'date-fns/locale';

@Injectable()
export class MessagesService {
  constructor(@InjectModel(Message.name) private messageModel: Model<IMessageDocument>) { }


  async create(createMessageDto: CreateMessageDto): Promise<IMessageDocument> {
  const { roomId, receiverId, senderId, content, type } = createMessageDto;
  
  const data: any = {
    senderId: new Types.ObjectId(senderId),
    content,
    type: type || 'text'
  };

  if (roomId) {
    data.roomId = new Types.ObjectId(roomId);
  } else if (receiverId) {
    data.receiverId = new Types.ObjectId(receiverId);
  } else {
    throw new Error('Either roomId or receiverId must be provided');
  }

  const createdMessage = new this.messageModel(data);
  const savedMessage = await createdMessage.save();
  
  // Populate sender information before returning
  const populatedMessage = await this.messageModel.findById(savedMessage._id)
    .populate('senderId', 'username displayName avatar')
    .populate('receiverId', 'username displayName avatar')
    .lean();
    
  return populatedMessage as IMessageDocument;
}
  async findRoomMessages(roomIdCopy: string, limit: number = 20, offset: number = 0): Promise<IMessageDocument[]> {
    const roomId = new Types.ObjectId(roomIdCopy)
    const data =  await this.messageModel
      .find({ roomId, receiverId: null })
      .populate('senderId', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();

return data
  }

  async findDirectMessages(senderIdCopy: string, receiverIdCopy: string, limit: number = 20, offset: number = 0): Promise<IMessageDocument[]> {
    const senderId = new Types.ObjectId(senderIdCopy)
    const receiverId = new Types.ObjectId(receiverIdCopy)
    return this.messageModel
      .find({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ],
        roomId: null
      })
      .populate('senderId', 'username displayName avatar')
      .populate('receiverId', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async findOlderMessages(roomIdCopy: string, lastMessageIdCopy: string, limit: number = 20): Promise<IMessageDocument[]> {
    const roomId = new Types.ObjectId(roomIdCopy)
    const lastMessageId = new Types.ObjectId(lastMessageIdCopy)
    const lastMessage = await this.messageModel.findById(lastMessageId);
    if (!lastMessage) {
      return [];
    }

    return this.messageModel
      .find({
        roomId,
        receiverId: null,
        createdAt: { $lt: lastMessage.createdAt }
      })
      .populate('senderId', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findUserConversations(userId: string): Promise<any[]> {
    const userObjectId = new Types.ObjectId(userId);

    const conversations = await this.messageModel.aggregate([
      {
        $match: {
          $or: [
            { senderId: userObjectId, },
            { receiverId: userObjectId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$senderId', userObjectId] },
              then: '$receiverId',
              else: '$senderId'
            }
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$receiverId', userObjectId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      {
        $unwind: '$otherUser'
      },
      {
        $project: {
          otherUser: {
            _id: 1,
            username: 1,
            displayName: 1,
            avatar: 1,
            isOnline: 1
          },
          lastMessage: 1,
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    return conversations;
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    await this.messageModel.updateMany(
      { _id: { $in: messageIds } },
      { $set: { isRead: true } }
    );
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const result = await this.messageModel.deleteOne({
      _id: messageId,
      senderId: userId
    });

    return result.deletedCount > 0;
  }
}