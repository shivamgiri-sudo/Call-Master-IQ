import db from '../../config/db';
import { updateApplicationStage } from './candidateService';

export async function getAssessmentRule(vacancy_id: string) {
  // Attempt 1: vacancy-scoped rule directly linked to vacancy
  const [vacancyRows]: any = await db.execute(
    `SELECT ar.*
     FROM cp_vacancy_master v
     JOIN cp_assessment_rule ar ON ar.rule_id = v.assessment_rule_id
     WHERE v.vacancy_id = ? AND ar.active = 1
     LIMIT 1`,
    [vacancy_id]
  );
  if (vacancyRows[0]) return { ...vacancyRows[0], scope_resolved: 'vacancy' };

  // Attempt 2: job_role-scoped rule
  const [roleRows]: any = await db.execute(
    `SELECT ar.*
     FROM cp_vacancy_master v
     JOIN cp_assessment_rule ar ON ar.scope_type = 'job_role' AND ar.scope_ref_id = v.job_role_id
     WHERE v.vacancy_id = ? AND ar.active = 1
     ORDER BY ar.rule_version DESC
     LIMIT 1`,
    [vacancy_id]
  );
  if (roleRows[0]) return { ...roleRows[0], scope_resolved: 'job_role' };

  // Attempt 3: process-scoped rule
  const [processRows]: any = await db.execute(
    `SELECT ar.*
     FROM cp_vacancy_master v
     JOIN cp_assessment_rule ar ON ar.scope_type = 'process' AND ar.scope_ref_id = v.process_id
     WHERE v.vacancy_id = ? AND ar.active = 1
     ORDER BY ar.rule_version DESC
     LIMIT 1`,
    [vacancy_id]
  );
  if (processRows[0]) return { ...processRows[0], scope_resolved: 'process' };

  // Attempt 4: global fallback
  const [globalRows]: any = await db.execute(
    `SELECT * FROM cp_assessment_rule WHERE scope_type = 'global' AND active = 1
     ORDER BY rule_version DESC LIMIT 1`,
    []
  );
  if (globalRows[0]) return { ...globalRows[0], scope_resolved: 'global' };

  return null;
}

export async function startAttempt(
  application_id: string,
  attempt_type: string,
  rule_version: number
) {
  // Check for existing in-progress attempt
  const [existing]: any = await db.execute(
    `SELECT attempt_id FROM cp_assessment_attempt
     WHERE application_id = ? AND attempt_type = ? AND outcome IS NULL
     LIMIT 1`,
    [application_id, attempt_type]
  );
  if (existing[0]) return existing[0].attempt_id;

  await db.execute(
    `INSERT INTO cp_assessment_attempt (
      attempt_id, application_id, attempt_type, rule_version, outcome, started_at
    ) VALUES (UUID(), ?, ?, ?, NULL, NOW())`,
    [application_id, attempt_type, rule_version]
  );

  const [rows]: any = await db.execute(
    `SELECT attempt_id FROM cp_assessment_attempt
     WHERE application_id = ? AND attempt_type = ? ORDER BY started_at DESC LIMIT 1`,
    [application_id, attempt_type]
  );
  return rows[0].attempt_id;
}

export async function getScreeningQuestions(screening_set_id: string) {
  const [setRows]: any = await db.execute(
    `SELECT * FROM cp_screening_set WHERE screening_set_id = ? LIMIT 1`,
    [screening_set_id]
  );
  if (!setRows[0]) return null;

  const [questions]: any = await db.execute(
    `SELECT
       q.question_id, q.question_text, q.is_knockout, q.knockout_answer,
       q.max_score, q.display_order,
       JSON_ARRAYAGG(
         JSON_OBJECT(
           'option_id', o.option_id,
           'option_text', o.option_text,
           'display_order', o.display_order
         )
       ) AS options
     FROM cp_screening_question q
     LEFT JOIN cp_screening_option o ON o.question_id = q.question_id
     WHERE q.screening_set_id = ? AND q.active = 1
     GROUP BY q.question_id, q.question_text, q.is_knockout, q.knockout_answer, q.max_score, q.display_order
     ORDER BY q.display_order ASC`,
    [screening_set_id]
  );

  return {
    ...setRows[0],
    questions: questions.map((q: any) => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    })),
  };
}

