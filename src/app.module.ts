import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ChatModule } from './modules/chat/chat.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtSocketGuard } from './guards/jwt-socket.guard';

@Module({
  imports: [
    
    ConfigModule.forRoot({
      isGlobal: true,
    }),
     MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/fallback-db'),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 10000, // 10 seconds
        limit: 5, // 5 requests per 10 seconds
      },
    ]),
    AuthModule,
    UsersModule,
    RoomsModule,
    MessagesModule,
    ChatModule,
  ],
  providers: [
  {
    provide: APP_GUARD,
    useClass: JwtSocketGuard,
  },
]
})
export class AppModule {}