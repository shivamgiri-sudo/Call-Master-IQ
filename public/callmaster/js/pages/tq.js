// public/callmaster/js/pages/tq.js

const TQ_PAGES = {

  'tq-quality-deepdive': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/quality-deepdive', { preset });
    const d = r.data;
    // Normalize: mock returns {inbound:{...},outbound:{...}}, real returns flat array
    let flat = [];
    if (Array.isArray(d)) {
      flat = d;
    } else if (d && d.inbound) {
      flat = [
        ...(d.inbound.parameters  || []).map(p => ({ ...p, source_type: 'Inbound',  avg_score: p.pass_rate })),
        ...(d.outbound.parameters || []).map(p => ({ ...p, source_type: 'Outbound', avg_score: p.pass_rate })),
      ];
    }
    setTimeout(() => {
      barChart('tqParamChart',
        [{ name: 'Score / Pass Rate %', data: flat.map(p => p.avg_score || p.pass_rate || 0) }],
        flat.map(p => p.param || p.process_name || ''),
        { yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Quality Deep-Dive', 'Parameter performance by process · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-quality-deepdive")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Pass Rate by Parameter / Process</div>
        <div class="chart-wrap" id="tqParamChart"></div>
      </div>
      ${table(
        [
          { key: 'process_name', label: 'Process / Parameter', render: (v, row) => {
              if (!v) return row.param || '—';
              const pn = String(v).replace(/'/g, "\\'");
              const cid = String(row.client_id || '');
              const click = cid === '497'
                ? `onclick="window.open('http://localhost:4070','_blank')"`
                : `onclick="goProcess('${pn}','${cid}')"`;
              return `<span style="cursor:pointer;color:#60a5fa" ${click}>${v}${cid === '497' ? ' ↗' : ' →'}</span>`;
            }
          },
          { key: 'source_type',  label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '' },
          { key: 'avg_score',    label: 'Score / Pass Rate', render: (v, row) => { const n = v || row.pass_rate; return n != null ? `<span class="td-mono">${n}%</span>` : '—'; } },
          { key: 'total_calls',  label: 'Calls', render: v => v != null ? Number(v).toLocaleString() : '—' },
          { key: 'weight',       label: 'Weight', render: v => v != null ? `${v}%` : '—' },
        ],
        flat
      )}`;
  },

  'tq-tni-heatmap': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/tni-heatmap', { preset });
    const d = r.data || {};
    setTimeout(() => {
      if (d.agents && d.matrix) {
        // mock format
        const series = d.agents.map((agent, ai) => ({
          name: agent,
          data: d.params.map((p, pi) => ({ x: p, y: d.matrix[ai][pi] })),
        }));
        heatmapChart('tqHeatmap', series, { title: 'Defect Count per Parameter per Agent' });
      } else if (Array.isArray(d) && d.length > 0) {
        // real format: array of {agent, employee_code, professionalism_defects, ...}
        const paramKeys = ['professionalism_defects','probing_defects','escalation_defects','hold_defects','info_defects','closure_defects'];
        const paramLabels = ['Professionalism','Issue Probing','Escalation','Hold Procedure','Correct Info','Call Closure'];
        const series = d.map(row => ({
          name: row.agent,
          data: paramKeys.map((k, i) => ({ x: paramLabels[i], y: Number(row[k] || 0) })),
        }));
        heatmapChart('tqHeatmap', series, { title: 'TNI — Darker = More Defects' });
      }
    }, 0);
    return `
      ${pageHeader('TNI Heatmap', 'Agent × Parameter defect matrix · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-tni-heatmap")')}
      </div>
      <div class="card">
        <div class="chart-title">Training Need Index — Darker = More Defects</div>
        <div id="tqHeatmap" style="min-height:300px"></div>
      </div>`;
  },

  'tq-leaderboard': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/leaderboard', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Analyst Leaderboard', 'Cross-process ranking · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-leaderboard")')}
      </div>
      ${table(
        [
          { key: '_rank',           label: '#',          render: (_, __, idx) => idx + 1 },
          { key: 'name',            label: 'Analyst' },
          { key: 'process_name',    label: 'Process',    render: (v, row) => {
              if (!v) return '—';
              const pn = String(v).replace(/'/g, "\\'");
              const cid = String(row.client_id || '');
              const click = cid === '497'
                ? `onclick="window.open('http://localhost:4070','_blank')"`
                : `onclick="goProcess('${pn}','${cid}')"`;
              return `<span style="cursor:pointer;color:#60a5fa" ${click}>${v}${cid === '497' ? ' ↗' : ''}</span>`;
            }
          },
          { key: 'source_type',     label: 'Type',       render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '' },
          { key: 'avg_score',       label: 'Avg CQ%',    render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',     label: 'Calls',      render: v => Number(v).toLocaleString() },
          { key: 'critical_count',  label: 'Critical',   render: v => Number(v) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'classification',  label: 'Class',      render: v => classificationBadge(v) },
        ],
        rows.map((r, i) => ({ ...r, _rank: i + 1 })),
        { emptyMsg: 'No analyst data for selected period' }
      )}`;
  },

  'tq-coaching-queue': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/coaching-queue', { preset });
    const d = r.data || {};
    const items = d.items || [];
    return `
      ${pageHeader('Coaching Queue', (d.open || 0) + ' open items')}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-coaching-queue")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Open',  d.open  || 0, 'Pending coaching sessions')}
        ${kpi('Total', items.length, 'All coaching items')}
      </div>
      ${table(
        [
          { key: 'agent_employee_code', label: 'Emp Code',  render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'process_name',        label: 'Process' },
          { key: 'coaching_title',      label: 'Title' },
          { key: 'priority',            label: 'Priority',  render: v => `<span class="badge badge-${v==='High'?'red':v==='Medium'?'yellow':'gray'}">${v}</span>` },
          { key: 'status',              label: 'Status',    render: v => `<span class="badge badge-${v==='Open'?'red':'green'}">${v}</span>` },
          { key: 'due_date',            label: 'Due' },
        ],
        items
      )}`;
  },

  'tq-calibration': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/calibration', { preset });
    const sessions = Array.isArray(r.data) ? r.data : (r.data?.sessions || []);
    return `
      ${pageHeader('Calibration Tracker', 'Session list + variance scores')}
      ${table(
        [
          { key: 'id',             label: 'ID',           render: v => `<span class="td-mono">${v}</span>` },
          { key: 'date',           label: 'Date',         render: v => v ? new Date(v).toLocaleDateString() : '—' },
          { key: 'session_name',   label: 'Session Name' },
          { key: 'process_name',   label: 'Process' },
          { key: 'variance_score', label: 'Variance',     render: v => v != null ? `<span class="td-mono">${v}</span>` : '—' },
          { key: 'call_count',     label: 'Calls',        render: v => Number(v || 0).toLocaleString() },
          { key: 'status',         label: 'Status',       render: v => `<span class="badge badge-${v==='closed'||v==='Closed'?'green':'yellow'}">${v}</span>` },
        ],
        sessions,
        { emptyMsg: 'No calibration sessions found' }
      )}`;
  },

  'tq-audit-efficiency': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/audit-efficiency', { preset });
    const d = r.data || {};
    const daily = d.daily || [];
    setTimeout(() => {
      if (daily.length > 0) {
        barChart('tqAuditChart',
          [
            { name: 'Total Calls', data: daily.map(d => Number(d.total_calls)) },
            { name: 'Audited',     data: daily.map(d => Number(d.audited_calls)) },
          ],
          daily.map(d => d.call_date || d.date),
          { yFormatter: v => Number(v).toLocaleString() }
        );
      }
    }, 0);
    return `
      ${pageHeader('Audit Efficiency', 'Manual audit coverage · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"tq-audit-efficiency")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Audited',   Number(d.audited_calls || d.manual_audits || 0).toLocaleString(), 'Manual QC')}
        ${kpi('AI Audits', Number(d.ai_audits     || 0).toLocaleString(), 'AI-assisted')}
        ${kpi('Pending',   Number(d.pending       || 0).toLocaleString(), 'Not yet audited', Number(d.pending) > 200 ? 'down' : 'up')}
        ${kpi('SLA%',      (d.sla_pct || 0) + '%', 'Audit coverage')}
      </div>
      <div class="card">
        <div class="chart-title">Daily Audit Volume</div>
        <div class="chart-wrap" id="tqAuditChart"></div>
      </div>`;
  },

  'tq-parameter-drift': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/parameter-drift', { preset });
    const declining = Array.isArray(r.data) ? r.data : (r.data?.declining || []);
    setTimeout(() => {
      if (declining.length > 0) {
        barChart('tqDriftChart',
          [{ name: 'Change %', data: declining.map(d => d.change_pct) }],
          declining.map(d => d.param || d.param_name),
          { horizontal: true, yFormatter: v => v + '%' }
        );
      }
    }, 0);
    return `
      ${pageHeader('Parameter Drift', 'Parameters declining in last 7 days vs prior 7 days')}
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Score Change — Negative = Declining</div>
        <div class="chart-wrap" id="tqDriftChart"></div>
      </div>
      ${declining.length === 0 ? emptyState('No declining parameters detected') : table(
        [
          { key: 'param_name', label: 'Parameter',    render: (v, r) => v || r.param },
          { key: 'recent_avg', label: 'Last 7 Days',  render: v => v != null ? Number(v).toFixed(2) : '—' },
          { key: 'prior_avg',  label: 'Prior 7 Days', render: v => v != null ? Number(v).toFixed(2) : '—' },
          { key: 'change_pct', label: 'Change',       render: v => v != null ? `<span class="${v < 0 ? 'kpi-trend-down' : 'kpi-trend-up'}">${v > 0 ? '+' : ''}${v}%</span>` : '—' },
        ],
        declining
      )}`;
  },

  'tq-sla-tracker': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/tq/sla-tracker', { preset });
    const rows = Array.isArray(r.data) ? r.data : (r.data?.rows || []);
    return `
      ${pageHeader('SLA Tracker', 'Auditor × Process audit SLA')}
      ${table(
        [
          { key: 'auditor',        label: 'Auditor' },
          { key: 'process_name',   label: 'Process' },
          { key: 'total_assigned', label: 'Assigned',  render: v => Number(v || 0).toLocaleString() },
          { key: 'completed',      label: 'Completed', render: v => Number(v || 0).toLocaleString() },
          { key: 'sla_pct',        label: 'SLA%',      render: v => {
            const n = Number(v || 0);
            const cls = n >= 95 ? 'band-excellent' : n >= 85 ? 'band-good' : n >= 75 ? 'band-average' : 'band-below';
            return `<span class="${cls} td-mono">${n}%</span>`;
          }},
        ],
        rows,
        { emptyMsg: 'No SLA data available' }
      )}`;
  },

  'tq-feedback-queue': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/tq/feedback-queue?status=pending');
    const rows = r.data || [];
    return `
      ${pageHeader('Feedback Queue', rows.length + ' pending disputes')}
      ${table(
        [
          { key: 'feedback_id',     label: 'ID',       render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_call_id',  label: 'Call ID',  render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_type',     label: 'Type',     render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '' },
          { key: 'analyst_name',    label: 'Analyst' },
          { key: 'feedback_text',   label: 'Reason',   render: v => `<span style="max-width:280px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${String(v||'').replace(/"/g,'&quot;')}">${v || '—'}</span>` },
          { key: 'created_at',      label: 'Submitted', render: v => v ? new Date(v).toLocaleDateString() : '—' },
          { key: 'feedback_status', label: 'Status',   render: v => `<span class="badge badge-${v==='pending'?'yellow':v==='approved'?'green':'red'}">${v}</span>` },
          { key: '_actions',        label: '',         render: (_, row) => `
            <button class="badge badge-green" style="cursor:pointer;border:none;padding:4px 10px;margin-right:4px"
              onclick="resolveFeedback(${row.feedback_id},'approved')">Approve</button>
            <button class="badge badge-red" style="cursor:pointer;border:none;padding:4px 10px"
              onclick="resolveFeedback(${row.feedback_id},'rejected')">Reject</button>` },
        ],
        rows,
        { emptyMsg: 'No pending disputes' }
      )}`;
  },

  'tq-coaching-library': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/tq/coaching');
    const d = r.data || {};
    const items = Array.isArray(d) ? d : (d.data || []);
    return `
      ${pageHeader('Coaching Library', items.length + ' modules')}
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button onclick="go('tq-coaching-generate')" class="badge badge-blue" style="cursor:pointer;border:none;padding:6px 14px;font-size:13px">+ Generate New</button>
      </div>
      ${items.length === 0 ? emptyState('No coaching content yet') : table(
        [
          { key: 'coaching_id',      label: 'ID',         render: v => `<span class="td-mono">${v}</span>` },
          { key: 'coaching_title',   label: 'Title' },
          { key: 'defect_parameter', label: 'Defect Area' },
          { key: 'coaching_body',    label: 'Content',    render: v => v ? `<span style="max-width:280px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${String(v).replace(/"/g,'&quot;')}">${v}</span>` : '—' },
          { key: 'generated_by',     label: 'Source',     render: v => `<span class="badge badge-${v==='AI'?'violet':'blue'}">${v||'Manual'}</span>` },
          { key: '_assign',          label: '',           render: (_, row) => `<button class="badge badge-green" style="cursor:pointer;border:none;padding:4px 10px" onclick="openAssignModal(${row.coaching_id})">Assign</button>` },
        ],
        items
      )}
      <div id="assignModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;width:440px;max-width:90vw">
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#f1f5f9">Assign Coaching</div>
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Employee Codes (comma-separated)</label>
            <input id="assignEmpCodes" type="text" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px;color:#f1f5f9;font-size:13px" placeholder="EMP001, EMP002, EMP003" />
          </div>
          <div id="assignError" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button onclick="document.getElementById('assignModal').style.display='none'" style="background:#334155;border:none;border-radius:6px;padding:8px 16px;color:#94a3b8;cursor:pointer">Cancel</button>
            <button onclick="doAssignCoaching()" style="background:#2563eb;border:none;border-radius:6px;padding:8px 16px;color:#fff;cursor:pointer;font-weight:600">Assign</button>
          </div>
        </div>
      </div>`;
  },

  'tq-coaching-generate': async function(preset) {
    return `
      ${pageHeader('Generate Coaching', 'AI-powered coaching content creation')}
      <div class="card" style="max-width:560px">
        <div style="margin-bottom:16px">
          <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Defect Parameter *</label>
          <input id="genDefectParam" type="text" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:10px;color:#f1f5f9;font-size:13px" placeholder="e.g. Objection Handling, Call Closure" />
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Process Name *</label>
          <input id="genProcessName" type="text" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:10px;color:#f1f5f9;font-size:13px" placeholder="e.g. GNC Inbound" />
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Coaching Title (optional)</label>
          <input id="genTitle" type="text" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:10px;color:#f1f5f9;font-size:13px" placeholder="Auto-filled from defect parameter if blank" />
        </div>
        <div id="genError" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none"></div>
        <div id="genSuccess" style="color:#4ade80;font-size:12px;margin-bottom:12px;display:none"></div>
        <button onclick="doGenerateCoaching()" style="background:#2563eb;border:none;border-radius:8px;padding:10px 20px;color:#fff;cursor:pointer;font-weight:600;font-size:14px">Generate Coaching Content</button>
      </div>`;
  },
};

async function resolveFeedback(feedbackId, resolution) {
  if (!confirm('Mark this dispute as ' + resolution + '?')) return;
  const r = await CALLMASTER_API.request('/api/callmaster/tq/feedback/' + feedbackId + '/resolve', {
    method: 'PATCH',
    body: JSON.stringify({ resolution }),
  });
  if (r.success) {
    go('tq-feedback-queue');
  } else {
    alert('Failed: ' + (r.error || 'Unknown error'));
  }
}

function openAssignModal(coachingId) {
  window._assignCoachingId = coachingId;
  document.getElementById('assignEmpCodes').value = '';
  document.getElementById('assignError').style.display = 'none';
  document.getElementById('assignModal').style.display = 'flex';
}

async function doAssignCoaching() {
  const raw = document.getElementById('assignEmpCodes').value.trim();
  const errEl = document.getElementById('assignError');
  if (!raw) { errEl.textContent = 'Enter at least one employee code.'; errEl.style.display = 'block'; return; }
  const employee_codes = raw.split(',').map(s => s.trim()).filter(Boolean);
  errEl.style.display = 'none';
  const r = await CALLMASTER_API.post('/api/callmaster/tq/coaching/' + window._assignCoachingId + '/assign', { employee_codes });
  if (r.success) {
    document.getElementById('assignModal').style.display = 'none';
    alert('Coaching assigned to ' + employee_codes.length + ' agent(s).');
  } else {
    errEl.textContent = r.error || 'Failed to assign coaching.';
    errEl.style.display = 'block';
  }
}

async function doGenerateCoaching() {
  const defect_parameter = document.getElementById('genDefectParam').value.trim();
  const process_name = document.getElementById('genProcessName').value.trim();
  const coaching_title = document.getElementById('genTitle').value.trim();
  const errEl = document.getElementById('genError');
  const okEl = document.getElementById('genSuccess');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  if (!defect_parameter || !process_name) { errEl.textContent = 'Defect parameter and process name are required.'; errEl.style.display = 'block'; return; }
  const r = await CALLMASTER_API.post('/api/callmaster/tq/coaching/generate', { defect_parameter, process_name, coaching_title });
  if (r.success) {
    okEl.textContent = 'Coaching content generated! Go to Coaching Library to view and assign.';
    okEl.style.display = 'block';
  } else {
    errEl.textContent = r.error || 'Failed to generate coaching.';
    errEl.style.display = 'block';
  }
}
