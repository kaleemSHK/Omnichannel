import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { ProxyService } from './proxy/proxy.service.js';
import { ProxyController } from './proxy/proxy.controller.js';
import { HostResolverService } from './host/host-resolver.service.js';
import { HostMiddleware } from './host/host.middleware.js';

@Module({
  controllers: [HealthController, AuthController, ProxyController],
  providers: [ProxyService, HostResolverService, HostMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HostMiddleware).forRoutes('*');
  }
}
