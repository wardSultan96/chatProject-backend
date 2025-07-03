import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { JwtSocketGuard } from '../../guards/jwt-socket.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
@UseGuards(JwtSocketGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {
    // Cleanup rate limit entries every 30 seconds
    setInterval(() => {
      this.chatService.cleanupRateLimit();
    }, 30000);
  }

  async handleConnection(client: Socket) {
    try {
    
     
      const token = this.extractToken(client);
      let userId: string;
      let username: string;

      if (token) {
        try {
          const payload = this.jwtService.verify(token, {
            secret: process.env.JWT_SECRET,
          });
          userId = payload.sub;
          username = payload.username;
          client.data.userId = userId;
          client.data.user = payload;
        } catch (error) {
          userId = `anonymous_${Date.now()}`;
          username = 'Anonymous';
          this.logger.warn(`Invalid token for socket ${client.id}, treating as anonymous`);
        }
      } else {
        userId = `anonymous_${Date.now()}`;
        username = 'Anonymous';
      }

      this.chatService.addOnlineUser(userId, client.id, username);

      // Handle reconnection for authenticated users
      if (client.data.userId) {
        const previousRooms = await this.chatService.handleReconnection(userId, client.id);
        if (previousRooms.length > 0) {
          previousRooms.forEach(roomId => {
            client.join(roomId);
          });
          client.emit('reconnected', { rooms: previousRooms });
        }
      }

      client.emit('connected', {
        message: 'Connected to chat server',
        userId,
        username,
        socketId: client.id,
      });

      this.logger.log(`Client connected: ${client.id} (User: ${username})`);
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const user = this.chatService.removeOnlineUser(client.id);
      if (user) {
        // Notify all rooms that the user left
        user.joinedRooms.forEach(roomId => {
          const roomUsers = this.chatService.getRoomUsers(roomId);
          this.server.to(roomId).emit('userLeft', {
            userId: user.userId,
            username: user.username,
            roomId,
            onlineUsers: roomUsers,
          });
        });
      }

      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Disconnect error for ${client.id}:`, error);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; password?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      // Join the socket room
      await client.join(data.roomId);
      this.chatService.addUserToRoom(data.roomId, user.userId, client.id);

      // Get recent messages for the room
      const recentMessages = await this.chatService.getRecentMessages(data.roomId, 20);
      
      // Get online users in the room
      const roomUsers = this.chatService.getRoomUsers(data.roomId);

      client.emit('joinedRoom', {
        roomId: data.roomId,
        messages: recentMessages.reverse(), // Oldest first for display
        onlineUsers: roomUsers,
      });

      // Notify other users in the room
      client.to(data.roomId).emit('userJoined', {
        userId: user.userId,
        username: user.username,
        roomId: data.roomId,
        onlineUsers: roomUsers,
      });

      this.logger.log(`User ${user.username} joined room ${data.roomId}`);
    } catch (error) {
      this.logger.error(`Join room error:`, error);
      client.emit('error', { message: 'Failed to join room', error: error.message });
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      await client.leave(data.roomId);
      this.chatService.removeUserFromRoom(data.roomId, user.userId);

      const roomUsers = this.chatService.getRoomUsers(data.roomId);

      client.emit('leftRoom', { roomId: data.roomId });

      // Notify other users in the room
      client.to(data.roomId).emit('userLeft', {
        userId: user.userId,
        username: user.username,
        roomId: data.roomId,
        onlineUsers: roomUsers,
      });

      this.logger.log(`User ${user.username} left room ${data.roomId}`);
    } catch (error) {
      this.logger.error(`Leave room error:`, error);
      client.emit('error', { message: 'Failed to leave room', error: error.message });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: string; content: string; type?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      // Rate limiting check
      if (this.chatService.isRateLimited(user.userId, data.roomId)) {
        client.emit('rateLimitExceeded', {
          message: 'Rate limit exceeded. Please slow down.',
        });
        return;
      }

      // Save message to database
      const savedMessage = await this.chatService.saveMessage({
        roomId: data.roomId,
        senderId: user.userId,
        content: data.content,
        type: data.type || 'text',
      });

      // Broadcast to all users in the room
       this.server.to(data.roomId).emit('newMessage', savedMessage[0]);
      this.logger.log(`Message sent in room ${data.roomId} by user ${user.username}`);
    } catch (error) {
      this.logger.error(`Send message error:`, error);
      client.emit('error', { message: 'Failed to send message', error: error.message });
    }
  }

  @SubscribeMessage('sendDirectMessage')
  async handleSendDirectMessage(
    @MessageBody() data: { receiverId: string; content: string; type?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      // Rate limiting for DMs (using receiverId as "room")
      if (this.chatService.isRateLimited(user.userId, data.receiverId)) {
        client.emit('rateLimitExceeded', {
          message: 'Rate limit exceeded. Please slow down.',
        });
        return;
      }

      // Save message to database
      const savedMessage = await this.chatService.saveMessage({
        senderId: user.userId,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || 'text',
      });

      // Find receiver's socket
      const receiverSocket = this.findSocketByUserId(data.receiverId);
      
      // Send to receiver if online
      if (receiverSocket) {
        receiverSocket.emit('newDirectMessage', savedMessage[0]);
      }

      // Send confirmation to sender
      client.emit('directMessageSent', savedMessage[0]);

      this.logger.log(`Direct message sent from ${user.username} to user ${data.receiverId}`);
    } catch (error) {
      this.logger.error(`Send direct message error:`, error);
      client.emit('error', { message: 'Failed to send direct message', error: error.message });
    }
  }

  @SubscribeMessage('loadOlderMessages')
  async handleLoadOlderMessages(
    @MessageBody() data: { roomId: string; lastMessageId: string; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      const olderMessages = await this.chatService.getOlderMessages(
        data.roomId,
        data.lastMessageId,
        data.limit || 20,
      );

      client.emit('olderMessages', {
        roomId: data.roomId,
        messages: olderMessages.reverse(), // Oldest first
        hasMore: olderMessages.length === (data.limit || 20),
      });

      this.logger.log(`Loaded ${olderMessages.length} older messages for room ${data.roomId}`);
    } catch (error) {
      this.logger.error(`Load older messages error:`, error);
      client.emit('error', { message: 'Failed to load older messages', error: error.message });
    }
  }

  @SubscribeMessage('getDirectMessages')
  async handleGetDirectMessages(
    @MessageBody() data: { otherUserId: string; limit?: number },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = this.chatService.getOnlineUser(client.id);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      const messages = await this.chatService.getDirectMessages(
        user.userId,
        data.otherUserId,
        data.limit || 20,
      );

      client.emit('directMessages', {
        otherUserId: data.otherUserId,
        messages: messages.reverse(), // Oldest first
      });

      this.logger.log(`Loaded direct messages between ${user.username} and user ${data.otherUserId}`);
    } catch (error) {
      this.logger.error(`Get direct messages error:`, error);
      client.emit('error', { message: 'Failed to load direct messages', error: error.message });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { roomId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.chatService.getOnlineUser(client.id);
    if (user) {
      client.to(data.roomId).emit('userTyping', {
        userId: user.userId,
        username: user.username,
        roomId: data.roomId,
        isTyping: data.isTyping,
      });
    }
  }

  private extractToken(client: Socket): string | null {
    return (
      client.handshake.auth?.token ||
      client.handshake.query?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      null
    );
  }

  private findSocketByUserId(userId: string): Socket | null {
    for (const [socketId, socket] of this.server.sockets.sockets) {
      if (socket.data.userId === userId) {
        return socket;
      }
    }
    return null;
  }
}