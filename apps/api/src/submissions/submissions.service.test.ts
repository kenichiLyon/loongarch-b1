import assert from 'node:assert/strict';
import test from 'node:test';
import { SubmissionStatus, UserRole } from '../domain/core';
import type { AuthenticatedUser } from '../auth/auth.types';
import { buildListSubmissionsSql } from './submissions.service';

const teacher: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'teacher',
  displayName: 'Teacher',
  role: UserRole.Teacher,
};

const student: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000002',
  username: 'student',
  displayName: 'Student',
  role: UserRole.Student,
};

test('builds submission filters for teacher queries', () => {
  const query = buildListSubmissionsSql(
    {
      experimentId: 'experiment-id',
      courseId: 'course-id',
      classId: 'class-id',
      studentId: 'student-id',
      status: SubmissionStatus.TeacherReview,
    },
    teacher,
  );

  assert.match(query.sql, /s\.experiment_id = \$1/);
  assert.match(query.sql, /e\.course_id = \$2/);
  assert.match(query.sql, /en\.class_id = \$3/);
  assert.match(query.sql, /s\.status = \$4/);
  assert.match(query.sql, /s\.student_id = \$5/);
  assert.deepEqual(query.params, ['experiment-id', 'course-id', 'class-id', SubmissionStatus.TeacherReview, 'student-id']);
});

test('forces student queries onto the current student id', () => {
  const query = buildListSubmissionsSql(
    {
      studentId: 'another-student-id',
      status: SubmissionStatus.Published,
    },
    student,
  );

  assert.match(query.sql, /s\.status = \$1/);
  assert.match(query.sql, /s\.student_id = \$2/);
  assert.deepEqual(query.params, [SubmissionStatus.Published, student.id]);
});