export async function submitScreeningResponses(
  attempt_id: string,
  responses: Array<{
    question_id: string;
    selected_option_ids: string;
    score: number;
    is_knockout: number;
  }>
) {
  if (responses.length === 0) throw new Error('No responses provided');

  // Fetch attempt to get rule context
  const [attemptRows]: any = await db.execute(
    `SELECT at.attempt_id, at.application_id, at.rule_version,
            ar.screening_set_id, ar.screening_pass_score, ar.knockout_immediate
     FROM cp_assessment_attempt at
     JOIN cp_application app ON app.application_id = at.application_id
     JOIN cp_assessment_rule ar ON ar.rule_id = app.assessment_rule_id
     WHERE at.attempt_id = ? LIMIT 1`,
    [attempt_id]
  );

  const attempt = attemptRows[0];
  if (!attempt) throw new Error(`Attempt not found: ${attempt_id}`);

  // Batch insert responses
  for (const r of responses) {
    await db.execute(
      `INSERT INTO cp_screening_response (
        response_id, attempt_id, question_id, selected_option_ids, score, is_knockout, answered_at
      ) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
      [attempt_id, r.question_id, r.selected_option_ids, r.score, r.is_knockout]
    );
  }

  // Evaluate knockout
  const knockoutFailed = responses.some(r => r.is_knockout === 1 && r.score === 0);
  if (knockoutFailed && attempt.knockout_immediate) {
    await db.execute(
      `UPDATE cp_assessment_attempt SET outcome = 'Knockout', completed_at = NOW() WHERE attempt_id = ?`,
      [attempt_id]
    );
    await updateApplicationStage(attempt.application_id, 'NotShortlisted', 'Knockout on screening', 'system', 'system');
    return { outcome: 'Knockout', total_score: 0 };
  }

  // Calculate total score
  const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
  const passScore = attempt.screening_pass_score || 0;
  const outcome = totalScore >= passScore ? 'Pass' : 'Fail';

  await db.execute(
    `UPDATE cp_assessment_attempt
     SET outcome = ?, total_score = ?, completed_at = NOW()
     WHERE attempt_id = ?`,
    [outcome, totalScore, attempt_id]
  );

  if (outcome === 'Fail') {
    await updateApplicationStage(attempt.application_id, 'ScreeningFailed', 'Did not meet screening pass score', 'system', 'system');
  } else {
    await updateApplicationStage(attempt.application_id, 'ScreeningPassed', 'Passed screening questionnaire', 'system', 'system');
  }

  return { outcome, total_score: totalScore, pass_score: passScore };
}

export async function getReadingPassage(passage_id: string) {
  const sql = `
    SELECT
      passage_id, passage_title, passage_text, language,
      word_count, difficulty_level, time_limit_seconds, active
    FROM cp_reading_passage
    WHERE passage_id = ? AND active = 1
    LIMIT 1
  `;
  // NOTE: answer/scoring keys are deliberately excluded

  const [rows]: any = await db.execute(sql, [passage_id]);
  return rows[0] || null;
}

export async function saveAudioAsset(
  attempt_id: string,
  storage_key: string,
  duration: number,
  file_size: number
) {
  await db.execute(
    `INSERT INTO cp_audio_asset (
      audio_id, attempt_id, storage_key, duration_seconds, file_size, uploaded_at
    ) VALUES (UUID(), ?, ?, ?, ?, NOW())`,
    [attempt_id, storage_key, duration, file_size]
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_audio_asset WHERE attempt_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
    [attempt_id]
  );
  return rows[0];
}

export async function saveReadingScore(
  attempt_id: string,
  passage_id: string,
  scores: {
    accuracy: number;
    fluency: number;
    completeness: number;
    prosody: number;
  },
  raw_json: string,
  rule: any
) {
  // Weighted score: accuracy*0.35 + fluency*0.30 + completeness*0.25 + prosody*0.10
  const weighted_score =
    scores.accuracy * 0.35 +
    scores.fluency * 0.30 +
    scores.completeness * 0.25 +
    scores.prosody * 0.10;

  const weighted_rounded = Math.round(weighted_score * 100) / 100;

  // Evaluate against rule thresholds
  const pass_score = rule?.reading_pass_score ?? 60;
  const manual_review_band = rule?.manual_review_band ?? 10;
  const lower_band = pass_score - manual_review_band;

  let outcome: string;
  if (weighted_rounded >= pass_score) {
    outcome = 'Pass';
  } else if (weighted_rounded >= lower_band) {
    outcome = 'ManualReview';
  } else {
    outcome = 'Fail';
  }

  await db.execute(
    `INSERT INTO cp_reading_score (
      score_id, attempt_id, passage_id,
      accuracy_score, fluency_score, completeness_score, prosody_score,
      weighted_score, outcome, raw_api_json, scored_at
    ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      attempt_id, passage_id,
      scores.accuracy, scores.fluency, scores.completeness, scores.prosody,
      weighted_rounded, outcome, raw_json,
    ]
  );

  await db.execute(
    `UPDATE cp_assessment_attempt SET outcome = ?, reading_score = ?, completed_at = NOW() WHERE attempt_id = ?`,
    [outcome, weighted_rounded, attempt_id]
  );

  return { weighted_score: weighted_rounded, outcome, pass_score };
}

export async function submitComprehensionResponses(
  attempt_id: string,
  comp_set_id: string,
  answers: Array<{ question_id: string; selected_option: string }>
) {
  if (answers.length === 0) throw new Error('No answers provided');

  // Fetch correct answers for this comprehension set
  const [correctRows]: any = await db.execute(
    `SELECT question_id, correct_option, marks
     FROM cp_comprehension_question
     WHERE comp_set_id = ? AND active = 1`,
    [comp_set_id]
  );

  const correctMap: Record<string, { correct_option: string; marks: number }> = {};
  for (const row of correctRows) {
    correctMap[row.question_id] = { correct_option: row.correct_option, marks: row.marks };
  }

  const totalQuestions = correctRows.length;
  let totalMarks = 0;
  let maxMarks = 0;

  for (const a of answers) {
    const correct = correctMap[a.question_id];
    if (!correct) continue;

    maxMarks += correct.marks;
    const is_correct = a.selected_option === correct.correct_option ? 1 : 0;
    const marks_awarded = is_correct ? correct.marks : 0;
    totalMarks += marks_awarded;

    await db.execute(
      `INSERT INTO cp_comprehension_response (
        comp_response_id, attempt_id, comp_set_id, question_id,
        selected_option, is_correct, marks_awarded, answered_at
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())`,
      [attempt_id, comp_set_id, a.question_id, a.selected_option, is_correct, marks_awarded]
    );
  }

  const pass_pct = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;

  // Fetch rule pass threshold from attempt context
  const [attemptRows]: any = await db.execute(
    `SELECT at.application_id, ar.comprehension_pass_pct
     FROM cp_assessment_attempt at
     JOIN cp_application app ON app.application_id = at.application_id
     JOIN cp_assessment_rule ar ON ar.rule_id = app.assessment_rule_id
     WHERE at.attempt_id = ? LIMIT 1`,
    [attempt_id]
  );

  const attempt = attemptRows[0];
  const required_pct = attempt?.comprehension_pass_pct ?? 60;
  const outcome = pass_pct >= required_pct ? 'Pass' : 'Fail';

  await db.execute(
    `UPDATE cp_assessment_attempt SET outcome = ?, comp_score_pct = ?, completed_at = NOW() WHERE attempt_id = ?`,
    [outcome, Math.round(pass_pct * 100) / 100, attempt_id]
  );

  if (attempt) {
    const stage = outcome === 'Pass' ? 'ComprehensionPassed' : 'ComprehensionFailed';
    await updateApplicationStage(attempt.application_id, stage, `Comprehension ${outcome.toLowerCase()}`, 'system', 'system');
  }

  return {
    outcome,
    score_pct: Math.round(pass_pct * 100) / 100,
    marks_scored: totalMarks,
    max_marks: maxMarks,
    required_pct,
  };
}

export async function evaluateFullOutcome(application_id: string) {
  const [attempts]: any = await db.execute(
    `SELECT attempt_type, outcome, reading_score, comp_score_pct, total_score
     FROM cp_assessment_attempt
     WHERE application_id = ? AND completed_at IS NOT NULL
     ORDER BY started_at ASC`,
    [application_id]
  );

  if (attempts.length === 0) return null;

  const [appRows]: any = await db.execute(
    `SELECT app.assessment_rule_id, ar.reading_enabled, ar.comprehension_enabled,
            ar.screening_pass_score, ar.reading_pass_score, ar.comprehension_pass_pct,
            ar.manual_review_band
     FROM cp_application app
     JOIN cp_assessment_rule ar ON ar.rule_id = app.assessment_rule_id
     WHERE app.application_id = ? LIMIT 1`,
    [application_id]
  );

  const rule = appRows[0];
  if (!rule) throw new Error(`No rule found for application: ${application_id}`);

  // Check if any attempt has Knockout / Fail outcome that disqualifies
  const hasKnockout = attempts.some((a: any) => a.outcome === 'Knockout');
  if (hasKnockout) {
    await updateApplicationStage(application_id, 'NotShortlisted', 'Knockout on assessment', 'system', 'system');
    return { final_outcome: 'NotShortlisted', reason: 'Knockout' };
  }

  const hasHardFail = attempts.some((a: any) => a.outcome === 'Fail' && a.attempt_type !== 'reading');
  if (hasHardFail) {
    await updateApplicationStage(application_id, 'NotShortlisted', 'Failed assessment requirements', 'system', 'system');
    return { final_outcome: 'NotShortlisted', reason: 'Failed screening or comprehension' };
  }

  // Check reading outcome
  const readingAttempt = attempts.find((a: any) => a.attempt_type === 'reading');
  if (rule.reading_enabled && readingAttempt) {
    if (readingAttempt.outcome === 'ManualReview') {
      await updateApplicationStage(application_id, 'ManualReview', 'Reading score in borderline band', 'system', 'system');
      return { final_outcome: 'ManualReview', reason: 'Borderline reading score' };
    }
    if (readingAttempt.outcome === 'Fail') {
      await updateApplicationStage(application_id, 'NotShortlisted', 'Failed reading assessment', 'system', 'system');
      return { final_outcome: 'NotShortlisted', reason: 'Failed reading' };
    }
  }

  // All passed — shortlist for F2F
  await updateApplicationStage(application_id, 'ShortlistedF2F', 'All assessments passed', 'system', 'system');
  return { final_outcome: 'ShortlistedF2F', reason: 'All assessments passed' };
}
