# NestJS WebSocket Chat Application

A production-ready real-time chat application built with NestJS, Socket.IO, and MongoDB. Features include room-based messaging, direct messages, user authentication, rate limiting, and message history pagination.

## 🚀 Features

- **Real-time messaging** with Socket.IO
- **Room-based chat** with user management
- **Direct messaging** between users
- **JWT authentication** for WebSocket connections
- **Rate limiting** (5 messages per 10 seconds per user per room)
- **Message history pagination** with older message loading
- **Online user tracking** and reconnection support
- **MongoDB persistence** with optimized indexing
- **Modular architecture** with clean separation of concerns
- **Production-ready** with Docker support
- **Comprehensive error handling** and logging

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 7+
- Redis (optional, for scaling)

## 🛠️ Installation

### Using Docker (Recommended)

1. Clone the repository
```bash
git clone <repository-url>
cd nestjs-websocket-chat
```

2. Copy environment variables
```bash
cp .env.example .env
```

3. Start with Docker Compose
```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

### Manual Installation

1. Install dependencies
```bash
npm install
```

2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your MongoDB and Redis connection strings
```

3. Start MongoDB and Redis (if running locally)

4. Start the application
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 🏗️ Architecture

### Module Structure

```
src/
├── adapters/           # WebSocket adapters
├── guards/            # Authentication guards
├── modules/
│   ├── auth/          # Authentication (JWT, login, register)
│   ├── users/         # User management
│   ├── rooms/         # Chat room management
│   ├── messages/      # Message persistence and retrieval
│   └── chat/          # WebSocket gateway and real-time logic
└── main.ts           # Application bootstrap
```

### Data Flow

1. **Connection**: Client connects with optional JWT token
2. **Authentication**: Token validated, user context attached
3. **Room Management**: Users join/leave rooms, tracked in memory
4. **Message Flow**: Messages validated, saved to DB, broadcasted
5. **Rate Limiting**: Per-user-per-room limits enforced
6. **Persistence**: All messages stored in MongoDB with indexes

## 🔌 WebSocket Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `joinRoom` | `{ roomId: string, password?: string }` | Join a chat room |
| `leaveRoom` | `{ roomId: string }` | Leave a chat room |
| `sendMessage` | `{ roomId: string, content: string, type?: string }` | Send message to room |
| `sendDirectMessage` | `{ receiverId: string, content: string, type?: string }` | Send direct message |
| `loadOlderMessages` | `{ roomId: string, lastMessageId: string, limit?: number }` | Load message history |
| `getDirectMessages` | `{ otherUserId: string, limit?: number }` | Get DM history |
| `typing` | `{ roomId: string, isTyping: boolean }` | Typing indicator |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ message: string, userId: string, username: string }` | Connection confirmed |
| `joinedRoom` | `{ roomId: string, messages: Message[], onlineUsers: string[] }` | Room joined successfully |
| `newMessage` | `Message` | New message in room |
| `newDirectMessage` | `Message` | New direct message received |
| `userJoined` | `{ userId: string, username: string, roomId: string }` | User joined room |
| `userLeft` | `{ userId: string, username: string, roomId: string }` | User left room |
| `userTyping` | `{ userId: string, username: string, isTyping: boolean }` | Typing indicator |
| `rateLimitExceeded` | `{ message: string }` | Rate limit warning |
| `error` | `{ message: string, error?: string }` | Error occurred |

## 🔐 Authentication

### JWT Token Format
```typescript
{
  sub: string,      // User ID
  username: string, // Username
  email: string,    // User email
  iat: number,      // Issued at
  exp: number       // Expires at
}
```

### WebSocket Authentication
Pass JWT token in one of these ways:
- `auth.token` in socket connection
- `token` query parameter
- `Authorization` header with `Bearer <token>`

## 📡 HTTP API Endpoints

### Authentication
```bash
# Register
POST /auth/register
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "password123",
  "displayName": "John Doe"
}

# Login
POST /auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

### Users
```bash
# Get all users
GET /users

# Get user by ID
GET /users/:id

# Get user by username
GET /users/username/:username

# Update user profile
PATCH /users/:id
```

