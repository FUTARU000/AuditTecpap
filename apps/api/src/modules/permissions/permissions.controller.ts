import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Permission catalog, grouped by module' })
  catalog() {
    return this.permissionsService.catalog();
  }
}
