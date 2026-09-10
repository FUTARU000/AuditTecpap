import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';
import { TaskService } from './task.service';
import { WorkspaceService } from './workspace.service';
import { CalendarService } from './calendar.service';
import { RecentItemsService, SubscriptionService } from './personal.services';
import { RecordRecentDto, TaskActionDto, UpsertSubscriptionDto } from './dto/productivity.dto';

function uid(req: Request): string {
  return (req.user as { id?: string } | undefined)?.id ?? '';
}

@ApiTags('notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get() @ApiOperation({ summary: 'List my notifications' })
  list(@Query() query: Record<string, string>, @Req() req: Request) {
    return this.notifications.list(uid(req), {
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      unread: query.unread === 'true',
      archived: query.archived === 'true',
      type: query.type,
      category: query.category,
      search: query.search,
    });
  }

  @Get('unread-count') @ApiOperation({ summary: 'Unread notification count' })
  async unreadCount(@Req() req: Request) {
    return { count: await this.notifications.unreadCount(uid(req)) };
  }

  @Post(':id/read') @ApiOperation({ summary: 'Mark one notification read' })
  async markRead(@Param('id') id: string, @Req() req: Request) {
    await this.notifications.markRead(id, uid(req));
    return { ok: true };
  }

  @Post('read-all') @ApiOperation({ summary: 'Mark all notifications read' })
  async markAllRead(@Req() req: Request) {
    return { count: await this.notifications.markAllRead(uid(req)) };
  }

  @Post(':id/archive') @ApiOperation({ summary: 'Archive a notification' })
  async archive(@Param('id') id: string, @Req() req: Request) {
    await this.notifications.archive(id, uid(req));
    return { ok: true };
  }

  @Delete(':id') @ApiOperation({ summary: 'Delete a notification' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.notifications.remove(id, uid(req));
    return { ok: true };
  }
}

@ApiTags('reminders')
@Controller({ path: 'reminders', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: ReminderService) {}

  @Post('run') @ApiOperation({ summary: 'Run the reminder scan (global roles only)' })
  async run(@Req() req: Request) {
    if (!(req.user as { roleIsGlobal?: boolean } | undefined)?.roleIsGlobal) throw new ForbiddenException('Only global roles may trigger reminders');
    return this.reminders.runAll();
  }
}

@ApiTags('tasks')
@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasks: TaskService) {}

  @Get() @ApiOperation({ summary: 'My task center' })
  list(@Req() req: Request) {
    return this.tasks.list(uid(req));
  }

  @Post('complete') @ApiOperation({ summary: 'Mark a task complete/incomplete' })
  async complete(@Body() dto: TaskActionDto, @Req() req: Request) {
    await this.tasks.setComplete(uid(req), dto.entityType, dto.entityId, dto.completed ?? true);
    return { ok: true };
  }

  @Post('dismiss') @ApiOperation({ summary: 'Dismiss a task' })
  async dismiss(@Body() dto: TaskActionDto, @Req() req: Request) {
    await this.tasks.dismiss(uid(req), dto.entityType, dto.entityId);
    return { ok: true };
  }
}

@ApiTags('workspace')
@Controller({ path: 'workspace', version: '1' })
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get() @ApiOperation({ summary: 'My personalized workspace' })
  get(@Req() req: Request) {
    return this.workspace.get(uid(req));
  }
}

@ApiTags('calendar')
@Controller({ path: 'calendar', version: '1' })
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get() @ApiOperation({ summary: 'Operational calendar events' })
  events(@Query('from') from: string | undefined, @Query('to') to: string | undefined, @Req() req: Request) {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return this.calendar.events(req.dataScope, start, end);
  }
}

@ApiTags('recent-items')
@Controller({ path: 'recent-items', version: '1' })
export class RecentItemsController {
  constructor(private readonly recent: RecentItemsService) {}

  @Get() list(@Req() req: Request) { return this.recent.list(uid(req)); }

  @Post() async record(@Body() dto: RecordRecentDto, @Req() req: Request) { await this.recent.record(uid(req), dto); return { ok: true }; }
}

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get() list(@Req() req: Request) { return this.subscriptions.list(uid(req)); }

  @Post() upsert(@Body() dto: UpsertSubscriptionDto, @Req() req: Request) { return this.subscriptions.upsert(uid(req), dto); }

  @Delete(':id') async remove(@Param('id') id: string, @Req() req: Request) { await this.subscriptions.remove(uid(req), id); return { ok: true }; }
}
