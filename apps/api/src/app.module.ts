import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { parseEnv } from '@tecpap/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DepartmentScopeGuard } from './common/guards/department-scope.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ActivityTimelineModule } from './modules/activity-timeline/activity-timeline.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuditTemplatesModule } from './modules/audit-templates/audit-templates.module';
import { AuditsModule } from './modules/audits/audits.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessObjectsModule } from './modules/business-objects/business-objects.module';
import { CapaModule } from './modules/capa/capa.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DocumentCategoriesModule } from './modules/document-categories/document-categories.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { ImportModule } from './modules/import/import.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProductivityModule } from './modules/productivity/productivity.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { RolesModule } from './modules/roles/roles.module';
import { SearchModule } from './modules/search/search.module';
import { StorageModule } from './modules/storage/storage.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Global rate limiting (overridable per-route with @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
            : undefined,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        autoLogging: true,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: (config) => parseEnv(config),
    }),
    PrismaModule,
    StorageModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DepartmentsModule,
    ProcessesModule,
    DocumentCategoriesModule,
    DocumentsModule,
    DashboardModule,
    ImportModule,
    IndicatorsModule,
    ActivityTimelineModule,
    BusinessObjectsModule,
    SearchModule,
    AuditTemplatesModule,
    AuditsModule,
    CapaModule,
    ProductivityModule,
    WorkflowModule,
    ScheduleModule.forRoot(),
  ],
  // Execution order = registration order: rate-limit → authenticate → authorize → scope.
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: DepartmentScopeGuard },
  ],
})
export class AppModule {}
