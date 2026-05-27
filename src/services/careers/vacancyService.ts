import db from '../../config/db';

export async function listPublishedVacancies(filters: {
  branch_id?: string;
  process_id?: string;
  job_role_id?: string;
  voice_type?: string;
  search?: string;
}) {
  const conditions: string[] = ['v.vacancy_status = ?'];
  const params: any[] = ['Published'];

  if (filters.branch_id) {
    conditions.push('v.branch_id = ?');
    params.push(filters.branch_id);
  }
  if (filters.process_id) {
    conditions.push('v.process_id = ?');
    params.push(filters.process_id);
  }
  if (filters.job_role_id) {
    conditions.push('v.job_role_id = ?');
    params.push(filters.job_role_id);
  }
  if (filters.voice_type) {
    conditions.push('v.voice_type = ?');
    params.push(filters.voice_type);
  }
  if (filters.search) {
    conditions.push('(v.vacancy_title LIKE ? OR jr.job_role_name LIKE ? OR p.process_name LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT
      v.vacancy_id,
      v.vacancy_title,
      v.vacancy_status,
      v.voice_type,
      v.openings_count,
      v.min_experience_months,
      v.max_experience_months,
      v.min_age,
      v.max_age,
      v.min_qualification,
      v.job_description,
      v.created_at,
      v.published_at,
      v.closing_date,
      v.branch_id,
      bm.branch_name,
      bm.branch_short_name,
      v.process_id,
      p.process_name,
      v.lob_id,
      lob.lob_name,
      v.job_role_id,
      jr.job_role_name,
      v.assessment_rule_id,
      (SELECT COUNT(*) FROM cp_application a WHERE a.vacancy_id = v.vacancy_id) AS applicant_count
    FROM cp_vacancy_master v
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN lob_master lob ON lob.lob_id = v.lob_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    ${where}
    ORDER BY v.published_at DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function getVacancyDetail(vacancy_id: string) {
  const sql = `
    SELECT
      v.*,
      bm.branch_name,
      bm.branch_short_name,
      p.process_name,
      lob.lob_name,
      jr.job_role_name,
      jr.comm_level_required,
      ar.rule_id,
      ar.rule_name,
      ar.rule_version,
      ar.scope_type,
      ar.screening_set_id,
      ar.screening_pass_score,
      ar.knockout_immediate,
      ar.reading_enabled,
      ar.reading_passage_id,
      ar.reading_pass_score,
      ar.comprehension_enabled,
      ar.comprehension_set_id,
      ar.comprehension_pass_pct,
      ar.min_comm_level,
      ar.manual_review_band,
      ar.active AS rule_active
    FROM cp_vacancy_master v
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN lob_master lob ON lob.lob_id = v.lob_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    LEFT JOIN cp_assessment_rule ar ON ar.rule_id = v.assessment_rule_id
    WHERE v.vacancy_id = ?
    LIMIT 1
  `;

  const [rows]: any = await db.execute(sql, [vacancy_id]);
  return rows[0] || null;
}

export async function createVacancy(data: any, created_by: string) {
  const sql = `
    INSERT INTO cp_vacancy_master (
      vacancy_id, vacancy_title, branch_id, process_id, lob_id, job_role_id,
      voice_type, openings_count, min_experience_months, max_experience_months,
      min_age, max_age, min_qualification, job_description, assessment_rule_id,
      vacancy_status, closing_date, created_by, created_at, updated_at
    ) VALUES (
      UUID(), ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      'Draft', ?, ?, NOW(), NOW()
    )
  `;

  const params = [
    data.vacancy_title,
    data.branch_id,
    data.process_id,
    data.lob_id || null,
    data.job_role_id,
    data.voice_type || null,
    data.openings_count || 1,
    data.min_experience_months || 0,
    data.max_experience_months || null,
    data.min_age || null,
    data.max_age || null,
    data.min_qualification || null,
    data.job_description || null,
    data.assessment_rule_id || null,
    data.closing_date || null,
    created_by,
  ];

  const [result]: any = await db.execute(sql, params);

  const [inserted]: any = await db.execute(
    'SELECT * FROM cp_vacancy_master WHERE vacancy_id = (SELECT vacancy_id FROM cp_vacancy_master ORDER BY created_at DESC LIMIT 1)',
    []
  );
  return inserted[0];
}

export async function updateVacancy(vacancy_id: string, data: any) {
  const fields: string[] = [];
  const params: any[] = [];

  const allowed = [
    'vacancy_title', 'branch_id', 'process_id', 'lob_id', 'job_role_id',
    'voice_type', 'openings_count', 'min_experience_months', 'max_experience_months',
    'min_age', 'max_age', 'min_qualification', 'job_description',
    'assessment_rule_id', 'closing_date',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  params.push(vacancy_id);

  await db.execute(
    `UPDATE cp_vacancy_master SET ${fields.join(', ')} WHERE vacancy_id = ?`,
    params
  );

  const [rows]: any = await db.execute(
    'SELECT * FROM cp_vacancy_master WHERE vacancy_id = ?',
    [vacancy_id]
  );
  return rows[0] || null;
}

export async function updateVacancyStatus(vacancy_id: string, status: string) {
  const allowedStatuses = ['Draft', 'Published', 'Paused', 'Closed'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Allowed: ${allowedStatuses.join(', ')}`);
  }

  const extraFields: string[] = [];
  const params: any[] = [status];

  if (status === 'Published') {
    extraFields.push(', published_at = NOW()');
  } else if (status === 'Closed') {
    extraFields.push(', closed_at = NOW()');
  }

  params.push(vacancy_id);

  await db.execute(
    `UPDATE cp_vacancy_master SET vacancy_status = ?, updated_at = NOW()${extraFields.join('')} WHERE vacancy_id = ?`,
    params
  );

  const [rows]: any = await db.execute(
    'SELECT vacancy_id, vacancy_title, vacancy_status FROM cp_vacancy_master WHERE vacancy_id = ?',
    [vacancy_id]
  );
  return rows[0] || null;
}

export async function listVacanciesAdmin(filters: {
  branch_id?: string;
  process_id?: string;
  job_role_id?: string;
  vacancy_status?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}) {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.branch_id) {
    conditions.push('v.branch_id = ?');
    params.push(filters.branch_id);
  }
  if (filters.process_id) {
    conditions.push('v.process_id = ?');
    params.push(filters.process_id);
  }
  if (filters.job_role_id) {
    conditions.push('v.job_role_id = ?');
    params.push(filters.job_role_id);
  }
  if (filters.vacancy_status) {
    conditions.push('v.vacancy_status = ?');
    params.push(filters.vacancy_status);
  }
  if (filters.search) {
    conditions.push('(v.vacancy_title LIKE ? OR jr.job_role_name LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like);
  }
  if (filters.from_date) {
    conditions.push('DATE(v.created_at) >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push('DATE(v.created_at) <= ?');
    params.push(filters.to_date);
  }

  const sql = `
    SELECT
      v.vacancy_id,
      v.vacancy_title,
      v.vacancy_status,
      v.voice_type,
      v.openings_count,
      v.closing_date,
      v.created_at,
      v.published_at,
      bm.branch_name,
      p.process_name,
      lob.lob_name,
      jr.job_role_name,
      COUNT(DISTINCT a.application_id) AS total_applicants,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) AS shortlisted_count,
      COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) AS joined_count,
      DATEDIFF(CURDATE(), v.created_at) AS days_open
    FROM cp_vacancy_master v
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN lob_master lob ON lob.lob_id = v.lob_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    LEFT JOIN cp_application a ON a.vacancy_id = v.vacancy_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY
      v.vacancy_id, v.vacancy_title, v.vacancy_status, v.voice_type,
      v.openings_count, v.closing_date, v.created_at, v.published_at,
      bm.branch_name, p.process_name, lob.lob_name, jr.job_role_name
    ORDER BY v.created_at DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}
