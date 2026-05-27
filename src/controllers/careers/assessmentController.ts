import { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import db from '../../config/db';
import {
  getAssessmentRule,
  startAttempt,
  submitScreeningResponses,
  getReadingPassage,
  saveAudioAsset,
  saveReadingScore,
  submitComprehensionResponses,
  evaluateFullOutcome,
  getScreeningQuestions,
} from '../../services/careers/assessmentService';

// Multer for audio uploads — memory storage
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (mp3, wav, ogg, webm, m4a, aac)'));
    }
  },
});

export const audioUploadMiddleware = audioUpload.single('audio');

export async function getAssignedAssessment(req: Request, res: Response): Promise<void> {
  try {
    const application_id = req.query.application_id as string;
    if (!application_id) {
      res.status(400).json({ success: false, message: 'application_id is required' });
      return;
    }

    // Fetch application with vacancy info
    const [appRows]: any = await db.execute(
      `SELECT a.application_id, a.vacancy_id, a.current_stage, a.assessment_rule_id
       FROM cp_application a WHERE a.application_id = ? LIMIT 1`,
      [application_id]
    );
    if (!appRows[0]) {
      res.status(404).json({ success: false, message: 'Application not found' });
      return;
    }

    const rule = await getAssessmentRule(appRows[0].vacancy_id);
    if (!rule) {
      res.status(404).json({ success: false, message: 'No assessment rule configured for this vacancy' });
      return;
    }

    // Fetch existing attempts
    const [attempts]: any = await db.execute(
      `SELECT attempt_type, outcome, completed_at FROM cp_assessment_attempt WHERE application_id = ?`,
      [application_id]
    );
    const attemptMap: Record<string, any> = {};
    for (const a of attempts) attemptMap[a.attempt_type] = a;

    const steps = [];

    // Step 1: Screening
    if (rule.screening_set_id) {
      steps.push({
        step: 'screening',
        required: true,
        completed: !!attemptMap['screening']?.completed_at,
        outcome: attemptMap['screening']?.outcome || null,
        screening_set_id: rule.screening_set_id,
      });
    }

    // Step 2: Reading aloud
    if (rule.reading_enabled) {
      steps.push({
        step: 'reading',
        required: true,
        completed: !!attemptMap['reading']?.completed_at,
        outcome: attemptMap['reading']?.outcome || null,
        passage_id: rule.reading_passage_id,
      });
    }

    // Step 3: Comprehension
    if (rule.comprehension_enabled) {
      steps.push({
        step: 'comprehension',
        required: true,
        completed: !!attemptMap['comprehension']?.completed_at,
        outcome: attemptMap['comprehension']?.outcome || null,
        comp_set_id: rule.comprehension_set_id,
      });
    }

    res.json({
      success: true,
      data: {
        application_id,
        current_stage: appRows[0].current_stage,
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        steps,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitScreening(req: Request, res: Response): Promise<void> {
  try {
    const { application_id, responses } = req.body;
    if (!application_id || !Array.isArray(responses)) {
      res.status(400).json({ success: false, message: 'application_id and responses[] are required' });
      return;
    }

    // Fetch rule to get version
    const [appRows]: any = await db.execute(
      `SELECT vacancy_id FROM cp_application WHERE application_id = ? LIMIT 1`,
      [application_id]
    );
    if (!appRows[0]) {
      res.status(404).json({ success: false, message: 'Application not found' });
      return;
    }

    const rule = await getAssessmentRule(appRows[0].vacancy_id);
    if (!rule) {
      res.status(400).json({ success: false, message: 'No assessment rule configured' });
      return;
    }

    const attempt_id = await startAttempt(application_id, 'screening', rule.rule_version || 1);
    const result = await submitScreeningResponses(attempt_id, responses);

    // If screening passed and no more steps required, try evaluating full outcome
    if (result.outcome === 'Pass' && !rule.reading_enabled && !rule.comprehension_enabled) {
      await evaluateFullOutcome(application_id);
    }

    res.json({ success: true, data: { attempt_id, ...result } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getReadingPassageHandler(req: Request, res: Response): Promise<void> {
  try {
    const application_id = req.query.application_id as string;
    if (!application_id) {
      res.status(400).json({ success: false, message: 'application_id is required' });
      return;
    }

    const [appRows]: any = await db.execute(
      `SELECT vacancy_id FROM cp_application WHERE application_id = ? LIMIT 1`,
      [application_id]
    );
    if (!appRows[0]) {
      res.status(404).json({ success: false, message: 'Application not found' });
      return;
    }

    const rule = await getAssessmentRule(appRows[0].vacancy_id);
    if (!rule || !rule.reading_passage_id) {
      res.status(404).json({ success: false, message: 'No reading passage assigned' });
      return;
    }

    const passage = await getReadingPassage(rule.reading_passage_id);
    if (!passage) {
      res.status(404).json({ success: false, message: 'Reading passage not found' });
      return;
    }

    res.json({ success: true, data: passage });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function uploadAudio(req: Request, res: Response): Promise<void> {
  audioUploadMiddleware(req, res, async (multerErr) => {
    if (multerErr) {
      res.status(400).json({ success: false, message: multerErr.message });
      return;
    }
    try {
      const { application_id, duration } = req.body;
      if (!application_id) {
        res.status(400).json({ success: false, message: 'application_id is required' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Audio file is required' });
        return;
      }

      const [appRows]: any = await db.execute(
        `SELECT vacancy_id FROM cp_application WHERE application_id = ? LIMIT 1`,
        [application_id]
      );
      if (!appRows[0]) {
        res.status(404).json({ success: false, message: 'Application not found' });
        return;
      }

      const rule = await getAssessmentRule(appRows[0].vacancy_id);
      const attempt_id = await startAttempt(application_id, 'reading', rule?.rule_version || 1);

      const file = req.file;
      const ext = path.extname(file.originalname).toLowerCase();
      const storage_key = `audio/${application_id}/${attempt_id}/${Date.now()}${ext}`;

      // In production: upload file.buffer to cloud storage
      const asset = await saveAudioAsset(
        attempt_id,
        storage_key,
        Number(duration) || 0,
        file.size
      );

      res.json({
        success: true,
        data: {
          attempt_id,
          audio_id: asset.audio_id,
          storage_key,
          duration_seconds: asset.duration_seconds,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

export async function submitReadingScore(req: Request, res: Response): Promise<void> {
  try {
    const { attempt_id, scores, raw_json } = req.body;
    if (!attempt_id || !scores) {
      res.status(400).json({ success: false, message: 'attempt_id and scores are required' });
      return;
    }

    const [attemptRows]: any = await db.execute(
      `SELECT at.application_id, ar.reading_passage_id, ar.reading_pass_score, ar.manual_review_band
       FROM cp_assessment_attempt at
       JOIN cp_application app ON app.application_id = at.application_id
       JOIN cp_assessment_rule ar ON ar.rule_id = app.assessment_rule_id
       WHERE at.attempt_id = ? LIMIT 1`,
      [attempt_id]
    );
    if (!attemptRows[0]) {
      res.status(404).json({ success: false, message: 'Attempt not found' });
      return;
    }

    const attempt = attemptRows[0];
    const result = await saveReadingScore(
      attempt_id,
      attempt.reading_passage_id,
      {
        accuracy: Number(scores.accuracy) || 0,
        fluency: Number(scores.fluency) || 0,
        completeness: Number(scores.completeness) || 0,
        prosody: Number(scores.prosody) || 0,
      },
      typeof raw_json === 'string' ? raw_json : JSON.stringify(raw_json || {}),
      attempt
    );

    // Evaluate full outcome after reading
    const final = await evaluateFullOutcome(attempt.application_id);

    res.json({ success: true, data: { ...result, final_evaluation: final } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitComprehension(req: Request, res: Response): Promise<void> {
  try {
    const { attempt_id, answers } = req.body;
    if (!attempt_id || !Array.isArray(answers)) {
      res.status(400).json({ success: false, message: 'attempt_id and answers[] are required' });
      return;
    }

    const [attemptRows]: any = await db.execute(
      `SELECT at.application_id, ar.comprehension_set_id
       FROM cp_assessment_attempt at
       JOIN cp_application app ON app.application_id = at.application_id
       JOIN cp_assessment_rule ar ON ar.rule_id = app.assessment_rule_id
       WHERE at.attempt_id = ? LIMIT 1`,
      [attempt_id]
    );
    if (!attemptRows[0]) {
      res.status(404).json({ success: false, message: 'Attempt not found' });
      return;
    }

    const { application_id, comprehension_set_id } = attemptRows[0];
    const result = await submitComprehensionResponses(attempt_id, comprehension_set_id, answers);

    // Evaluate full outcome after comprehension
    const final = await evaluateFullOutcome(application_id);

    res.json({ success: true, data: { ...result, final_evaluation: final } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Admin Handlers ───────────────────────────────────────────────────────────

export async function adminGetScreeningBank(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await db.execute(
      `SELECT ss.*, COUNT(q.question_id) AS question_count
       FROM cp_screening_set ss
       LEFT JOIN cp_screening_question q ON q.screening_set_id = ss.screening_set_id
       GROUP BY ss.screening_set_id
       ORDER BY ss.created_at DESC`,
      []
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateScreeningSet(req: Request, res: Response): Promise<void> {
  try {
    const { set_name, description, job_role_id, process_id, pass_score } = req.body;
    if (!set_name) {
      res.status(400).json({ success: false, message: 'set_name is required' });
      return;
    }
    await db.execute(
      `INSERT INTO cp_screening_set (screening_set_id, set_name, description, job_role_id, process_id, pass_score, active, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, 1, NOW())`,
      [set_name, description || null, job_role_id || null, process_id || null, pass_score || 0]
    );
    const [rows]: any = await db.execute(
      `SELECT * FROM cp_screening_set ORDER BY created_at DESC LIMIT 1`,
      []
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { screening_set_id, question_text, is_knockout, knockout_answer, max_score, display_order, options } = req.body;
    if (!screening_set_id || !question_text) {
      res.status(400).json({ success: false, message: 'screening_set_id and question_text are required' });
      return;
    }

    await db.execute(
      `INSERT INTO cp_screening_question (question_id, screening_set_id, question_text, is_knockout, knockout_answer, max_score, display_order, active, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [screening_set_id, question_text, is_knockout ? 1 : 0, knockout_answer || null, max_score || 1, display_order || 0]
    );

    const [qRows]: any = await db.execute(
      `SELECT * FROM cp_screening_question WHERE screening_set_id = ? ORDER BY created_at DESC LIMIT 1`,
      [screening_set_id]
    );
    const question = qRows[0];

    // Insert options if provided
    if (Array.isArray(options) && options.length > 0 && question) {
      for (const opt of options) {
        await db.execute(
          `INSERT INTO cp_screening_option (option_id, question_id, option_text, display_order) VALUES (UUID(), ?, ?, ?)`,
          [question.question_id, opt.option_text, opt.display_order || 0]
        );
      }
    }

    const set = await getScreeningQuestions(screening_set_id);
    res.status(201).json({ success: true, data: question, set_summary: set });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetPassageBank(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await db.execute(
      `SELECT passage_id, passage_title, language, word_count, difficulty_level, time_limit_seconds, active, created_at
       FROM cp_reading_passage
       ORDER BY created_at DESC`,
      []
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreatePassage(req: Request, res: Response): Promise<void> {
  try {
    const { passage_title, passage_text, language, word_count, difficulty_level, time_limit_seconds } = req.body;
    if (!passage_title || !passage_text) {
      res.status(400).json({ success: false, message: 'passage_title and passage_text are required' });
      return;
    }
    await db.execute(
      `INSERT INTO cp_reading_passage (passage_id, passage_title, passage_text, language, word_count, difficulty_level, time_limit_seconds, active, created_at)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [passage_title, passage_text, language || 'en', word_count || null, difficulty_level || 'Medium', time_limit_seconds || 120]
    );
    const [rows]: any = await db.execute(
      `SELECT * FROM cp_reading_passage ORDER BY created_at DESC LIMIT 1`,
      []
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminGetRules(req: Request, res: Response): Promise<void> {
  try {
    const [rows]: any = await db.execute(
      `SELECT ar.*, ss.set_name AS screening_set_name, rp.passage_title AS reading_passage_title
       FROM cp_assessment_rule ar
       LEFT JOIN cp_screening_set ss ON ss.screening_set_id = ar.screening_set_id
       LEFT JOIN cp_reading_passage rp ON rp.passage_id = ar.reading_passage_id
       ORDER BY ar.rule_version DESC, ar.created_at DESC`,
      []
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function adminCreateRule(req: Request, res: Response): Promise<void> {
  try {
    const {
      rule_name, scope_type, scope_ref_id,
      screening_set_id, screening_pass_score, knockout_immediate,
      reading_enabled, reading_passage_id, reading_pass_score,
      comprehension_enabled, comprehension_set_id, comprehension_pass_pct,
      min_comm_level, manual_review_band,
    } = req.body;

    if (!rule_name || !scope_type) {
      res.status(400).json({ success: false, message: 'rule_name and scope_type are required' });
      return;
    }

    // Get next version for this scope
    const [vRows]: any = await db.execute(
      `SELECT COALESCE(MAX(rule_version), 0) + 1 AS next_version FROM cp_assessment_rule WHERE scope_type = ? AND scope_ref_id <=> ?`,
      [scope_type, scope_ref_id || null]
    );
    const rule_version = vRows[0].next_version;

    await db.execute(
      `INSERT INTO cp_assessment_rule (
        rule_id, rule_name, rule_version, scope_type, scope_ref_id,
        screening_set_id, screening_pass_score, knockout_immediate,
        reading_enabled, reading_passage_id, reading_pass_score,
        comprehension_enabled, comprehension_set_id, comprehension_pass_pct,
        min_comm_level, manual_review_band, active, created_at
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        rule_name, rule_version, scope_type, scope_ref_id || null,
        screening_set_id || null, screening_pass_score || 0, knockout_immediate ? 1 : 0,
        reading_enabled ? 1 : 0, reading_passage_id || null, reading_pass_score || 60,
        comprehension_enabled ? 1 : 0, comprehension_set_id || null, comprehension_pass_pct || 60,
        min_comm_level || null, manual_review_band || 10,
      ]
    );

    const [rows]: any = await db.execute(
      `SELECT * FROM cp_assessment_rule ORDER BY created_at DESC LIMIT 1`,
      []
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
