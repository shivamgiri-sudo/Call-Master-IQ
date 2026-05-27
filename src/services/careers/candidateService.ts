import db from '../../config/db';

export async function checkDuplicate(mobile: string, email?: string) {
  const conditions: string[] = ['mobile = ?'];
  const params: any[] = [mobile];

  if (email) {
    conditions.push('email = ?');
    params.push(email);
  }

  const sql = `
    SELECT candidate_id, candidate_code, mobile, email, full_name, created_at
    FROM cp_candidate
    WHERE ${conditions.join(' OR ')}
    LIMIT 1
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows[0] || null;
}

export async function createCandidate(data: any) {
  // Generate candidate code: PP-YYYY-NNNNNN
  const year = new Date().getFullYear();
  const [countRows]: any = await db.execute(
    `SELECT COUNT(*) AS cnt FROM cp_candidate WHERE YEAR(created_at) = ?`,
    [year]
  );
  const seq = (countRows[0].cnt || 0) + 1;
  const candidate_code = `PP-${year}-${String(seq).padStart(6, '0')}`;

  const sql = `
    INSERT INTO cp_candidate (
      candidate_id, candidate_code, full_name, mobile, email,
      dob, gender, highest_qualification, total_experience_months,
      current_city, current_pincode, source, sub_source,
      referral_code, consent_given, created_at, updated_at
    ) VALUES (
      UUID(), ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, 1, NOW(), NOW()
    )
  `;

  const params = [
    candidate_code,
    data.full_name,
    data.mobile,
    data.email || null,
    data.dob || null,
    data.gender || null,
    data.highest_qualification || null,
    data.total_experience_months || 0,
    data.current_city || null,
    data.current_pincode || null,
    data.source || 'Portal',
    data.sub_source || null,
    data.referral_code || null,
  ];

  await db.execute(sql, params);

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_candidate WHERE candidate_code = ? LIMIT 1`,
    [candidate_code]
  );
  return rows[0];
}

export async function createApplication(
  candidate_id: string,
  vacancy_id: string,
  source: string,
  rule_id: string
) {
  const sql = `
    INSERT INTO cp_application (
      application_id, candidate_id, vacancy_id, source, assessment_rule_id,
      current_stage, applied_at, updated_at
    ) VALUES (
      UUID(), ?, ?, ?, ?,
      'Applied', NOW(), NOW()
    )
  `;

  await db.execute(sql, [candidate_id, vacancy_id, source, rule_id]);

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_application WHERE candidate_id = ? AND vacancy_id = ? ORDER BY applied_at DESC LIMIT 1`,
    [candidate_id, vacancy_id]
  );

  const application = rows[0];

  // Insert initial stage history entry
  if (application) {
    await db.execute(
      `INSERT INTO cp_application_stage_history (
        history_id, application_id, from_stage, to_stage, reason, actor_id, actor_type, changed_at
      ) VALUES (UUID(), ?, NULL, 'Applied', 'Initial application submitted', ?, 'system', NOW())`,
      [application.application_id, candidate_id]
    );
  }

  return application;
}

export async function saveConsentLog(
  candidate_id: string,
  consent_type: string,
  version: string,
  ip: string,
  ua: string
) {
  const sql = `
    INSERT INTO cp_consent_log (
      consent_id, candidate_id, consent_type, version,
      ip_address, user_agent, consented_at
    ) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())
  `;

  await db.execute(sql, [candidate_id, consent_type, version, ip, ua]);
  return { success: true };
}

export async function getApplicationStatus(application_id: string) {
  const [appRows]: any = await db.execute(
    `SELECT
       a.application_id, a.current_stage, a.applied_at, a.updated_at,
       c.candidate_id, c.candidate_code, c.full_name, c.mobile, c.email,
       v.vacancy_title, v.vacancy_status,
       bm.branch_name, p.process_name, jr.job_role_name
     FROM cp_application a
     JOIN cp_candidate c ON c.candidate_id = a.candidate_id
     JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
     LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
     LEFT JOIN process_master p ON p.process_id = v.process_id
     LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
     WHERE a.application_id = ?
     LIMIT 1`,
    [application_id]
  );

  if (!appRows[0]) return null;

  const [historyRows]: any = await db.execute(
    `SELECT history_id, from_stage, to_stage, reason, actor_type, changed_at
     FROM cp_application_stage_history
     WHERE application_id = ?
     ORDER BY changed_at ASC`,
    [application_id]
  );

  const [attemptRows]: any = await db.execute(
    `SELECT attempt_id, attempt_type, outcome, started_at, completed_at
     FROM cp_assessment_attempt
     WHERE application_id = ?
     ORDER BY started_at ASC`,
    [application_id]
  );

  return {
    ...appRows[0],
    stage_history: historyRows,
    assessment_attempts: attemptRows,
  };
}

export async function updateApplicationStage(
  application_id: string,
  to_stage: string,
  reason: string,
  actor_id: string,
  actor_type: string
) {
  // Get current stage
  const [appRows]: any = await db.execute(
    `SELECT current_stage FROM cp_application WHERE application_id = ? LIMIT 1`,
    [application_id]
  );

  if (!appRows[0]) throw new Error(`Application not found: ${application_id}`);

  const from_stage = appRows[0].current_stage;

  // Insert history record
  await db.execute(
    `INSERT INTO cp_application_stage_history (
      history_id, application_id, from_stage, to_stage, reason, actor_id, actor_type, changed_at
    ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())`,
    [application_id, from_stage, to_stage, reason, actor_id, actor_type]
  );

  // Update current stage
  await db.execute(
    `UPDATE cp_application SET current_stage = ?, updated_at = NOW() WHERE application_id = ?`,
    [to_stage, application_id]
  );

  return { application_id, from_stage, to_stage };
}

export async function linkResumeAsset(
  application_id: string,
  storage_key: string,
  original_filename: string,
  file_type: string,
  file_size: number
) {
  const sql = `
    INSERT INTO cp_resume_asset (
      asset_id, application_id, storage_key, original_filename,
      file_type, file_size, uploaded_at
    ) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())
  `;

  await db.execute(sql, [application_id, storage_key, original_filename, file_type, file_size]);

  // Update application to mark resume uploaded
  await db.execute(
    `UPDATE cp_application SET resume_uploaded = 1, updated_at = NOW() WHERE application_id = ?`,
    [application_id]
  );

  const [rows]: any = await db.execute(
    `SELECT * FROM cp_resume_asset WHERE application_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
    [application_id]
  );
  return rows[0];
}
