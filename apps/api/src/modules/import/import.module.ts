import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ParserRegistry } from './parser.registry';

/**
 * Import-ready architecture. No HTTP surface yet — future phases register
 * parsers in ParserRegistry and expose an upload endpoint that calls ImportService.
 */
@Module({
  providers: [ImportService, ParserRegistry],
  exports: [ImportService, ParserRegistry],
})
export class ImportModule {}
