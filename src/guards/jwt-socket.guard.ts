import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { ROLES } from 'src/modules/users/enum/users.role';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class JwtSocketGuard implements CanActivate {
  private readonly logger = new Logger(JwtSocketGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      var token: string;

      var authorization: string;

      const isWebSocket = context.getType() === 'ws';


      if (!isWebSocket) {
        const req = context.switchToHttp().getRequest();
        if (req.url?.includes('/auth/login')||req.url?.includes('/auth/register')) {
          return true;
        }
      }
      if (isWebSocket) {
        // WebSocket context: Get the client and access the handshake headers

        var client = context.switchToWs().getClient();

        authorization =
          client.handshake?.headers?.authorization ||
          client.handshake.query.token ||
          client.handshake?.auth?.token;

        token = authorization;
      } else {
        var request = context.switchToHttp().getRequest();

        authorization = request.headers['authorization'];


        token = authorization.split(' ')[1];
      }

      if (!authorization) {
        throw new UnauthorizedException(
          'Authorization header is missing. Please provide a valid Bearer token.'
        );
      }



      if (!token) {
        throw new BadRequestException(
          'Malformed authorization header. Expected format: "Bearer <token>".'
        );
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET 
      });

      const user = await this.usersService.findOne(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      this.attachUserToContext(context, user);
      this.validateUserStatus(user);

      const requiredRoles = this.reflector.get<ROLES[]>(
        'roles',
        context.getHandler()
      );

      if (requiredRoles) {
        this.checkUserRoles(user, requiredRoles);
      }

      return true;
    } catch (error) {
      this.handleError(error);
    }
  }

  private extractToken(context: ExecutionContext): string {
    if (context.getType() === 'ws') {

      const client = context.switchToWs().getClient<Socket>();

      return this.extractTokenFromSocket(client);
    } else {
      const request = context.switchToHttp().getRequest();
      return this.extractTokenFromRequest(request);
    }
  }

  private extractTokenFromSocket(client: Socket): string {
    const authHeader = client.handshake.headers?.authorization;
 
    if (authHeader && typeof authHeader === 'string') {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) return token;
    }

    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken.trim();
    }

    throw new UnauthorizedException('No valid token found');
  }

  private extractTokenFromRequest(request: any): string {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new BadRequestException('Malformed authorization header');
    }

    return token;
  }

  private attachUserToContext(context: ExecutionContext, user: any): void {
    if (context.getType() === 'ws') {
      context.switchToWs().getClient().user = user;
    } else {
      context.switchToHttp().getRequest().user = user;
    }
  }

  private validateUserStatus(user: any): void {
    if (user.isblocked) {
      throw new ForbiddenException('Your account has been blocked');
    }

    if (user.isDeleted) {
      throw new ForbiddenException('Your account has been deleted');
    }
  }

  private checkUserRoles(user: any, requiredRoles: ROLES[]): void {
    const hasRole = requiredRoles.some(role =>
      user.roles.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Required roles: ${requiredRoles.join(', ')}`
      );
    }
  }

  private handleError(error: any): never {
    this.logger.error(`Authentication error: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedException('Token expired');
    }

    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedException('Invalid token');
    }

    if (error instanceof HttpException) {
      throw error;
    }

    throw new UnauthorizedException('Authentication failed');
  }
}