import test from 'node:test';
import assert from 'node:assert/strict';

import { isAcceptedSubmission, normalizeSubmissionPayload } from '../utils/submission.js';

test('detects accepted submissions from GraphQL submissionDetails payloads', () => {
  const payload = {
    data: {
      submissionDetails: {
        id: '42',
        statusCode: 10,
        question: {
          questionFrontendId: '1',
          title: 'Two Sum',
          titleSlug: 'two-sum',
          difficulty: 'Easy',
        },
        lang: { verboseName: 'Python3' },
        code: 'print(1)',
        runtimeDisplay: '12 ms',
        memoryDisplay: '16.4 MB',
      },
    },
  };

  assert.equal(isAcceptedSubmission(payload), true);
  assert.deepEqual(normalizeSubmissionPayload(payload), {
    submissionId: '42',
    questionId: '1',
    title: 'Two Sum',
    titleSlug: 'two-sum',
    difficulty: 'Easy',
    language: 'Python3',
    code: 'print(1)',
    runtime: '12 ms',
    memory: '16.4 MB',
  });
});

test('detects accepted submissions from REST polling payloads', () => {
  const payload = {
    state: 'SUCCESS',
    status: 10,
    status_msg: 'Accepted',
    question_id: '2',
    question__title: 'Add Two Numbers',
    question__title_slug: 'add-two-numbers',
    difficulty: 'Medium',
    lang: 'python3',
    code: 'def f():\n    return 1',
    status_runtime: '24 ms',
    status_memory: '13.2 MB',
  };

  assert.equal(isAcceptedSubmission(payload), true);
  assert.deepEqual(normalizeSubmissionPayload(payload, 'https://leetcode.com/submissions/detail/77/check/'), {
    submissionId: '77',
    questionId: '2',
    title: 'Add Two Numbers',
    titleSlug: 'add-two-numbers',
    difficulty: 'Medium',
    language: 'python3',
    code: 'def f():\n    return 1',
    runtime: '24 ms',
    memory: '13.2 MB',
  });
});
