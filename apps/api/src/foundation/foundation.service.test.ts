import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { buildListEnrollmentsSql, hashPassword, validateRubricOrThrow, verifyPassword } from './foundation.service';

test('hashes and verifies initial user passwords', () => {
  const encoded = hashPassword('password-123', 'fixed-salt');

  assert.match(encoded, /^scrypt\$fixed-salt\$[a-f0-9]+$/);
  assert.equal(verifyPassword('password-123', encoded), true);
  assert.equal(verifyPassword('wrong-password', encoded), false);
});

test('rejects rubric metrics whose weights do not sum to 100', () => {
  assert.throws(
    () =>
      validateRubricOrThrow({
        courseId: '00000000-0000-0000-0000-000000000001',
        name: '默认模板',
        metrics: [
          {
            name: '功能实现度',
            description: '功能覆盖',
            weight: 50,
          },
        ],
      }),
    BadRequestException,
  );
});

test('builds enrollment filters with positional parameters', () => {
  const query = buildListEnrollmentsSql({
    courseId: 'course-id',
    classId: 'class-id',
    studentId: 'student-id',
  });

  assert.match(query.sql, /en\.course_id = \$1/);
  assert.match(query.sql, /en\.class_id = \$2/);
  assert.match(query.sql, /en\.student_id = \$3/);
  assert.deepEqual(query.params, ['course-id', 'class-id', 'student-id']);
});
