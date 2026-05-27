// public/callmaster/js/pages/bm.js

const BM_PAGES = {

  'bm-health': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/health', { preset });
    const d = r.data || {};
    const score = d.quality_score || 0;
    const gaugeColor = score >= 85 ? '#06d6a0' : '#ef4444';
    setTimeout(() => {
      gaugeChart('bmHealthGauge', score, 100, 'Quality Score', { color: gaugeColor });
    }, 0);
    return `
      ${pageHeader('Branch Health', 'Branch-level quality overview')}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"bm-health")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Quality Score',  score ? score.toFixed(1) + '%' : '—', 'Branch CQ%', score >= 85 ? 'up' : 'down')}
        ${kpi('Total Calls',    Number(d.total_calls || 0).toLocaleString(), preset + ' period')}
        ${kpi('Critical Calls', Number(d.critical_count || 0).toLocaleString(), 'Fatal / Critical severity', (d.critical_count || 0) > 0 ? 'down' : 'up')}
        ${kpi('High Risk',      Number(d.high_risk_count || 0).toLocaleString(), 'High severity calls')}
      </div>
      <div class="card" style="max-width:340px">
        <div class="chart-title">Quality Score Gauge</div>
        <div class="chart-wrap" id="bmHealthGauge"></div>
      </div>`;
  },

  'bm-process-breakdown': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/process-breakdown', { preset });
    const rows = r.data || [];
    const cards = rows.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No process data for selected period</div></div>`
      : rows.map(p => `
        <div class="card" style="padding:18px 20px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div style="font-weight:600;font-size:15px">${p.process_name || '—'}</div>
            <span class="badge badge-${(p.source_type || '') === 'Inbound' ? 'blue' : 'violet'}">${p.source_type || '—'}</span>
          </div>
          <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);gap:10px">
            <div class="kpi-card" style="padding:10px">
              <div class="kpi-label">CQ%</div>
              <div class="kpi-value" style="font-size:22px">${p.quality_score ? p.quality_score.toFixed(1) + '%' : '—'}</div>
            </div>
            <div class="kpi-card" style="padding:10px">
              <div class="kpi-label">Calls</div>
              <div class="kpi-value" style="font-size:22px">${Number(p.total_calls || 0).toLocaleString()}</div>
            </div>
            <div class="kpi-card" style="padding:10px">
              <div class="kpi-label">Critical</div>
              <div class="kpi-value" style="font-size:22px;color:${(p.critical_count || 0) > 0 ? '#ef4444' : 'inherit'}">${Number(p.critical_count || 0)}</div>
            </div>
          </div>
        </div>`).join('');
    return `
      ${pageHeader('Process Breakdown', 'Quality by process · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"bm-process-breakdown")')}
      </div>
      <div class="grid-2">${cards}</div>`;
  },

  'bm-team-performance': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/team-performance', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Team Performance', 'Agent-level quality · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"bm-team-performance")')}
      </div>
      ${table(
        [
          { key: 'employee_code',  label: 'Emp Code' },
          { key: 'name',           label: 'Name' },
          { key: 'process_name',   label: 'Process' },
          { key: 'source_type',    label: 'Type',           render: v => `<span class="badge badge-${v === 'Inbound' ? 'blue' : 'violet'}">${v || '—'}</span>` },
          { key: 'avg_score',      label: 'Avg CQ%',        render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'total_calls',    label: 'Calls',          render: v => Number(v || 0).toLocaleString() },
          { key: 'critical_count', label: 'Critical',       render: v => Number(v || 0) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'coaching_count', label: 'Open Coaching',  render: v => Number(v || 0) > 0 ? `<span class="badge badge-yellow">${v}</span>` : '0' },
        ],
        rows,
        { emptyMsg: 'No team performance data for selected period' }
      )}`;
  },

  'bm-daily-sla': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/daily-sla', { preset });
    const d = r.data || {};
    const coverage = d.coverage_pct || 0;
    return `
      ${pageHeader('Daily SLA', 'Audit coverage for today')}
      <div class="kpi-grid">
        ${kpi('Total Calls Today', Number(d.total_calls || 0).toLocaleString(), 'Received today')}
        ${kpi('Audited',           Number(d.audited_calls || 0).toLocaleString(), 'Calls audited today')}
        ${kpi('Pending',           Number(d.pending_calls || 0).toLocaleString(), 'Awaiting audit', (d.pending_calls || 0) > 0 ? 'down' : 'up')}
        ${kpi('Coverage',          coverage ? coverage.toFixed(1) + '%' : '—', 'Audit SLA coverage', coverage >= 90 ? 'up' : 'down')}
      </div>`;
  },

  'bm-risk-calls': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/risk-calls', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Risk Calls', 'High-risk calls requiring attention · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"bm-risk-calls")')}
      </div>
      ${table(
        [
          { key: 'id',             label: 'Call ID' },
          { key: 'source_type',    label: 'Type',     render: v => `<span class="badge badge-${v === 'Inbound' ? 'blue' : 'violet'}">${v || '—'}</span>` },
          { key: 'process_name',   label: 'Process' },
          { key: 'agent',          label: 'Agent' },
          { key: 'alert_severity', label: 'Severity', render: v => sevBadge(v) },
          { key: 'call_date',      label: 'Date' },
        ],
        rows,
        { emptyMsg: 'No risk calls for selected period' }
      )}`;
  },

  'bm-action-items': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/bm/action-items', { preset });
    const rows = r.data || [];
    const priorityColor = { High: '#ef4444', Medium: '#f59e0b', Low: '#6b7280' };
    return `
      ${pageHeader('Action Items', 'Open tasks and coaching assignments')}
      ${table(
        [
          { key: 'item_type',           label: 'Type' },
          { key: 'agent_employee_code', label: 'Emp Code' },
          { key: 'process_name',        label: 'Process' },
          { key: 'title',               label: 'Task' },
          { key: 'priority',            label: 'Priority',   render: v => `<span class="badge" style="background:${priorityColor[v] || '#6b7280'}20;color:${priorityColor[v] || '#6b7280'};border:1px solid ${priorityColor[v] || '#6b7280'}40">${v || '—'}</span>` },
          { key: 'due_date',            label: 'Due Date' },
        ],
        rows,
        { emptyMsg: 'No open action items' }
      )}`;
  },

};