### Rooms
```bash
# Create room
POST /rooms
{
  "name": "General Chat",
  "description": "Main discussion room",
  "isPrivate": false,
  "maxMembers": 100
}

# Get all public rooms
GET /rooms

# Get user's rooms
GET /rooms/my-rooms

# Get room details
GET /rooms/:id

# Join room
POST /rooms/:id/join

# Leave room
POST /rooms/:id/leave

# Update room (creator only)
PATCH /rooms/:id

# Delete room (creator only)
DELETE /rooms/:id
```

### Messages
```bash
# Get room messages
GET /messages/room/:roomId?limit=20&offset=0

# Get direct messages
GET /messages/direct/:userId?limit=20&offset=0

# Get user conversations
GET /messages/conversations

# Mark messages as read
POST /messages/mark-read
{
  "messageIds": ["msg1", "msg2"]
}

# Delete message
DELETE /messages/:id
```

## 🧪 Testing with Postman

Import the following collection:

```json
{
  "info": {
    "name": "NestJS Chat API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"testuser\",\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\",\n  \"displayName\": \"Test User\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/auth/register",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "register"]
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["auth", "login"]
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/chat-app` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |

### Rate Limiting

- **Limit**: 5 messages per 10 seconds
- **Scope**: Per user per room/DM
- **Action**: Drop message and send warning

### Message Schema

```typescript
{
  roomId?: ObjectId,        // Room ID (null for DMs)
  senderId: ObjectId,       // Sender user ID
  receiverId?: ObjectId,    // Receiver ID (for DMs)
  content: string,          // Message content
  type: string,            // 'text', 'image', 'file', 'system'
  isRead: boolean,         // Read status
  isEdited: boolean,       // Edit status
  editedAt?: Date,         // Edit timestamp
  metadata?: object,       // Additional data
  createdAt: Date,         // Creation timestamp
  updatedAt: Date          // Update timestamp
}
```

## 🚀 Performance Optimizations

### Database Indexes
- `{ roomId: 1, createdAt: -1 }` - Room message queries
- `{ senderId: 1, receiverId: 1, createdAt: -1 }` - Direct messages
- `{ receiverId: 1, isRead: 1 }` - Unread message counts
- `{ createdAt: -1 }` - General message sorting

### Memory Management
- Rate limit map cleanup every 30 seconds
- Online user tracking with automatic cleanup on disconnect
- Room user lists maintained in memory for performance

### Caching Strategy
- User online status cached in memory
- Recent messages can be cached with Redis (implement as needed)
- Room metadata caching for frequently accessed rooms

## 🐳 Docker Support

### Single Container
```bash
docker build -t chat-app .
docker run -p 3000:3000 chat-app
```

### Full Stack with Docker Compose
```bash
docker-compose up -d
```

Services included:
- **app**: NestJS application
- **mongodb**: MongoDB database
- **redis**: Redis cache (for scaling)

## 📊 Monitoring & Logging

### Application Logs
- Connection/disconnection events
- Message sending/receiving
- Error tracking
- Rate limit violations
- User activity

### Health Checks
Add health check endpoints:
```typescript
@Get('health')
healthCheck() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

## 🔒 Security Features

- **JWT Authentication** with configurable expiration
- **Rate Limiting** to prevent spam
- **Input Validation** with class-validator
- **CORS Configuration** for secure cross-origin requests
- **Error Handling** without exposing sensitive information
- **SQL Injection Protection** through Mongoose ODM

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage
```bash
npm run test:cov
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use Redis adapter for Socket.IO clustering
- Load balance with sticky sessions
- Database read replicas for message history

### Performance Monitoring
- Monitor WebSocket connection count
- Track message throughput
- Database query performance
- Memory usage for online users

## 🔄 Deployment

### Production Checklist
- [ ] Set strong JWT secret
- [ ] Configure MongoDB with authentication
- [ ] Set up Redis for session storage
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging
- [ ] Set up automated backups
- [ ] Configure rate limiting
- [ ] Test WebSocket connections through proxy

### Environment-Specific Configs
```bash
# Production
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
MONGODB_URI=<production-mongodb-url>
REDIS_URL=<production-redis-url>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch  
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the logs for error details

---

Built with ❤️ using NestJS, Socket.IO, and MongoDB