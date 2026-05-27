import db from '../../config/db';
import { updateApplicationStage } from './candidateService';

export async function getRecruiterQueue(filters: {
  recruiter_id?: string;
  branch_id?: string;
  process_id?: string;
  stage?: string;
}) {
  const conditions: string[] = [
    `a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended')`
  ];
  const params: any[] = [];

  if (filters.stage) {
    conditions[0] = 'a.current_stage = ?';
    params.push(filters.stage);
  }
  if (filters.branch_id) {
    conditions.push('v.branch_id = ?');
    params.push(filters.branch_id);
  }
  if (filters.process_id) {
    conditions.push('v.process_id = ?');
    params.push(filters.process_id);
  }
  if (filters.recruiter_id) {
    conditions.push('(ir.interviewer_id = ? OR a.assigned_recruiter_id = ?)');
    params.push(filters.recruiter_id, filters.recruiter_id);
  }

  const sql = `
    SELECT
      a.application_id,
      a.current_stage,
      a.applied_at,
      a.updated_at,
      c.candidate_id,
      c.candidate_code,
      c.full_name,
      c.mobile,
      c.email,
      c.total_experience_months,
      v.vacancy_id,
      v.vacancy_title,
      v.voice_type,
      bm.branch_name,
      p.process_name,
      jr.job_role_name,
      ir.round_id,
      ir.round_type,
      ir.scheduled_at,
      ir.outcome AS interview_outcome,
      rs.weighted_score AS reading_score,
      rs.outcome AS reading_outcome
    FROM cp_application a
    JOIN cp_candidate c ON c.candidate_id = a.candidate_id
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    LEFT JOIN cp_interview_round ir ON ir.application_id = a.application_id
      AND ir.round_id = (
        SELECT MAX(ir2.round_id) FROM cp_interview_round ir2 WHERE ir2.application_id = a.application_id
      )
    LEFT JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id AND aa.attempt_type = 'reading'
    LEFT JOIN cp_reading_score rs ON rs.attempt_id = aa.attempt_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.updated_at DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function scheduleInterview(
  application_id: string,
  round_type: string,
  scheduled_at: string,
  interviewer_id: string
) {
  // Count existing rounds for this application
  const [countRows]: any = await db.execute(
    `SELECT COUNT(*) AS cnt FROM cp_interview_round WHERE application_id = ?`,
    [application_id]
  );
  const round_number = (countRows[0].cnt || 0) + 1;

  await db.execute(
    `INSERT INTO cp_interview_round (
      round_id, application_id, round_type, round_number,
      scheduled_at, interviewer_id, created_at
    ) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())`,
    [application_id, round_type, round_number, scheduled_at, interviewer_id]
  );

  await updateApplicationStage(
    application_id,
    'F2FScheduled',
    `${round_type} interview scheduled`,
    interviewer_id,
    'recruiter'
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_interview_round WHERE application_id = ? ORDER BY created_at DESC LIMIT 1`,
    [application_id]
  );
  return rows[0];
}

export async function recordInterviewOutcome(
  round_id: string,
  attended: number,
  outcome: string,
  remarks: string
) {
  await db.execute(
    `UPDATE cp_interview_round
     SET attended = ?, outcome = ?, remarks = ?, conducted_at = NOW()
     WHERE round_id = ?`,
    [attended, outcome, remarks, round_id]
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_interview_round WHERE round_id = ? LIMIT 1`,
    [round_id]
  );
  const round = rows[0];
  if (!round) throw new Error(`Interview round not found: ${round_id}`);

  let new_stage: string;
  if (!attended) {
    new_stage = 'F2FNoShow';
  } else if (outcome === 'Selected') {
    new_stage = 'Selected';
  } else if (outcome === 'Hold') {
    new_stage = 'F2FHold';
  } else {
    new_stage = 'NotShortlisted';
  }

  await updateApplicationStage(
    round.application_id,
    new_stage,
    remarks || `Interview outcome: ${outcome}`,
    round.interviewer_id || 'system',
    'recruiter'
  );

  return { ...round, new_stage };
}

export async function recordJoining(application_id: string, expected_doj: string) {
  await db.execute(
    `INSERT INTO cp_joining_status (
      joining_id, application_id, expected_doj, joined_status, created_at
    ) VALUES (UUID(), ?, ?, 'Pending', NOW())`,
    [application_id, expected_doj]
  );

  await updateApplicationStage(
    application_id,
    'JoiningScheduled',
    `Expected DOJ: ${expected_doj}`,
    'system',
    'recruiter'
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_joining_status WHERE application_id = ? ORDER BY created_at DESC LIMIT 1`,
    [application_id]
  );
  return rows[0];
}

