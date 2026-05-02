import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  AttachCourseClassDto,
  CreateClassDto,
  CreateCourseDto,
  CreateExperimentDto,
  CreateRubricDto,
  CreateUserDto,
} from './foundation.dto';
import { FoundationService } from './foundation.service';

@Controller()
export class FoundationController {
  constructor(private readonly foundationService: FoundationService) {}

  @Get('users')
  listUsers(@Query('role') role?: string) {
    return this.foundationService.listUsers(role);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.foundationService.createUser(dto);
  }

  @Get('classes')
  listClasses() {
    return this.foundationService.listClasses();
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto) {
    return this.foundationService.createClass(dto);
  }

  @Get('courses')
  listCourses() {
    return this.foundationService.listCourses();
  }

  @Post('courses')
  createCourse(@Body() dto: CreateCourseDto) {
    return this.foundationService.createCourse(dto);
  }

  @Post('courses/:courseId/classes')
  attachClassToCourse(@Param('courseId') courseId: string, @Body() dto: AttachCourseClassDto) {
    return this.foundationService.attachClassToCourse(courseId, dto);
  }

  @Get('rubrics')
  listRubrics(@Query('courseId') courseId?: string) {
    return this.foundationService.listRubrics(courseId);
  }

  @Post('rubrics')
  createRubric(@Body() dto: CreateRubricDto) {
    return this.foundationService.createRubric(dto);
  }

  @Get('experiments')
  listExperiments(@Query('courseId') courseId?: string) {
    return this.foundationService.listExperiments(courseId);
  }

  @Post('experiments')
  createExperiment(@Body() dto: CreateExperimentDto) {
    return this.foundationService.createExperiment(dto);
  }
}
