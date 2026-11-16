import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { resolveDatabaseSettings, resolveDatabaseUrl } from './connection.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  public client!: postgres.Sql;
  public db!: ReturnType<typeof drizzle<typeof schema>>;

  onModuleInit() {
    const settings = resolveDatabaseSettings();

    this.client = postgres(resolveDatabaseUrl(), {
      max: settings.max,
      prepare: settings.prepare,
      connect_timeout: settings.connectTimeout,
      idle_timeout: settings.idleTimeout,
    });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
    }
  }
}
