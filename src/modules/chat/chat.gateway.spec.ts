import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ChatService;
  let jwtService: JwtService;

  const mockChatService = {
    addOnlineUser: jest.fn(),
    removeOnlineUser: jest.fn(),
    getOnlineUser: jest.fn(),
    addUserToRoom: jest.fn(),
    removeUserFromRoom: jest.fn(),
    getRoomUsers: jest.fn(),
    handleReconnection: jest.fn(),
    isRateLimited: jest.fn(),
    saveMessage: jest.fn(),
    getRecentMessages: jest.fn(),
    getOlderMessages: jest.fn(),
    getDirectMessages: jest.fn(),
    cleanupRateLimit: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should handle connection with valid JWT', async () => {
      const mockClient = {
        id: 'socket123',
        handshake: {
          auth: { token: 'valid-token' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      mockJwtService.verify.mockReturnValue({
        sub: 'user123',
        username: 'testuser',
      });

      mockChatService.handleReconnection.mockResolvedValue(['room1', 'room2']);

      await gateway.handleConnection(mockClient);

      expect(mockChatService.addOnlineUser).toHaveBeenCalledWith(
        'user123',
        'socket123',
        'testuser',
      );
      expect(mockClient.emit).toHaveBeenCalledWith('connected', {
        message: 'Connected to chat server',
        userId: 'user123',
        username: 'testuser',
        socketId: 'socket123',
      });
    });

    it('should handle connection without token (anonymous)', async () => {
      const mockClient = {
        id: 'socket123',
        handshake: { auth: {} },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
      } as any;

      await gateway.handleConnection(mockClient);

      expect(mockChatService.addOnlineUser).toHaveBeenCalledWith(
        expect.stringContaining('anonymous_'),
        'socket123',
        'Anonymous',
      );
    });
  });

  describe('handleJoinRoom', () => {
    it('should allow user to join room', async () => {
      const mockClient = {
        id: 'socket123',
        join: jest.fn(),
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as any;

      mockChatService.getOnlineUser.mockReturnValue({
        userId: 'user123',
        username: 'testuser',
        socketId: 'socket123',
        joinedRooms: new Set(),
      });

      mockChatService.getRecentMessages.mockResolvedValue([
        { _id: 'msg1', content: 'Hello', senderId: 'user456' },
      ]);

      mockChatService.getRoomUsers.mockReturnValue(['user123', 'user456']);

      await gateway.handleJoinRoom({ roomId: 'room123' }, mockClient);

      expect(mockClient.join).toHaveBeenCalledWith('room123');
      expect(mockChatService.addUserToRoom).toHaveBeenCalledWith(
        'room123',
        'user123',
        'socket123',
      );
      expect(mockClient.emit).toHaveBeenCalledWith('joinedRoom', {
        roomId: 'room123',
        messages: [{ _id: 'msg1', content: 'Hello', senderId: 'user456' }],
        onlineUsers: ['user123', 'user456'],
      });
    });
  });

  describe('handleSendMessage', () => {
    it('should send message to room', async () => {
      const mockClient = {
        id: 'socket123',
        emit: jest.fn(),
      } as any;

      const mockServer = {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as any;

      gateway.server = mockServer;

      mockChatService.getOnlineUser.mockReturnValue({
        userId: 'user123',
        username: 'testuser',
        socketId: 'socket123',
        joinedRooms: new Set(['room123']),
      });

      mockChatService.isRateLimited.mockReturnValue(false);

      mockChatService.saveMessage.mockResolvedValue([
        {
          _id: 'msg123',
          content: 'Hello World',
          senderId: 'user123',
          roomId: 'room123',
        },
      ]);

      await gateway.handleSendMessage(
        { roomId: 'room123', content: 'Hello World' },
        mockClient,
      );

      expect(mockChatService.saveMessage).toHaveBeenCalledWith({
        roomId: 'room123',
        senderId: 'user123',
        content: 'Hello World',
        type: 'text',
      });

      expect(mockServer.to).toHaveBeenCalledWith('room123');
    });

    it('should handle rate limiting', async () => {
      const mockClient = {
        id: 'socket123',
        emit: jest.fn(),
      } as any;

      mockChatService.getOnlineUser.mockReturnValue({
        userId: 'user123',
        username: 'testuser',
        socketId: 'socket123',
        joinedRooms: new Set(['room123']),
      });

      mockChatService.isRateLimited.mockReturnValue(true);

      await gateway.handleSendMessage(
        { roomId: 'room123', content: 'Hello World' },
        mockClient,
      );

      expect(mockClient.emit).toHaveBeenCalledWith('rateLimitExceeded', {
        message: 'Rate limit exceeded. Please slow down.',
      });

      expect(mockChatService.saveMessage).not.toHaveBeenCalled();
    });
  });
});