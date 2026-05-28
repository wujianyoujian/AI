import { JwtModuleOptions } from '@nestjs/jwt';

type StringValue = `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;

export default (): JwtModuleOptions => ({
  secret: process.env.JWT_SECRET || 'default-secret',
  signOptions: {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue,
  },
});
