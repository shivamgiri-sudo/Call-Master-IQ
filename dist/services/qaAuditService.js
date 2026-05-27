"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManualAudit = createManualAudit;
exports.updateManualAudit = updateManualAudit;
exports.getManualAudits = getManualAudits;
exports.getManualAuditById = getManualAuditById;
exports.runAIReaudit = runAIReaudit;
const db_1 = __importDefault(require("../config/db"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const QA_PARAMS = [
    'call_answered_within_5_seconds',
    'customer_concern_acknowledged',
    'professionalism_maintained',
    'assurance_or_appreciation_provided',
    'pronunciation_and_clarity',
    'enthusiasm_and_no_fumbling',
    'active_listening',
    'politeness_and_no_sarcasm',
    'proper_grammar',
    'accurate_issue_probing',
    'proper_hold_procedure',
    'proper_transfer_and_language',
    'dead_air_under_10_seconds',
    'case_escalated_correctly',
    'address_recorded_completely',
    'correct_and_complete_information',
    'upselling_or_offers_suggested',
    'further_assistance_offered',
    'proper_call_closure',
    'express_empathy',
];
async function createManualAudit(data) {
    const applicableParams = QA_PARAMS.filter(p => data.scores[p] !== null && data.scores[p] !== undefined);
    const totalScore = applicableParams.reduce((sum, p) => sum + (data.scores[p] || 0), 0);
    const maxScore = applicableParams.length;
    const qualityPct = maxScore > 0 ? parseFloat(((totalScore / maxScore) * 100).toFixed(2)) : null;
    const cols = QA_PARAMS.map(p => p).join(', ');
    const placeholders = QA_PARAMS.map(() => '?').join(', ');
    const scoreValues = QA_PARAMS.map(p => data.scores[p] ?? null);
    const [result] = await db_1.default.execute(`INSERT INTO manual_qa_audit
       (source_call_id, source_type, auditor_user_id, client_id, process_name, business_lob,
        campaign_name, call_date, agent_employee_code,
        ${cols},
        manual_total_score, manual_max_score, manual_quality_percentage, manual_remarks, audit_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${placeholders}, ?, ?, ?, ?, ?)`, [
        data.source_call_id, data.source_type, data.auditor_user_id, data.client_id,
        data.process_name || null, data.business_lob || null, data.campaign_name || null,
        data.call_date || null, data.agent_employee_code || null,
        ...scoreValues,
        totalScore, maxScore, qualityPct, data.manual_remarks || null,
        data.audit_status || 'draft',
    ]);
    return { audit_id: result.insertId, manual_quality_percentage: qualityPct };
}
async function updateManualAudit(audit_id, data) {
    const updates = [];
    const params = [];
    if (data.scores) {
        const applicableParams = QA_PARAMS.filter(p => data.scores[p] !== null && data.scores[p] !== undefined);
        const totalScore = applicableParams.reduce((sum, p) => sum + (data.scores[p] || 0), 0);
        const maxScore = applicableParams.length;
        const qualityPct = maxScore > 0 ? parseFloat(((totalScore / maxScore) * 100).toFixed(2)) : null;
        for (const p of QA_PARAMS) {
            updates.push(`${p} = ?`);
            params.push(data.scores[p] ?? null);
        }
        updates.push('manual_total_score = ?', 'manual_max_score = ?', 'manual_quality_percentage = ?');
        params.push(totalScore, maxScore, qualityPct);
    }
    if (data.manual_remarks !== undefined) {
        updates.push('manual_remarks = ?');
        params.push(data.manual_remarks);
    }
    if (data.audit_status) {
        updates.push('audit_status = ?');
        params.push(data.audit_status);
    }
    if (updates.length === 0)
        return;
    params.push(audit_id);
    await db_1.default.execute(`UPDATE manual_qa_audit SET ${updates.join(', ')} WHERE audit_id = ?`, params);
}
async function getManualAudits(filters) {
    const { page = 1, limit = 50 } = filters;
    const conditions = [];
    const params = [];
    if (filters.auditor_user_id) {
        conditions.push('auditor_user_id = ?');
        params.push(filters.auditor_user_id);
    }
    if (filters.client_id) {
        conditions.push('client_id = ?');
        params.push(filters.client_id);
    }
    if (filters.agent_employee_code) {
        conditions.push('agent_employee_code = ?');
        params.push(filters.agent_employee_code);
    }
    if (filters.audit_status) {
        conditions.push('audit_status = ?');
        params.push(filters.audit_status);
    }
    if (filters.from) {
        conditions.push('call_date >= ?');
        params.push(filters.from);
    }
    if (filters.to) {
        conditions.push('call_date <= ?');
        params.push(filters.to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT audit_id, source_call_id, source_type, auditor_user_id, client_id,
            process_name, business_lob, campaign_name, call_date, agent_employee_code,
            manual_total_score, manual_max_score, manual_quality_percentage,
            audit_status, created_at
     FROM manual_qa_audit ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await db_1.default.execute(`SELECT COUNT(*) AS total FROM manual_qa_audit ${where}`, params);
    return { data: rows, total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) };
}
async function getManualAuditById(audit_id) {
    const [rows] = await db_1.default.execute('SELECT * FROM manual_qa_audit WHERE audit_id = ?', [audit_id]);
    return rows[0] || null;
}
async function runAIReaudit(transcript, promptConfig) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: [
            {
                type: 'text',
                text: promptConfig.system_prompt,
                cache_control: { type: 'ephemeral' },
            }
        ],
        messages: [
            {
                role: 'user',
                content: `Evaluate the following call transcript and return a JSON object with these exact keys:
call_answered_within_5_seconds, customer_concern_acknowledged, professionalism_maintained,
assurance_or_appreciation_provided, pronunciation_and_clarity, enthusiasm_and_no_fumbling,
active_listening, politeness_and_no_sarcasm, proper_grammar, accurate_issue_probing,
proper_hold_procedure, proper_transfer_and_language, dead_air_under_10_seconds,
case_escalated_correctly, address_recorded_completely, correct_and_complete_information,
upselling_or_offers_suggested, further_assistance_offered, proper_call_closure, express_empathy,
areas_for_improvement (string array).

Values: 1 = pass, 0 = fail, null = not applicable.

TRANSCRIPT:
${transcript}`
            }
        ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch)
        throw new Error('AI response did not contain valid JSON');
    return JSON.parse(jsonMatch[1]);
}
