export function isAcceptedSubmission(payload, url = '') {
  if (payload?.data?.submissionDetails) {
    return payload.data.submissionDetails.statusCode === 10;
  }

  return (
    (payload?.state === 'SUCCESS' || payload?.status === 10) &&
    (payload?.status_msg === 'Accepted' || payload?.status === 10)
  );
}

export function normalizeSubmissionPayload(payload, url = '') {
  if (payload?.data?.submissionDetails) {
    const detail = payload.data.submissionDetails;
    return {
      submissionId: String(detail.id),
      questionId: detail.question?.questionFrontendId,
      title: detail.question?.title,
      titleSlug: detail.question?.titleSlug,
      difficulty: detail.question?.difficulty,
      language: detail.lang?.verboseName || detail.lang?.name,
      code: detail.code,
      runtime: detail.runtimeDisplay,
      memory: detail.memoryDisplay,
    };
  }

  const idMatch = url.match(/detail\/(\d+)\/check/);
  return {
    submissionId: idMatch ? idMatch[1] : String(Date.now()),
    questionId: payload?.question_id,
    title: payload?.question__title,
    titleSlug: payload?.question__title_slug,
    difficulty: payload?.difficulty,
    language: payload?.lang,
    code: payload?.code,
    runtime: payload?.status_runtime,
    memory: payload?.status_memory,
  };
}
