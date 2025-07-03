import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface OnlineUser {
  userId: string;
  socketId: string;
  username: string;
  joinedRooms: Set<string>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly onlineUsers = new Map<string, OnlineUser>();
  private readonly roomUsers = new Map<string, Set<string>>();

  constructor(
    private messagesService: MessagesService,
    private usersService: UsersService,
    private roomsService: RoomsService,
  ) {}

  // Rate limiting
  isRateLimited(userId: string, roomId: string): boolean {
    const key = `${userId}-${roomId}`;
    const now = Date.now();
    const entry = this.rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + 10000, // 10 seconds
      });
      return false;
    }

    if (entry.count >= 5) {
      this.logger.warn(`Rate limit exceeded for user ${userId} in room ${roomId}`);
      return true;
    }

    entry.count++;
    return false;
  }

  // Online users management
  addOnlineUser(userId: string, socketId: string, username: string): void {

    this.onlineUsers.set(socketId, {
      userId,
      socketId,
      username,
      joinedRooms: new Set(),
    });

    this.usersService.setOnlineStatus(userId, true).catch(err => {
      this.logger.error(`Failed to set online status for user ${userId}:`, err);
    });

    this.logger.log(`User ${username} (${userId}) connected with socket ${socketId}`);
  }

  removeOnlineUser(socketId: string): OnlineUser | null {
    const user = this.onlineUsers.get(socketId);
    if (!user) return null;

    // Remove from all rooms
    user.joinedRooms.forEach(roomId => {
      this.removeUserFromRoom(roomId, user.userId);
    });

    this.onlineUsers.delete(socketId);

    this.usersService.setOnlineStatus(user.userId, false).catch(err => {
      this.logger.error(`Failed to set offline status for user ${user.userId}:`, err);
    });

    this.logger.log(`User ${user.username} (${user.userId}) disconnected`);
    return user;
  }

  getOnlineUser(socketId: string): OnlineUser | null {
    return this.onlineUsers.get(socketId) || null;
  }

  // Room management
  addUserToRoom(roomId: string, userId: string, socketId: string): void {
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }

    this.roomUsers.get(roomId).add(userId);

    const user = this.onlineUsers.get(socketId);
    if (user) {
      user.joinedRooms.add(roomId);
    }

    this.logger.log(`User ${userId} joined room ${roomId}`);
  }

  removeUserFromRoom(roomId: string, userId: string): void {
    const roomUsers = this.roomUsers.get(roomId);
    if (roomUsers) {
      roomUsers.delete(userId);
      if (roomUsers.size === 0) {
        this.roomUsers.delete(roomId);
      }
    }

    // Remove from user's joined rooms
    for (const [socketId, user] of this.onlineUsers.entries()) {
      if (user.userId === userId) {
        user.joinedRooms.delete(roomId);
        break;
      }
    }

    this.logger.log(`User ${userId} left room ${roomId}`);
  }

  getRoomUsers(roomId: string): string[] {
    return Array.from(this.roomUsers.get(roomId) || []);
  }

  getAllRoomsWithUsers(): Array<{ roomId: string; users: string[] }> {
    return Array.from(this.roomUsers.entries()).map(([roomId, users]) => ({
      roomId,
      users: Array.from(users),
    }));
  }

  // Reconnection support
  async handleReconnection(userId: string, socketId: string): Promise<string[]> {
    const user = await this.usersService.findOne(userId);
    if (!user) return [];

    // Re-add user to their previous rooms
    const previousRooms = user.joinedRooms || [];
    previousRooms.forEach(roomId => {
      this.addUserToRoom(roomId, userId, socketId);
    });

    this.logger.log(`User ${user.username} reconnected and rejoined ${previousRooms.length} rooms`);
    return previousRooms;
  }

  // Message operations
  async saveMessage(messageData: any): Promise<any> {
    try {
      const message = await this.messagesService.create(messageData);
      return await this.messagesService.findRoomMessages(messageData.roomId, 1, 0);
    } catch (error) {
      this.logger.error('Failed to save message:', error);
      throw error;
    }
  }

  async getRecentMessages(roomId: string, limit: number = 20): Promise<any[]> {
    return this.messagesService.findRoomMessages(roomId, limit, 0);
  }

  async getOlderMessages(roomId: string, lastMessageId: string, limit: number = 20): Promise<any[]> {
    return this.messagesService.findOlderMessages(roomId, lastMessageId, limit);
  }

  async getDirectMessages(senderId: string, receiverId: string, limit: number = 20): Promise<any[]> {
    return this.messagesService.findDirectMessages(senderId, receiverId, limit, 0);
  }

  // Cleanup method to remove old rate limit entries
  cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}