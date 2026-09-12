import { Module } from '@nestjs/common';
import { ProductivityModule } from '../productivity/productivity.module';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';

@Module({
  imports: [ProductivityModule],
  controllers: [IndicatorsController],
  providers: [IndicatorsService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
