import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
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
}
