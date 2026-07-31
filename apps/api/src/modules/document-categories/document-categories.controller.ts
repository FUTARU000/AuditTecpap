import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateCategoryDto, ListCategoriesQuery, UpdateCategoryDto } from './dto/categories.dto';
import { DocumentCategoriesService } from './document-categories.service';

@ApiTags('document-categories')
@Controller({ path: 'document-categories', version: '1' })
export class DocumentCategoriesController {
  constructor(private readonly categoriesService: DocumentCategoriesService) {}

  @Get()
  @Permissions('categories.read')
  @ApiOperation({ summary: 'List document categories (paginated)' })
  list(@Query() query: ListCategoriesQuery) {
    return this.categoriesService.list(query);
  }

  @Get('active')
  @Permissions('categories.read')
  @ApiOperation({ summary: 'Active categories (for dropdowns / tree)' })
  listActive() {
    return this.categoriesService.listActive();
  }

  @Post()
  @Permissions('categories.manage')
  @ApiOperation({ summary: 'Create a document category' })
  create(@Body() dto: CreateCategoryDto, @Req() req: Request) {
    return this.categoriesService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('categories.manage')
  @ApiOperation({ summary: 'Update a document category' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Req() req: Request) {
    return this.categoriesService.update(id, dto, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('categories.manage')
  @ApiOperation({ summary: 'Delete a document category (if unused)' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.categoriesService.remove(id, actorFromRequest(req));
  }
}
