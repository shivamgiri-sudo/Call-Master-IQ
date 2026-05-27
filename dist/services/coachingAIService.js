"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCoachingContent = generateCoachingContent;
exports.getCoachingList = getCoachingList;
exports.getCoachingById = getCoachingById;
exports.assignCoaching = assignCoaching;
exports.getMyAssignments = getMyAssignments;
exports.updateAssignmentStatus = updateAssignmentStatus;
const db_1 = __importDefault(require("../config/db"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const anthropic = new sdk_1.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const COACHING_SYSTEM_PROMPT = `You are an expert call centre quality coach. Your role is to generate structured, actionable coaching content for call centre agents based on performance defects identified during quality audits.

When given a specific defect parameter and example transcript excerpts, produce coaching content with:
1. A clear, motivating title
2. An explanation of why this parameter matters
3. What good looks like (with example phrases)
4. What poor performance looks like (with counter-examples)
5. 3-5 specific, practical tips for improvement
6. Key phrases the agent should use

Return a valid JSON object with keys: title, explanation, good_example, poor_example, tips (array of strings), key_phrases (array of strings).`;
async function generateCoachingContent(input) {
    const transcriptContext = input.transcript_excerpts
        .slice(0, 5)
        .map((t, i) => `Example ${i + 1}:\n${t}`)
        .join('\n\n---\n\n');
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: [
            {
                type: 'text',
                text: COACHING_SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' },
            }
        ],
        messages: [
            {
                role: 'user',
                content: `Generate coaching content for the following defect:

Parameter: ${input.defect_parameter}
Process: ${input.process_name || 'General'}
LOB: ${input.business_lob || 'General'}
Call Type: ${input.source_type || 'Inbound'}

Failing transcript examples where agents did NOT meet this parameter:

${transcriptContext}

Return the coaching content as a JSON object.`
            }
        ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch)
        throw new Error('AI response did not contain valid JSON');
    const content = JSON.parse(jsonMatch[1]);
    const excerpt = input.transcript_excerpts[0]?.substring(0, 500) || null;
    const [result] = await db_1.default.execute(`INSERT INTO coaching_content
       (client_id, process_name, business_lob, source_type, defect_parameter,
        coaching_title, coaching_body, example_transcript_excerpt, generated_by, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AI', ?)`, [
        input.client_id, input.process_name || null, input.business_lob || null,
        input.source_type || null, input.defect_parameter,
        content.title,
        JSON.stringify(content),
        excerpt,
        input.created_by_user_id || null,
    ]);
    return { coaching_id: result.insertId, content };
}
async function getCoachingList(filters) {
    const { page = 1, limit = 50 } = filters;
    const conditions = [];
    const params = [];
    if (filters.client_id) {
        conditions.push('client_id = ?');
        params.push(filters.client_id);
    }
    if (filters.business_lob) {
        conditions.push('business_lob = ?');
        params.push(filters.business_lob);
    }
    if (filters.defect_parameter) {
        conditions.push('defect_parameter = ?');
        params.push(filters.defect_parameter);
    }
    conditions.push('active_status = ?');
    params.push(filters.active_status !== undefined ? filters.active_status : 1);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT coaching_id, client_id, process_name, business_lob, source_type,
            defect_parameter, coaching_title, generated_by, created_at
     FROM coaching_content ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [cnt] = await db_1.default.execute(`SELECT COUNT(*) AS total FROM coaching_content ${where}`, params);
    return { data: rows, total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) };
}
async function getCoachingById(coaching_id) {
    const [rows] = await db_1.default.execute('SELECT * FROM coaching_content WHERE coaching_id = ?', [coaching_id]);
    return rows[0] || null;
}
async function assignCoaching(coaching_id, employee_codes, assigned_by) {
    for (const code of employee_codes) {
        await db_1.default.execute(`INSERT INTO coaching_assignment (coaching_id, employee_code, assigned_by_user_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE completion_status = 'pending', assigned_at = NOW()`, [coaching_id, code, assigned_by]);
    }
}
async function getMyAssignments(employee_code, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await db_1.default.execute(`SELECT ca.assignment_id, ca.completion_status, ca.assigned_at, ca.completed_at,
            cc.coaching_id, cc.coaching_title, cc.defect_parameter, cc.business_lob, cc.coaching_body
     FROM coaching_assignment ca
     JOIN coaching_content cc ON cc.coaching_id = ca.coaching_id
     WHERE ca.employee_code = ?
     ORDER BY ca.assigned_at DESC LIMIT ? OFFSET ?`, [employee_code, limit, offset]);
    const [cnt] = await db_1.default.execute('SELECT COUNT(*) AS total FROM coaching_assignment WHERE employee_code = ?', [employee_code]);
    return { data: rows, total: cnt[0].total, page, limit, pages: Math.ceil(cnt[0].total / limit) };
}
async function updateAssignmentStatus(assignment_id, status) {
    await db_1.default.execute(`UPDATE coaching_assignment
     SET completion_status = ?,
         completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
     WHERE assignment_id = ?`, [status, status, assignment_id]);
}
