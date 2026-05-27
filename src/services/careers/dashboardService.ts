import db from '../../config/db';

interface DashboardFilter {
  from_date?: string;
  to_date?: string;
  branch_id?: string;
  process_id?: string;
  job_role_id?: string;
  vacancy_id?: string;
}

function buildApplicationWhere(filters: DashboardFilter, alias: string = 'a') {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.from_date) {
    conditions.push(`DATE(${alias}.applied_at) >= ?`);
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push(`DATE(${alias}.applied_at) <= ?`);
    params.push(filters.to_date);
  }
  if (filters.branch_id) {
    conditions.push(`v.branch_id = ?`);
    params.push(filters.branch_id);
  }
  if (filters.process_id) {
    conditions.push(`v.process_id = ?`);
    params.push(filters.process_id);
  }
  if (filters.job_role_id) {
    conditions.push(`v.job_role_id = ?`);
    params.push(filters.job_role_id);
  }
  if (filters.vacancy_id) {
    conditions.push(`${alias}.vacancy_id = ?`);
    params.push(filters.vacancy_id);
  }

  return { where: conditions.join(' AND '), params };
}

export async function getFunnelKPIs(filters: DashboardFilter) {
  const { where, params } = buildApplicationWhere(filters);

  const sql = `
    SELECT
      COUNT(DISTINCT a.application_id) AS total_applicants,
      COUNT(DISTINCT CASE WHEN aa.attempt_id IS NOT NULL THEN a.application_id END) AS assessment_started,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ScreeningPassed','ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined','ManualReview') THEN a.application_id END) AS assessment_qualified,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) AS f2f_shortlisted,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('F2FAttended','Selected','Joined') THEN a.application_id END) AS f2f_attended,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('Selected','Joined') THEN a.application_id END) AS selected,
      COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) AS joined
    FROM cp_application a
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id
    WHERE ${where}
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows[0];
}

export async function getBranchFunnel(filters: DashboardFilter) {
  const { where, params } = buildApplicationWhere(filters);

  const sql = `
    SELECT
      v.branch_id,
      bm.branch_name,
      COUNT(DISTINCT a.application_id) AS total_applicants,
      COUNT(DISTINCT CASE WHEN aa.attempt_id IS NOT NULL THEN a.application_id END) AS assessment_started,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ScreeningPassed','ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined','ManualReview') THEN a.application_id END) AS assessment_qualified,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) AS f2f_shortlisted,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('F2FAttended','Selected','Joined') THEN a.application_id END) AS f2f_attended,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('Selected','Joined') THEN a.application_id END) AS selected,
      COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) AS joined,
      ROUND(
        COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) * 100.0
        / NULLIF(COUNT(DISTINCT a.application_id), 0), 2
      ) AS conversion_pct
    FROM cp_application a
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id
    WHERE ${where}
    GROUP BY v.branch_id, bm.branch_name
    ORDER BY total_applicants DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function getVacancyAgeing(filters: DashboardFilter) {
  const conditions: string[] = [`v.vacancy_status IN ('Published','Paused')`];
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
  if (filters.vacancy_id) {
    conditions.push('v.vacancy_id = ?');
    params.push(filters.vacancy_id);
  }

  const sql = `
    SELECT
      v.vacancy_id,
      v.vacancy_title,
      v.vacancy_status,
      v.openings_count,
      v.published_at,
      v.closing_date,
      DATEDIFF(CURDATE(), COALESCE(v.published_at, v.created_at)) AS days_open,
      bm.branch_name,
      p.process_name,
      jr.job_role_name,
      COUNT(DISTINCT a.application_id) AS applicant_count,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) AS qualified_count,
      COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) AS joined_count,
      ROUND(
        COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) * 100.0
        / NULLIF(COUNT(DISTINCT a.application_id), 0), 2
      ) AS fill_rate_pct
    FROM cp_vacancy_master v
    LEFT JOIN branch_master bm ON bm.branch_id = v.branch_id
    LEFT JOIN process_master p ON p.process_id = v.process_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    LEFT JOIN cp_application a ON a.vacancy_id = v.vacancy_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY
      v.vacancy_id, v.vacancy_title, v.vacancy_status, v.openings_count,
      v.published_at, v.closing_date, bm.branch_name, p.process_name, jr.job_role_name
    ORDER BY days_open DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function getReadingScoreDistribution(filters: DashboardFilter) {
  const { where, params } = buildApplicationWhere(filters);

  const sql = `
    SELECT
      jr.comm_level_required AS comm_level,
      COUNT(DISTINCT rs.score_id) AS total_scored,
      COUNT(DISTINCT CASE WHEN rs.outcome = 'Pass' THEN rs.score_id END) AS pass_count,
      COUNT(DISTINCT CASE WHEN rs.outcome = 'ManualReview' THEN rs.score_id END) AS borderline_count,
      COUNT(DISTINCT CASE WHEN rs.outcome = 'Fail' THEN rs.score_id END) AS fail_count,
      ROUND(AVG(rs.weighted_score), 2) AS avg_weighted_score,
      ROUND(AVG(rs.accuracy_score), 2) AS avg_accuracy,
      ROUND(AVG(rs.fluency_score), 2) AS avg_fluency,
      ROUND(AVG(rs.completeness_score), 2) AS avg_completeness,
      ROUND(AVG(rs.prosody_score), 2) AS avg_prosody
    FROM cp_application a
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN cp_job_role_master jr ON jr.job_role_id = v.job_role_id
    JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id AND aa.attempt_type = 'reading'
    JOIN cp_reading_score rs ON rs.attempt_id = aa.attempt_id
    WHERE ${where}
    GROUP BY jr.comm_level_required
    ORDER BY jr.comm_level_required
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function getSourceConversion(filters: DashboardFilter) {
  const { where, params } = buildApplicationWhere(filters);

  const sql = `
    SELECT
      c.source,
      c.sub_source,
      COUNT(DISTINCT a.application_id) AS total_applicants,
      COUNT(DISTINCT CASE WHEN aa.attempt_id IS NOT NULL THEN a.application_id END) AS assessment_started,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) AS qualified,
      COUNT(DISTINCT CASE WHEN a.current_stage IN ('Selected','Joined') THEN a.application_id END) AS selected,
      COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) AS joined,
      ROUND(
        COUNT(DISTINCT CASE WHEN a.current_stage IN ('ShortlistedF2F','F2FScheduled','F2FAttended','Selected','Joined') THEN a.application_id END) * 100.0
        / NULLIF(COUNT(DISTINCT a.application_id), 0), 2
      ) AS qualify_pct,
      ROUND(
        COUNT(DISTINCT CASE WHEN a.current_stage = 'Joined' THEN a.application_id END) * 100.0
        / NULLIF(COUNT(DISTINCT a.application_id), 0), 2
      ) AS join_pct
    FROM cp_application a
    JOIN cp_candidate c ON c.candidate_id = a.candidate_id
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    LEFT JOIN cp_assessment_attempt aa ON aa.application_id = a.application_id
    WHERE ${where}
    GROUP BY c.source, c.sub_source
    ORDER BY total_applicants DESC
  `;

  const [rows]: any = await db.execute(sql, params);
  return rows;
}

export async function getStageDropOff(filters: DashboardFilter) {
  const { where, params } = buildApplicationWhere(filters);

  const stages = [
    'Applied',
    'ScreeningPassed',
    'ScreeningFailed',
    'ManualReview',
    'ShortlistedF2F',
    'F2FScheduled',
    'F2FAttended',
    'F2FHold',
    'F2FNoShow',
    'Selected',
    'JoiningScheduled',
    'Joined',
    'JoiningNoShow',
    'NotShortlisted',
  ];

  const caseStatements = stages.map(stage =>
    `COUNT(DISTINCT CASE WHEN a.current_stage = '${stage}' THEN a.application_id END) AS \`${stage}\``
  );

  const sql = `
    SELECT
      ${caseStatements.join(',\n      ')},
      COUNT(DISTINCT a.application_id) AS total
    FROM cp_application a
    JOIN cp_vacancy_master v ON v.vacancy_id = a.vacancy_id
    WHERE ${where}
  `;

  const [rows]: any = await db.execute(sql, params);
  const raw = rows[0] || {};

  // Also return drop-off percentages
  const total = raw.total || 0;
  const result = stages.map(stage => ({
    stage,
    count: raw[stage] || 0,
    pct_of_total: total > 0 ? Math.round(((raw[stage] || 0) / total) * 10000) / 100 : 0,
  }));

  return { total, stages: result };
}
