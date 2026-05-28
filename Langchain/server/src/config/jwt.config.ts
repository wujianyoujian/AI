import { JwtModuleOptions } from '@nestjs/jwt';

export default (): JwtModuleOptions => ({
  secret: process.env.JWT_SECRET || 'default-secret',
  signOptions: {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  },
});
