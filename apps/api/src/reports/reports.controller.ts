import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../domain/core';
import { CreateReportExportDto, ListReportExportsQueryDto, ReportFilterDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('statistics')
  getStatistics(@Query() query: ReportFilterDto) {
    return this.reportsService.getStatistics(query);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('exports')
  createExport(@Body() dto: CreateReportExportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.createExport(dto, user);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('exports')
  listExports(@Query() query: ListReportExportsQueryDto) {
    return this.reportsService.listExports(query);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('exports/:exportId')
  getExport(@Param('exportId', new ParseUUIDPipe()) exportId: string) {
    return this.reportsService.getExport(exportId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('exports/:exportId/download')
  @Header('Cache-Control', 'private, no-store')
  async downloadExport(
    @Param('exportId', new ParseUUIDPipe()) exportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: DownloadResponse,
  ) {
    const file = await this.reportsService.downloadExport(exportId, user);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    if (file.sha256) {
      response.setHeader('X-Content-SHA256', file.sha256);
    }
    response.send(file.buffer);
  }
}

interface DownloadResponse {
  setHeader(name: string, value: string): void;
  send(body: Buffer): void;
}
