import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../domain/core';
import {
  AttachCourseClassDto,
  CreateEnrollmentDto,
  CreateClassDto,
  CreateCourseDto,
  CreateExperimentDto,
  CreateRubricDto,
  CreateUserDto,
  ListEnrollmentsQueryDto,
} from './foundation.dto';
import { FoundationService } from './foundation.service';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class FoundationController {
  constructor(private readonly foundationService: FoundationService) {}

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('users')
  listUsers(@Query('role') role?: string) {
    return this.foundationService.listUsers(role);
  }

  @Roles(UserRole.Admin)
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.foundationService.createUser(dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Get('classes')
  listClasses() {
    return this.foundationService.listClasses();
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('classes')
  createClass(@Body() dto: CreateClassDto) {
    return this.foundationService.createClass(dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Get('courses')
  listCourses() {
    return this.foundationService.listCourses();
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('courses')
  createCourse(@Body() dto: CreateCourseDto) {
    return this.foundationService.createCourse(dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('courses/:courseId/classes')
  attachClassToCourse(@Param('courseId') courseId: string, @Body() dto: AttachCourseClassDto) {
    return this.foundationService.attachClassToCourse(courseId, dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('enrollments')
  listEnrollments(@Query() query: ListEnrollmentsQueryDto) {
    return this.foundationService.listEnrollments(query);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('enrollments')
  createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.foundationService.createEnrollment(dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('rubrics')
  listRubrics(@Query('courseId') courseId?: string) {
    return this.foundationService.listRubrics(courseId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('rubrics')
  createRubric(@Body() dto: CreateRubricDto) {
    return this.foundationService.createRubric(dto);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Get('experiments')
  listExperiments(@Query('courseId') courseId?: string) {
    return this.foundationService.listExperiments(courseId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('experiments')
  createExperiment(@Body() dto: CreateExperimentDto) {
    return this.foundationService.createExperiment(dto);
  }
}
