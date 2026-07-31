import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search grouped by entity (scoped)' })
  search(@Query('q') q: string, @Req() req: Request) {
    return this.searchService.search(q ?? '', req.dataScope);
  }
}
