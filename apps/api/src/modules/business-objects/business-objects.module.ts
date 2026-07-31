import { Module } from '@nestjs/common';
import { BusinessObjectTypesController } from './business-object-types.controller';
import { BusinessObjectTypesService } from './business-object-types.service';
import { BusinessObjectsController } from './business-objects.controller';
import { BusinessObjectsService } from './business-objects.service';
import { BusinessRelationshipsController } from './business-relationships.controller';
import { BusinessRelationshipsService } from './business-relationships.service';

@Module({
  controllers: [BusinessObjectTypesController, BusinessObjectsController, BusinessRelationshipsController],
  providers: [BusinessObjectTypesService, BusinessObjectsService, BusinessRelationshipsService],
  exports: [BusinessObjectsService, BusinessRelationshipsService],
})
export class BusinessObjectsModule {}
