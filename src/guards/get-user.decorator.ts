import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IUserDocument } from 'src/modules/users/schemas/user.schema';


export const GetUser = createParamDecorator(
  async (
    data: unknown,
    context: ExecutionContext,
  ): Promise<IUserDocument> => {
    const request = context.switchToHttp().getRequest();

    const user = request.user as IUserDocument;

    return user;
  },
);


