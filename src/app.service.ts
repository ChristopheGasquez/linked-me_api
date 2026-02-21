import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class AppService {
  private readonly version: string;

  constructor() {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    );
    this.version = pkg.version;
  }

  getHealth() {
    return {
      status: 'ok',
      version: this.version,
      documentation: '/api',
    };
  }
}
