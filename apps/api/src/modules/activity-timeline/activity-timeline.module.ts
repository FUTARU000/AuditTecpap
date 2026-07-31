import { Global, Module } from '@nestjs/common';
import { ActivityTimelineService } from './activity-timeline.service';

@Global()
@Module({
  providers: [ActivityTimelineService],
  exports: [ActivityTimelineService],
})
export class ActivityTimelineModule {}
