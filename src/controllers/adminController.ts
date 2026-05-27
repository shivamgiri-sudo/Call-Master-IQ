import { Request, Response } from 'express';
import pool from '../config/db';

// ─── Prompt Config ───────────────────────────────────────────────
export async function listPrompts(req: Request, res: Response): Promise<void> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    if (req.query.client_id) { conditions.push('client_id = ?'); params.push(req.query.client_id); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute<any[]>(
      `SELECT prompt_id, client_id, process_name, business_lob, source_type,
              prompt_version, is_active, created_by, created_at, updated_at
       FROM audit_prompt_config ${where} ORDER BY client_id, process_name, source_type`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertPrompt(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { client_id, process_name, business_lob, source_type, system_prompt } = req.body;
    if (!client_id || !source_type || !system_prompt) {
      res.status(400).json({ success: false, message: 'client_id, source_type, system_prompt are required' });
      return;
    }

    // Deactivate old version
    await pool.execute(
      `UPDATE audit_prompt_config SET is_active = 0
       WHERE client_id = ? AND source_type = ?
         AND (process_name <=> ?) AND (business_lob <=> ?)`,
      [client_id, source_type, process_name || null, business_lob || null]
    );

    const [result] = await pool.execute<any>(
      `INSERT INTO audit_prompt_config (client_id, process_name, business_lob, source_type, system_prompt, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [client_id, process_name || null, business_lob || null, source_type, system_prompt, req.user.login_id]
    );

    res.status(201).json({ success: true, data: { prompt_id: result.insertId } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Employee Mapping ────────────────────────────────────────────
export async function listEmployees(req: Request, res: Response): Promise<void> {
  try {
    const conditions: string[] = ['active_status = 1'];
    const params: any[] = [];
    if (req.query.branch) { conditions.push('branch_short_name = ?'); params.push(req.query.branch); }
    if (req.query.search) {
      conditions.push('(employee_name LIKE ? OR employee_code LIKE ?)');
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await pool.execute<any[]>(
      `SELECT employee_id, employee_code, employee_name, designation, location,
              cost_center, branch_name, branch_short_name, active_status
       FROM employee_mapping_master ${where}
       ORDER BY employee_name LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function importEmployees(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const employees: any[] = req.body.employees;
    if (!Array.isArray(employees) || employees.length === 0) {
      res.status(400).json({ success: false, message: 'employees array is required' });
      return;
    }

    let inserted = 0;
    let updated = 0;

    for (const emp of employees) {
      const [existing] = await pool.execute<any[]>(
        'SELECT employee_id FROM employee_mapping_master WHERE employee_code = ?',
        [emp.employee_code]
      );

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE employee_mapping_master
           SET employee_name = ?, designation = ?, location = ?, cost_center = ?,
               branch_name = ?, branch_short_name = ?, updated_by = ?, updated_at = NOW()
           WHERE employee_code = ?`,
          [emp.employee_name, emp.designation || null, emp.location || null,
           emp.cost_center || null, emp.branch_name || null, emp.branch_short_name || null,
           req.user.login_id, emp.employee_code]
        );
        updated++;
      } else {
        await pool.execute(
          `INSERT INTO employee_mapping_master
             (employee_code, employee_name, designation, location, cost_center, branch_name, branch_short_name, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [emp.employee_code, emp.employee_name, emp.designation || null, emp.location || null,
           emp.cost_center || null, emp.branch_name || null, emp.branch_short_name || null, req.user.login_id]
        );
        inserted++;
      }
    }

    res.json({ success: true, data: { inserted, updated } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Process Mapping ─────────────────────────────────────────────
export async function listProcesses(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT * FROM process_mapping_master WHERE active_status = 1 ORDER BY process_name`
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertProcess(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
    const { mapping_id, dialdesk_client_id, process_name, business_lob, source_type, branch } = req.body;
    if (!dialdesk_client_id || !process_name || !business_lob || !source_type || !branch) {
      res.status(400).json({ success: false, message: 'All fields are required' });
      return;
    }

    if (mapping_id) {
      await pool.execute(
        `UPDATE process_mapping_master
         SET dialdesk_client_id = ?, process_name = ?, business_lob = ?,
             source_type = ?, branch = ?, updated_by = ?, updated_at = NOW()
         WHERE mapping_id = ?`,
        [dialdesk_client_id, process_name, business_lob, source_type, branch, req.user.login_id, mapping_id]
      );
      res.json({ success: true, message: 'Process mapping updated' });
    } else {
      const [result] = await pool.execute<any>(
        `INSERT INTO process_mapping_master
           (dialdesk_client_id, process_name, business_lob, source_type, branch, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [dialdesk_client_id, process_name, business_lob, source_type, branch, req.user.login_id]
      );
      res.status(201).json({ success: true, data: { mapping_id: result.insertId } });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ─── Snapshot trigger (admin only) ──────────────────────────────
export async function triggerSnapshot(req: Request, res: Response): Promise<void> {
  try {
    const { computeDailySnapshot } = await import('../services/snapshotService');
    const date = (req.body.date as string) || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const result = await computeDailySnapshot(date);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
