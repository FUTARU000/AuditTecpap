import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_UPLOAD_BYTES } from '@tecpap/config';
import type { AuthUser } from '@tecpap/types';
import { actorFromRequest } from '../../common/context/actor';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DocumentRelationsService } from './document-relations.service';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentsService } from './documents.service';
import { CreateRelationDto, DocumentStatusChangeDto, ListDocumentsQuery, UpdateDocumentDto, CreateDocumentDto } from './dto/documents.dto';

@ApiTags('documents')
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly versionsService: DocumentVersionsService,
    private readonly relationsService: DocumentRelationsService,
  ) {}

  @Get('search')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'Full-text search across documents' })
  search(@Query('q') q: string, @Req() req: Request) {
    return this.documentsService.search(q ?? '', req.dataScope);
  }

  @Get('tree')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'Dynamic Department → Process → Category tree' })
  tree(@Req() req: Request) {
    return this.documentsService.tree(req.dataScope);
  }

  @Get()
  @Permissions('documents.read')
  @ApiOperation({ summary: 'List documents (paginated, scoped, filtered)' })
  list(@Query() query: ListDocumentsQuery, @Req() req: Request) {
    return this.documentsService.list(query, req.dataScope);
  }

  @Get(':id')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'Get a document by id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.findOne(id, req.dataScope);
  }

  @Post()
  @Permissions('documents.create')
  @ApiOperation({ summary: 'Create a controlled document' })
  create(@Body() dto: CreateDocumentDto, @Req() req: Request) {
    return this.documentsService.create(dto, actorFromRequest(req));
  }

  @Patch(':id')
  @Permissions('documents.update')
  @ApiOperation({ summary: 'Update a document' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @Req() req: Request) {
    return this.documentsService.update(id, dto, actorFromRequest(req));
  }

  @Post(':id/status')
  @Permissions('documents.update')
  @ApiOperation({ summary: 'Transition a document status (approve / publish / …)' })
  changeStatus(@Param('id') id: string, @Body() dto: DocumentStatusChangeDto, @Req() req: Request) {
    const required =
      dto.status === 'APPROVED'
        ? 'documents.approve'
        : dto.status === 'PUBLISHED'
          ? 'documents.publish'
          : dto.status === 'ARCHIVED'
            ? 'documents.archive'
            : 'documents.update';
    const user = req.user as AuthUser | undefined;
    if (!user || !user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return this.documentsService.changeStatus(id, dto.status, actorFromRequest(req));
  }

  @Post(':id/restore')
  @Permissions('documents.restore')
  @ApiOperation({ summary: 'Restore an archived document' })
  restore(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.restore(id, actorFromRequest(req));
  }

  @Delete(':id')
  @Permissions('documents.delete')
  @ApiOperation({ summary: 'Soft-delete (archive) a document' })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.remove(id, actorFromRequest(req));
  }

  // --------------------------------------------------------------- versions

  @Get(':id/versions')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'Version history' })
  listVersions(@Param('id') id: string) {
    return this.versionsService.list(id);
  }

  @Post(':id/versions')
  @Permissions('documents.upload_version')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiOperation({ summary: 'Upload a new immutable version (multipart: file + version + comment)' })
  uploadVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: { version: string; comment?: string },
    @Req() req: Request,
  ) {
    if (!file) {
      throw new ForbiddenException('File is required');
    }
    return this.versionsService.create(id, file, dto, actorFromRequest(req));
  }

  @Patch(':id/versions/:versionId/approve')
  @Permissions('documents.approve_version')
  @ApiOperation({ summary: 'Approve a version' })
  approveVersion(@Param('id') id: string, @Param('versionId') versionId: string, @Req() req: Request) {
    return this.versionsService.approve(id, versionId, actorFromRequest(req));
  }

  @Get(':id/versions/:versionId/download')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'Presigned download URL for a version' })
  download(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.versionsService.downloadUrl(id, versionId);
  }

  // -------------------------------------------------------------- relations

  @Get(':id/relations')
  @Permissions('documents.read')
  @ApiOperation({ summary: 'List related documents' })
  listRelations(@Param('id') id: string) {
    return this.relationsService.list(id);
  }

  @Post(':id/relations')
  @Permissions('documents.manage_relations')
  @ApiOperation({ summary: 'Add a relationship' })
  addRelation(@Param('id') id: string, @Body() dto: CreateRelationDto, @Req() req: Request) {
    return this.relationsService.add(id, dto, actorFromRequest(req));
  }

  @Delete(':id/relations/:relationId')
  @Permissions('documents.manage_relations')
  @ApiOperation({ summary: 'Remove a relationship' })
  removeRelation(@Param('id') id: string, @Param('relationId') relationId: string, @Req() req: Request) {
    return this.relationsService.remove(id, relationId, actorFromRequest(req));
  }
}
