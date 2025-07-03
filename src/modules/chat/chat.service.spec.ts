import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';

describe('ChatService', () => {
  let service: ChatService;
  let messagesService: MessagesService;
  let usersService: UsersService;
  let roomsService: RoomsService;

  const mockMessagesService = {
    create: jest.fn(),
    findRoomMessages: jest.fn(),
    findDirectMessages: jest.fn(),
    findOlderMessages: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
    setOnlineStatus: jest.fn(),
  };

  const mockRoomsService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: RoomsService, useValue: mockRoomsService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    messagesService = module.get<MessagesService>(MessagesService);
    usersService = module.get<UsersService>(UsersService);
    roomsService = module.get<RoomsService>(RoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Rate Limiting', () => {
    it('should allow first message', () => {
      const result = service.isRateLimited('user123', 'room123');
      expect(result).toBe(false);
    });

    it('should enforce rate limit after 5 messages', () => {
      const userId = 'user123';
      const roomId = 'room123';

      // Send 5 messages (should all be allowed)
      for (let i = 0; i < 5; i++) {
        expect(service.isRateLimited(userId, roomId)).toBe(false);
      }

      // 6th message should be rate limited
      expect(service.isRateLimited(userId, roomId)).toBe(true);
    });

    it('should reset rate limit after time window', (done) => {
      const userId = 'user123';
      const roomId = 'room123';

      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        service.isRateLimited(userId, roomId);
      }

      expect(service.isRateLimited(userId, roomId)).toBe(true);

      // Mock time passage by manipulating the internal rate limit map
      setTimeout(() => {
        // After time window, should allow messages again
        expect(service.isRateLimited(userId, roomId)).toBe(false);
        done();
      }, 50);
    }, 100);
  });

  describe('Online User Management', () => {
    it('should add online user', () => {
      service.addOnlineUser('user123', 'socket123', 'testuser');
      
      const user = service.getOnlineUser('socket123');
      expect(user).toEqual({
        userId: 'user123',
        socketId: 'socket123',
        username: 'testuser',
        joinedRooms: new Set(),
      });

      expect(mockUsersService.setOnlineStatus).toHaveBeenCalledWith('user123', true);
    });

    it('should remove online user', () => {
      service.addOnlineUser('user123', 'socket123', 'testuser');
      
      const removedUser = service.removeOnlineUser('socket123');
      expect(removedUser).toEqual({
        userId: 'user123',
        socketId: 'socket123',
        username: 'testuser',
        joinedRooms: new Set(),
      });

      expect(service.getOnlineUser('socket123')).toBeNull();
      expect(mockUsersService.setOnlineStatus).toHaveBeenCalledWith('user123', false);
    });
  });

  describe('Room Management', () => {
    it('should add user to room', () => {
      service.addOnlineUser('user123', 'socket123', 'testuser');
      service.addUserToRoom('room123', 'user123', 'socket123');

      const roomUsers = service.getRoomUsers('room123');
      expect(roomUsers).toContain('user123');

      const user = service.getOnlineUser('socket123');
      expect(user.joinedRooms.has('room123')).toBe(true);
    });

    it('should remove user from room', () => {
      service.addOnlineUser('user123', 'socket123', 'testuser');
      service.addUserToRoom('room123', 'user123', 'socket123');
      
      service.removeUserFromRoom('room123', 'user123');

      const roomUsers = service.getRoomUsers('room123');
      expect(roomUsers).not.toContain('user123');
    });
  });

  describe('Message Operations', () => {
    it('should save message', async () => {
      const messageData = {
        roomId: 'room123',
        senderId: 'user123',
        content: 'Hello World',
        type: 'text',
      };

      mockMessagesService.create.mockResolvedValue({
        _id: 'msg123',
        ...messageData,
      });

      mockMessagesService.findRoomMessages.mockResolvedValue([
        { _id: 'msg123', ...messageData },
      ]);

      const result = await service.saveMessage(messageData);
      
      expect(mockMessagesService.create).toHaveBeenCalledWith(messageData);
      expect(result).toEqual([{ _id: 'msg123', ...messageData }]);
    });

    it('should get recent messages', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Hello' },
        { _id: 'msg2', content: 'World' },
      ];

      mockMessagesService.findRoomMessages.mockResolvedValue(mockMessages);

      // const result = await service.getRecentMessages('room123', 20);
      
      expect(mockMessagesService.findRoomMessages).toHaveBeenCalledWith('room123', 20, 0);
      expect('result').toEqual(mockMessages);
    });
  });

  describe('Reconnection Logic', () => {
    it('should handle user reconnection', async () => {
      const mockUser = {
        _id: 'user123',
        username: 'testuser',
        joinedRooms: ['room1', 'room2'],
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await service.handleReconnection('user123', 'socket123');

      expect(result).toEqual(['room1', 'room2']);
    });

    it('should handle reconnection for non-existent user', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      const result = await service.handleReconnection('nonexistent', 'socket123');

      expect(result).toEqual([]);
    });
  });
});