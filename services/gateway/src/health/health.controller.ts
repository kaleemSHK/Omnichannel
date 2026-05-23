import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

const started = Date.now();

@Controller()
export class HealthController {
  @Get('healthz')
  healthz() {
    return { status: 'ok', service: 'gateway', uptime: Math.floor((Date.now() - started) / 1000) };
  }

  @Get('readyz')
  readyz() {
    return { status: 'ready', service: 'gateway' };
  }

  @Get('metrics')
  @Header('content-type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