export async function updateJoiningStatus(
  joining_id: string,
  joined_status: string,
  actual_doj?: string
) {
  const allowedStatuses = ['Pending', 'Joined', 'NoShow', 'Deferred'];
  if (!allowedStatuses.includes(joined_status)) {
    throw new Error(`Invalid joining status: ${joined_status}`);
  }

  const fields: string[] = ['joined_status = ?'];
  const params: any[] = [joined_status];

  if (actual_doj) {
    fields.push('actual_doj = ?');
    params.push(actual_doj);
  }

  fields.push('updated_at = NOW()');
  params.push(joining_id);

  await db.execute(
    `UPDATE cp_joining_status SET ${fields.join(', ')} WHERE joining_id = ?`,
    params
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_joining_status WHERE joining_id = ? LIMIT 1`,
    [joining_id]
  );
  const record = rows[0];

  if (record) {
    const new_stage = joined_status === 'Joined' ? 'Joined' : joined_status === 'NoShow' ? 'JoiningNoShow' : 'JoiningDeferred';
    await updateApplicationStage(
      record.application_id,
      new_stage,
      `Joining status updated to ${joined_status}`,
      'system',
      'recruiter'
    );
  }

  return record;
}

export async function getManualReviewQueue(filters: {
  branch_id?: string;
  process_id?: string;
  reviewer_id?: string;
  from_date?: string;
  to_date?: string;
}) {
  const conditions: string[] = [`a.current_stage = 'ManualReview'`];
  const params: any[] = [];

  if (filters.branch_id) {
    conditions.push('v.branch_id = ?');
    params.push(filters.branch_id);
  }
  if (filters.process_id) {
    conditions.push('v.process_id = ?');
    params.push(filters.process_id);
  }
  if (filters.from_date) {
    conditions.push('DATE(a.updated_at) >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push('DATE(a.updated_at) <= ?');
    params.push(filters.to_date);
  }

  const sql = `
    SELECT
      a.application_id,
      a.current_stage,
      a.applied_at,
      a.updated_at,
      c.candidate_code,
      c.full_name,
      c.mobile,
      c.email,
      v.vacancy_title,
      bm.branch_name,
      p.process_name,
      jr.job_role_name,
      aa.attempt_id,
      aa.attempt_type,
      rs.weighted_score AS reading_score,
      rs.accuracy_score,
      rs.fluency_score,
      rs.completeness_score,
      rs.prosody_score,
      rs.outcome AS reading_outcome,
      aud.storage_key AS audio_storage_key,
      aud.duration_seconds AS audio_duration,
      mr.review_id,
      mr.reviewer_id,
      mr.outcome AS review_outcome,
      mr.remarks AS review_remarks,
      mr.reviewed_at
    FROM cp_application a
    JOIN cp_candidate c ON c.candidate_id = a.candidate_id
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    LEFT JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id AND aa.attempt_type = 'reading'
    LEFT JOIN cp_reading_score rs ON rs.attempt_id = aa.attempt_id
    LEFT JOIN cp_audio_asset aud ON aud.attempt_id = aa.attempt_id
    LEFT JOIN cp_manual_review mr ON mr.application_id = a.application_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.updated_at ASC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function recordManualReview(
  application_id: string,
  reviewer_id: string,
  outcome: string,
  remarks: string
) {
  const allowedOutcomes = ['ShortlistedF2F', 'NotShortlisted'];
  if (!allowedOutcomes.includes(outcome)) {
    throw new Error(`Invalid outcome: ${outcome}. Allowed: ${allowedOutcomes.join(', ')}`);
  }

  await db.execute(
    `INSERT INTO cp_manual_review (
      review_id, application_id, reviewer_id, outcome, remarks, reviewed_at
    ) VALUES (UUID(), ?, ?, ?, ?, NOW())`,
    [application_id, reviewer_id, outcome, remarks]
  );

  // Update application stage based on outcome
  await updateApplicationStage(
    application_id,
    outcome,
    `Manual review decision: ${remarks || outcome}`,
    reviewer_id,
    'reviewer'
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_manual_review WHERE application_id = ? ORDER BY reviewed_at DESC LIMIT 1`,
    [application_id]
  );
  return rows[0];
}
