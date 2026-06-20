// public/callmaster/js/pages/pm.js

const PM_PAGES = {

  // ── 0. My Processes Landing ─────────────────────────────────────────────
  'pm-my-processes': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/my-processes', { preset });
    const processes = r.data || [];

    function scoreColor(q) {
      if (q >= 90) return '#22c55e';
      if (q >= 80) return '#f59e0b';
      return '#ef4444';
    }

    function processCard(p) {
      const isFinnable = p.is_finnable || String(p.client_id) === '497';
      const q = Number(p.avgQuality || 0);
      const onclick = isFinnable
        ? `onclick="window.open('http://localhost:4070','_blank')"`
        : `onclick="state.processName='${String(p.process_name).replace(/'/g,"\\'")}';go('pm-overview')"`;
      return `
        <div class="card" style="cursor:pointer;border:1px solid #1e293b;transition:border-color .15s" ${onclick}
             onmouseenter="this.style.borderColor='#3b82f6'" onmouseleave="this.style.borderColor='#1e293b'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:15px;font-weight:700;color:#e2e8f0">${p.process_name}</div>
              <div style="margin-top:4px">
                <span class="badge badge-${p.source_type === 'Inbound' ? 'blue' : 'violet'}" style="margin-right:6px">${p.source_type}</span>
                ${isFinnable ? '<span class="badge badge-yellow">Finnable ↗</span>' : ''}
              </div>
            </div>
            <div style="font-size:28px;font-weight:800;color:${scoreColor(q)}">${q.toFixed(1)}%</div>
          </div>
          <div style="display:flex;gap:20px;font-size:13px;color:#64748b">
            <span>Calls: <strong style="color:#94a3b8">${Number(p.totalCalls || 0).toLocaleString()}</strong></span>
            <span>Fatal%: <strong style="color:${Number(p.fatalPct) > 5 ? '#ef4444' : '#94a3b8'}">${Number(p.fatalPct || 0).toFixed(1)}%</strong></span>
          </div>
          ${!isFinnable ? '<div style="margin-top:12px;font-size:12px;color:#3b82f6">Click to open →</div>' : ''}
        </div>`;
    }

    const cards = processes.length
      ? `<div class="grid-2">${processes.map(processCard).join('')}</div>`
      : emptyState('No processes assigned for this period.');

    return `
      ${pageHeader('My Processes', processes.length + ' process' + (processes.length !== 1 ? 'es' : '') + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-my-processes")')}
      </div>
      ${cards}`;
  },

  // ── 1. Process Overview ─────────────────────────────────────────────────
  'pm-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/overview', { processName: state.processName, preset });
    const d = r.data || {};
    const trend = d.trend || [];
    setTimeout(() => {
      lineChart(
        'pmOverviewTrend',
        [{ name: 'Avg CQ%', data: trend.map(t => t.avgQuality) }],
        trend.map(t => t.date),
        { targetLine: d.targetCqPct, yFormatter: v => v + '%' }
      );
    }, 0);
    const tqPct = d.tqPct != null ? Number(d.tqPct).toFixed(1) : '—';
    const mqPct = d.mqPct != null ? Number(d.mqPct).toFixed(1) : '—';
    const bqPct = d.bqPct != null ? Number(d.bqPct).toFixed(1) : '—';
    return `
      ${pageHeader('Process Overview', (d.processName || state.processName || '') + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-overview")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Avg CQ%',     (d.avgQuality != null ? Number(d.avgQuality).toFixed(1) + '%' : '—'), 'Call Quality Score')}
        ${kpi('Fatal%',      (d.fatalPct   != null ? Number(d.fatalPct).toFixed(1)   + '%' : '—'), 'Fatal parameter failures', Number(d.fatalPct) > 5 ? 'down' : 'up')}
        ${kpi('Total Calls', Number(d.totalCalls || 0).toLocaleString(), 'Audited calls')}
        ${kpi('TQ / MQ / BQ', `${tqPct}% / ${mqPct}% / ${bqPct}%`, `TQ: ${d.tqCount || 0}  MQ: ${d.mqCount || 0}  BQ: ${d.bqCount || 0}`)}
      </div>
      <div class="card">
        <div class="chart-title">Quality Trend</div>
        <div class="chart-wrap" id="pmOverviewTrend"></div>
      </div>`;
  },

  // ── 2. Agent Leaderboard ────────────────────────────────────────────────
  'pm-agent-ranking': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/agent-leaderboard', { processName: state.processName, preset });
    const rows = (r.data || []).map((row, i) => ({ ...row, _rank: i + 1 }));
    const exportCols = [
      { key: '_rank', label: '#' }, { key: 'agent_name', label: 'Agent Name' },
      { key: 'emp_id', label: 'Emp ID' }, { key: 'totalCalls', label: 'Total Calls' },
      { key: 'avgQuality', label: 'Avg CQ%' }, { key: 'fatalPct', label: 'Fatal%' },
      { key: 'classification', label: 'Classification' },
    ];
    return `
      ${pageHeader('Agent Leaderboard', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${presetBar(preset, 'go.bind(null,"pm-agent-ranking")')}
        ${exportBtn('Export CSV', `exportTableCsv(${JSON.stringify(exportCols)}, ${JSON.stringify(rows)}, 'agent_leaderboard_${preset}.csv')`)}
        ${exportBtn('Full Export', `downloadCsv('/api/callmaster/export/analyst-performance?preset=${preset}&processName=${encodeURIComponent(state.processName||'')}','agent_performance_${preset}.csv')`)}
      </div>
      ${table(
        [
          { key: '_rank',          label: '#',              render: v => `<span class="td-mono">${v}</span>` },
          { key: 'agent_name',     label: 'Agent Name' },
          { key: 'emp_id',         label: 'Emp ID',         render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'totalCalls',     label: 'Total Calls',    render: v => Number(v || 0).toLocaleString() },
          { key: 'avgQuality',     label: 'Avg CQ%',        render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'fatalPct',       label: 'Fatal%',         render: v => v != null ? `<span class="td-mono ${Number(v) > 5 ? 'sev-high' : ''}">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'classification', label: 'Classification', render: v => classificationBadge(v) },
        ],
        rows,
        { emptyMsg: 'No agent data for selected period' }
      )}`;
  },

  // ── 3. Parameter Breakdown ──────────────────────────────────────────────
  'pm-param-breakdown': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/parameter-breakdown', { processName: state.processName, preset });
    const d = r.data || {};
    const PARAMS = [
      { key: 'professionalism_maintained',      label: 'Professionalism' },
      { key: 'accurate_issue_probing',           label: 'Issue Probing' },
      { key: 'case_escalated_correctly',         label: 'Escalation' },
      { key: 'proper_hold_procedure',            label: 'Hold Procedure' },
      { key: 'correct_and_complete_information', label: 'Correct Info' },
      { key: 'proper_call_closure',              label: 'Call Closure' },
    ];
    const total = Number(d.total || 0);
    const paramRows = PARAMS.map(p => ({
      label:   p.label,
      count:   Number(d[p.key] || 0),
      passPct: total > 0 ? Math.round((Number(d[p.key] || 0) / total) * 100) : 0,
    }));
    setTimeout(() => {
      barChart(
        'pmParamChart',
        [{ name: 'Pass Rate %', data: paramRows.map(p => p.passPct) }],
        paramRows.map(p => p.label),
        { horizontal: true, yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Parameter Breakdown', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-param-breakdown")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Evaluated', Number(total).toLocaleString(), 'Calls in scope')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Parameter Pass Rate</div>
        <div class="chart-wrap" id="pmParamChart"></div>
      </div>
      ${table(
        [
          { key: 'label',   label: 'Parameter' },
          { key: 'count',   label: 'Pass Count',  render: v => Number(v).toLocaleString() },
          { key: 'passPct', label: 'Pass Rate %',  render: v => `<span class="td-mono">${v}%</span>` },
        ],
        paramRows,
        { emptyMsg: 'No parameter data available' }
      )}`;
  },

  // ── 4. TNI Report ───────────────────────────────────────────────────────
  'pm-tni-report': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/tni-report', { processName: state.processName, preset });
    const rows = r.data || [];
    const PARAM_KEYS   = ['professionalism_maintained', 'accurate_issue_probing', 'case_escalated_correctly', 'proper_hold_procedure', 'correct_and_complete_information', 'proper_call_closure'];
    const PARAM_LABELS = ['Professionalism', 'Issue Probing', 'Escalation', 'Hold Procedure', 'Correct Info', 'Call Closure'];
    setTimeout(() => {
      if (rows.length > 0) {
        const series = rows.map(row => ({
          name: row.agent_name || row.emp_id || '—',
          data: PARAM_KEYS.map((k, i) => ({ x: PARAM_LABELS[i], y: Number(row[k] || 0) })),
        }));
        heatmapChart('pmTniHeatmap', series, { title: 'TNI — Darker = More Defects' });
      }
    }, 0);
    return `
      ${pageHeader('TNI Report', 'Agent × Parameter defect heatmap · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${presetBar(preset, 'go.bind(null,"pm-tni-report")')}
        ${exportBtn('Export CSV', `downloadCsv('/api/callmaster/export/tni-report?preset=${preset}&processName='+encodeURIComponent(state.processName||''),'tni_report_${preset}.csv')`)}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Training Need Index</div>
        <div id="pmTniHeatmap" style="min-height:300px"></div>
      </div>
      ${table(
        [
          { key: 'agent_name',                       label: 'Agent' },
          { key: 'emp_id',                           label: 'Emp ID',          render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'professionalism_maintained',       label: 'Professionalism', render: v => Number(v || 0) },
          { key: 'accurate_issue_probing',           label: 'Issue Probing',   render: v => Number(v || 0) },
          { key: 'case_escalated_correctly',         label: 'Escalation',      render: v => Number(v || 0) },
          { key: 'proper_hold_procedure',            label: 'Hold Procedure',  render: v => Number(v || 0) },
          { key: 'correct_and_complete_information', label: 'Correct Info',    render: v => Number(v || 0) },
          { key: 'proper_call_closure',              label: 'Call Closure',    render: v => Number(v || 0) },
          { key: 'total',                            label: 'Total Defects',   render: v => v != null ? `<span class="td-mono">${v}</span>` : '—' },
        ],
        rows,
        { emptyMsg: 'No TNI data for selected period' }
      )}`;
  },

  // ── 5. Coaching Queue ───────────────────────────────────────────────────
  'pm-coaching-queue': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/coaching-queue', { processName: state.processName, preset });
    const rows = r.data || [];
    const pending = rows.filter(row => (row.status || '').toLowerCase() !== 'done' && (row.status || '').toLowerCase() !== 'completed').length;
    return `
      ${pageHeader('Coaching Queue', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-coaching-queue")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Items', rows.length, 'Coaching queue entries')}
        ${kpi('Pending',     pending,     'Awaiting coaching', pending > 10 ? 'down' : 'up')}
      </div>
      ${table(
        [
          { key: 'agent_name',             label: 'Agent' },
          { key: 'source_call_id',         label: 'Call ID',    render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'call_quality_percentage', label: 'Quality%',  render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'status',                 label: 'Status',     render: v => {
            const cls = (v||'').toLowerCase() === 'done' || (v||'').toLowerCase() === 'completed' ? 'green' : 'yellow';
            return `<span class="badge badge-${cls}">${v || '—'}</span>`;
          }},
        ],
        rows,
        { emptyMsg: 'No coaching items in queue' }
      )}`;
  },

  // ── 6. LOB Breakdown ────────────────────────────────────────────────────
  'pm-lob-breakdown': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/lob-breakdown', { processName: state.processName, preset });
    const rows = r.data || [];
    setTimeout(() => {
      if (rows.length > 0) {
        barChart(
          'pmLobChart',
          [
            { name: 'Avg CQ%',    data: rows.map(row => Number(row.avgQuality || 0)) },
            { name: 'Target CQ%', data: rows.map(row => Number(row.targetCqPct || 0)) },
          ],
          rows.map(row => row.lob_name || '—'),
          { yFormatter: v => v + '%' }
        );
      }
    }, 0);
    return `
      ${pageHeader('LOB Breakdown', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-lob-breakdown")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Quality vs Target by LOB</div>
        <div class="chart-wrap" id="pmLobChart"></div>
      </div>
      ${table(
        [
          { key: 'lob_name',    label: 'LOB' },
          { key: 'totalCalls',  label: 'Total Calls',  render: v => Number(v || 0).toLocaleString() },
          { key: 'avgQuality',  label: 'Avg CQ%',      render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'fatalPct',    label: 'Fatal%',        render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'targetCqPct', label: 'Target CQ%',   render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: '_vs',         label: 'vs Target',    render: (_, row) => {
            const diff = (Number(row.avgQuality || 0) - Number(row.targetCqPct || 0)).toFixed(1);
            const cls  = Number(diff) >= 0 ? 'kpi-trend-up' : 'kpi-trend-down';
            return `<span class="${cls} td-mono">${Number(diff) >= 0 ? '+' : ''}${diff}%</span>`;
          }},
        ],
        rows,
        { emptyMsg: 'No LOB data for selected period' }
      )}`;
  },

  // ── 7. Fatal Analysis ───────────────────────────────────────────────────
  'pm-fatal-analysis': async function(preset) {
    const [r, rAlerts] = await Promise.all([
      CALLMASTER_API.post('/api/callmaster/pm/fatal-analysis', { processName: state.processName, preset }),
      CALLMASTER_API.post('/api/callmaster/pm/risk-alerts',    { processName: state.processName, preset }),
    ]);
    const d = r.data || {};
    const scenarios = d.fatalByScenario || [];
    const alerts = Array.isArray(rAlerts.data) ? rAlerts.data : [];
    setTimeout(() => {
      if (scenarios.length > 0) {
        barChart(
          'pmFatalChart',
          [{ name: 'Fatal Count', data: scenarios.map(s => Number(s.count || 0)) }],
          scenarios.map(s => s.scenario || '—'),
          { horizontal: true }
        );
      }
    }, 0);
    return `
      ${pageHeader('Fatal Analysis', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-fatal-analysis")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Fatal Count', Number(d.fatalCount || 0).toLocaleString(), 'Calls with fatal failures', Number(d.fatalCount) > 0 ? 'down' : 'up')}
        ${kpi('Fatal%',      (d.fatalPct != null ? Number(d.fatalPct).toFixed(1) + '%' : '—'), 'Of total audited calls', Number(d.fatalPct) > 5 ? 'down' : 'up')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Fatal Calls by Scenario</div>
        <div class="chart-wrap" id="pmFatalChart"></div>
      </div>
      ${table(
        [
          { key: 'scenario', label: 'Scenario' },
          { key: 'count',    label: 'Count',  render: v => Number(v || 0).toLocaleString() },
          { key: 'pct',      label: '% of Fatals', render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
        ],
        scenarios,
        { emptyMsg: 'No fatal calls in selected period' }
      )}
      ${alerts.length === 0 ? '' : `
        <div class="card" style="margin-top:20px">
          <div class="chart-title">Unacknowledged Risk Alerts</div>
          ${table(
            [
              { key: 'source_call_id', label: 'Call ID',  render: v => `<span class="td-mono">${v}</span>` },
              { key: 'agent',          label: 'Agent' },
              { key: 'alert_severity', label: 'Severity', render: v => sevBadge(v) },
              { key: 'alert_reason',   label: 'Reason' },
              { key: 'call_date',      label: 'Date' },
              { key: 'alert_id',       label: '', render: v => v
                  ? \`<button class="badge badge-green" style="cursor:pointer;border:none;padding:4px 10px" onclick="pmAcknowledgeAlert(\${v})">Acknowledge</button>\`
                  : '' },
            ],
            alerts
          )}
        </div>`}`;
  },

  // ── 8. Scenario Breakdown (Inbound) ────────────────────────────────────
  'pm-scenario-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/scenario-breakdown', { processName: state.processName, preset });
    const d = r.data || {};
    const scenarios = d.byScenario || [];
    setTimeout(() => {
      if (scenarios.length > 0) {
        donutChart(
          'pmScenarioDonut',
          scenarios.map(s => s.scenario || '—'),
          scenarios.map(s => Number(s.count || 0)),
          { title: 'Call Distribution by Scenario' }
        );
      }
    }, 0);
    return `
      ${pageHeader('Scenario Breakdown', state.processName + ' (Inbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-scenario-analysis")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Calls', Number(d.total || 0).toLocaleString(), 'Inbound calls in scope')}
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="chart-title">Scenario Distribution</div>
          <div class="chart-wrap" id="pmScenarioDonut"></div>
        </div>
        <div>
          ${table(
            [
              { key: 'scenario', label: 'Scenario' },
              { key: 'count',    label: 'Count',  render: v => Number(v || 0).toLocaleString() },
              { key: 'pct',      label: '%',       render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
            ],
            scenarios,
            { emptyMsg: 'No scenario data available' }
          )}
        </div>
      </div>`;
  },

  // ── 9. Detail Analysis (Inbound) ────────────────────────────────────────
  'pm-detail-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/detail-analysis', { processName: state.processName, preset });
    const d = r.data || {};
    const params = d.parameters || [];
    setTimeout(() => {
      if (params.length > 0) {
        barChart(
          'pmDetailChart',
          [
            { name: 'Pass Rate %', data: params.map(p => Number(p.passRate || 0)) },
            { name: 'Fail Rate %', data: params.map(p => Number(p.failRate || 0)) },
          ],
          params.map(p => p.param || '—'),
          { horizontal: true, yFormatter: v => v + '%' }
        );
      }
    }, 0);
    return `
      ${pageHeader('Detail Analysis', state.processName + ' (Inbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-detail-analysis")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Parameter Pass / Fail Rate</div>
        <div class="chart-wrap" id="pmDetailChart"></div>
      </div>
      ${table(
        [
          { key: 'param',    label: 'Parameter' },
          { key: 'passRate', label: 'Pass Rate %', render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'failRate', label: 'Fail Rate %', render: v => v != null ? `<span class="td-mono ${Number(v) > 30 ? 'sev-high' : ''}">${Number(v).toFixed(1)}%</span>` : '—' },
        ],
        params,
        { emptyMsg: 'No detail data available' }
      )}`;
  },

  // ── 10. Escalation Analysis (Inbound) ──────────────────────────────────
  'pm-escalation-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/escalation-analysis', { processName: state.processName, preset });
    const d = r.data || {};
    return `
      ${pageHeader('Escalation Analysis', state.processName + ' (Inbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-escalation-analysis")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Escalation Failures',  Number(d.escalation_failures  || 0).toLocaleString(), 'Incorrect escalations',  Number(d.escalation_failures)  > 0 ? 'down' : 'up')}
        ${kpi('Data Theft Cases',     Number(d.data_theft_cases      || 0).toLocaleString(), 'Critical risk events',   Number(d.data_theft_cases)      > 0 ? 'down' : 'up')}
        ${kpi('Competitor Mentions',  Number(d.competitor_mentions   || 0).toLocaleString(), 'Policy violations',      Number(d.competitor_mentions)   > 0 ? 'down' : 'up')}
        ${kpi('Cuss Calls',           Number(d.cuss_calls            || 0).toLocaleString(), 'Abusive language events', Number(d.cuss_calls)            > 0 ? 'down' : 'up')}
      </div>`;
  },

  // ── 11. CST / CRT Funnel (Outbound) ────────────────────────────────────
  'pm-cst-funnel': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/cst-crt-funnel', { processName: state.processName, preset });
    const d   = r.data || {};
    const cst = d.cst  || {};
    const crt = d.crt  || {};
    const cstFunnel = cst.funnel || [];
    const crtFunnel = crt.funnel || [];
    setTimeout(() => {
      if (cstFunnel.length > 0) {
        funnelChart(
          'pmCstFunnel',
          cstFunnel.map(s => s.stage || '—'),
          cstFunnel.map(s => Number(s.count || 0)),
          { title: 'CST Funnel', color: '#3b82f6' }
        );
      }
      if (crtFunnel.length > 0) {
        funnelChart(
          'pmCrtFunnel',
          crtFunnel.map(s => s.stage || '—'),
          crtFunnel.map(s => Number(s.count || 0)),
          { title: 'CRT Funnel', color: '#06d6a0' }
        );
      }
    }, 0);
    return `
      ${pageHeader('CST / CRT Funnel', state.processName + ' (Outbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-cst-funnel")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('CST Total', Number(cst.total || 0).toLocaleString(), 'CST calls')}
        ${kpi('CRT Total', Number(crt.total || 0).toLocaleString(), 'CRT calls')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">CST Funnel</div>
          <div class="chart-wrap" id="pmCstFunnel"></div>
        </div>
        <div class="card">
          <div class="chart-title">CRT Funnel</div>
          <div class="chart-wrap" id="pmCrtFunnel"></div>
        </div>
      </div>`;
  },

  // ── 12. Pitch Stage Analysis (Outbound) ────────────────────────────────
  'pm-pitch-stage': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/pitch-stage-analysis', { processName: state.processName, preset });
    const d      = r.data  || {};
    const stages = d.stages || [];
    setTimeout(() => {
      if (stages.length > 0) {
        barChart(
          'pmPitchChart',
          [{ name: 'Calls', data: stages.map(s => Number(s.count || 0)) }],
          stages.map(s => s.stage || '—'),
          { yFormatter: v => Number(v).toLocaleString() }
        );
      }
    }, 0);
    return `
      ${pageHeader('Pitch Stage Analysis', state.processName + ' (Outbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-pitch-stage")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Calls by Pitch Stage</div>
        <div class="chart-wrap" id="pmPitchChart"></div>
      </div>
      ${table(
        [
          { key: 'stage', label: 'Pitch Stage' },
          { key: 'count', label: 'Count', render: v => Number(v || 0).toLocaleString() },
          { key: 'pct',   label: '%',     render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
        ],
        stages,
        { emptyMsg: 'No pitch stage data available' }
      )}`;
  },

  // ── 13. Objection / Rebuttal (Outbound) ────────────────────────────────
  'pm-objection-rebuttal': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/objection-rebuttal', { processName: state.processName, preset });
    const d          = r.data      || {};
    const objections = d.objections || [];
    const rebuttals  = d.rebuttals  || [];
    setTimeout(() => {
      if (objections.length > 0) {
        barChart(
          'pmObjChart',
          [{ name: 'Count', data: objections.map(o => Number(o.count || 0)) }],
          objections.map(o => o.category || '—'),
          { horizontal: true }
        );
      }
      if (rebuttals.length > 0) {
        barChart(
          'pmRebChart',
          [{ name: 'Count', data: rebuttals.map(rb => Number(rb.count || 0)) }],
          rebuttals.map(rb => rb.category || '—'),
          { horizontal: true }
        );
      }
    }, 0);
    return `
      ${pageHeader('Objection / Rebuttal Analysis', state.processName + ' (Outbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-objection-rebuttal")')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">Objections by Category</div>
          <div class="chart-wrap" id="pmObjChart"></div>
        </div>
        <div class="card">
          <div class="chart-title">Rebuttals by Category</div>
          <div class="chart-wrap" id="pmRebChart"></div>
        </div>
      </div>`;
  },

  // ── 14. Missed Opportunities (Outbound) ────────────────────────────────
  'pm-moa': async function(preset) {
    const r    = await CALLMASTER_API.post('/api/callmaster/pm/missed-opportunities', { processName: state.processName, preset });
    const rows = r.data || [];
    setTimeout(() => {
      if (rows.length > 0) {
        barChart(
          'pmMoaChart',
          [{ name: 'Missed Opportunities', data: rows.map(row => Number(row.count || 0)) }],
          rows.map(row => row.category || '—'),
          { horizontal: true }
        );
      }
    }, 0);
    return `
      ${pageHeader('Missed Opportunities', state.processName + ' (Outbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-moa")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Missed Opportunity Categories</div>
        <div class="chart-wrap" id="pmMoaChart"></div>
      </div>
      ${table(
        [
          { key: 'category', label: 'Category' },
          { key: 'count',    label: 'Count',  render: v => Number(v || 0).toLocaleString() },
          { key: 'pct',      label: '%',       render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
        ],
        rows,
        { emptyMsg: 'No missed opportunity data available' }
      )}`;
  },

  // ── 15. NPS / CSAT (Outbound) ───────────────────────────────────────────
  'pm-nps-csat': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/nps-csat', { processName: state.processName, preset });
    const d = r.data || {};
    const breakdown = d.breakdown || [];
    setTimeout(() => {
      if (breakdown.length > 0) {
        donutChart(
          'pmNpsDonut',
          breakdown.map(b => b.category || '—'),
          breakdown.map(b => Number(b.count || 0)),
          { title: 'NPS/CSAT Breakdown' }
        );
      }
    }, 0);
    return `
      ${pageHeader('NPS / CSAT', state.processName + ' (Outbound) · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-nps-csat")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('NPS',  d.nps  != null ? Number(d.nps).toFixed(1)  : '—', 'Net Promoter Score', Number(d.nps)  >= 30 ? 'up' : 'down')}
        ${kpi('CSAT', d.csat != null ? Number(d.csat).toFixed(1) + '%' : '—', 'Customer Satisfaction', Number(d.csat) >= 75 ? 'up' : 'down')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">Score Breakdown</div>
          <div class="chart-wrap" id="pmNpsDonut"></div>
        </div>
        <div>
          ${table(
            [
              { key: 'category', label: 'Category' },
              { key: 'count',    label: 'Count', render: v => Number(v || 0).toLocaleString() },
            ],
            breakdown,
            { emptyMsg: 'No NPS/CSAT data available' }
          )}
        </div>
      </div>`;
  },

  // ── 16. Inbound Call Explorer ───────────────────────────────────────────
  'pm-inbound-explorer': async function(preset) {
    const page     = state.explorerPage   || 1;
    const search   = state.explorerSearch || '';
    const pageSize = 20;
    const r    = await CALLMASTER_API.post('/api/callmaster/pm/inbound-explorer', { processName: state.processName, preset, page, pageSize, search });
    const d    = r.data || {};
    const rows = d.rows || (Array.isArray(r.data) ? r.data : []);
    const total = Number(d.total || rows.length || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const exportCols = [
      { key: 'source_call_id', label: 'Call ID' }, { key: 'agent_name', label: 'Agent' },
      { key: 'lob', label: 'LOB' }, { key: 'call_date', label: 'Date' },
      { key: 'call_quality_percentage', label: 'Quality%' }, { key: 'fatal_flag', label: 'Fatal' }, { key: 'scenario', label: 'Scenario' },
    ];
    return `
      ${pageHeader('Inbound Call Explorer', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${presetBar(preset, 'go.bind(null,"pm-inbound-explorer")')}
        ${exportBtn('Export CSV', `exportTableCsv(${JSON.stringify(exportCols)}, ${JSON.stringify(rows)}, 'inbound_explorer_p${page}.csv')`)}
        ${exportBtn('Full Export', `downloadCsv('/api/callmaster/export/inbound-calls?preset=${preset}&processName='+encodeURIComponent(state.processName||''),'inbound_calls_all.csv')`)}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <input id="explorerSearchInput" type="text" value="${search.replace(/"/g,'&quot;')}"
          placeholder="Search agent, call ID, LOB..."
          style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:7px 12px;color:#e2e8f0;font-size:13px;min-width:240px"
          onkeydown="if(event.key==='Enter'){state.explorerSearch=this.value;state.explorerPage=1;go('pm-inbound-explorer')}" />
        <button onclick="state.explorerSearch=document.getElementById('explorerSearchInput').value;state.explorerPage=1;go('pm-inbound-explorer')"
          style="background:#2563eb;border:none;border-radius:6px;padding:7px 14px;color:#fff;font-size:13px;cursor:pointer">Search</button>
        ${search ? `<button onclick="state.explorerSearch='';state.explorerPage=1;go('pm-inbound-explorer')" style="background:#334155;border:none;border-radius:6px;padding:7px 12px;color:#94a3b8;font-size:13px;cursor:pointer">Clear</button>` : ''}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Rows', total.toLocaleString(), 'Inbound calls matching filter')}
        ${kpi('Page', page + ' / ' + totalPages, pageSize + ' per page')}
      </div>
      ${table(
        [
          { key: 'source_call_id',          label: 'Call ID',   render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'agent_name',              label: 'Agent' },
          { key: 'lob',                     label: 'LOB' },
          { key: 'call_date',               label: 'Date' },
          { key: 'call_quality_percentage', label: 'Quality%',  render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'fatal_flag',              label: 'Fatal',     render: v => v ? `<span class="badge badge-red">Yes</span>` : `<span class="badge badge-green">No</span>` },
          { key: 'scenario',                label: 'Scenario' },
        ],
        rows,
        { emptyMsg: 'No inbound call records found' }
      )}
      <div style="display:flex;align-items:center;gap:8px;margin-top:16px;justify-content:flex-end">
        <span style="font-size:13px;color:#64748b">${total.toLocaleString()} rows · Page ${page} of ${totalPages}</span>
        ${page > 1 ? `<button onclick="state.explorerPage=${page-1};go('pm-inbound-explorer')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">&#8592; Prev</button>` : ''}
        ${page < totalPages ? `<button onclick="state.explorerPage=${page+1};go('pm-inbound-explorer')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">Next &#8594;</button>` : ''}
      </div>`;
  },

  // ── 17. Outbound Call Explorer ──────────────────────────────────────────
  'pm-outbound-explorer': async function(preset) {
    const page     = state.explorerPage   || 1;
    const search   = state.explorerSearch || '';
    const pageSize = 20;
    const r    = await CALLMASTER_API.post('/api/callmaster/pm/outbound-explorer', { processName: state.processName, preset, page, pageSize, search });
    const d    = r.data || {};
    const rows = d.rows || (Array.isArray(r.data) ? r.data : []);
    const total = Number(d.total || rows.length || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const exportCols = [
      { key: 'source_call_id', label: 'Call ID' }, { key: 'agent_name', label: 'Agent' },
      { key: 'lob', label: 'LOB' }, { key: 'call_date', label: 'Date' },
      { key: 'call_quality_percentage', label: 'Quality%' }, { key: 'fatal_flag', label: 'Fatal' }, { key: 'pitch_stage', label: 'Pitch Stage' },
    ];
    return `
      ${pageHeader('Outbound Call Explorer', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${presetBar(preset, 'go.bind(null,"pm-outbound-explorer")')}
        ${exportBtn('Export CSV', `exportTableCsv(${JSON.stringify(exportCols)}, ${JSON.stringify(rows)}, 'outbound_explorer_p${page}.csv')`)}
        ${exportBtn('Full Export', `downloadCsv('/api/callmaster/export/outbound-calls?preset=${preset}&processName='+encodeURIComponent(state.processName||''),'outbound_calls_all.csv')`)}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <input id="explorerSearchInput" type="text" value="${search.replace(/"/g,'&quot;')}"
          placeholder="Search agent, call ID, LOB..."
          style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:7px 12px;color:#e2e8f0;font-size:13px;min-width:240px"
          onkeydown="if(event.key==='Enter'){state.explorerSearch=this.value;state.explorerPage=1;go('pm-outbound-explorer')}" />
        <button onclick="state.explorerSearch=document.getElementById('explorerSearchInput').value;state.explorerPage=1;go('pm-outbound-explorer')"
          style="background:#2563eb;border:none;border-radius:6px;padding:7px 14px;color:#fff;font-size:13px;cursor:pointer">Search</button>
        ${search ? `<button onclick="state.explorerSearch='';state.explorerPage=1;go('pm-outbound-explorer')" style="background:#334155;border:none;border-radius:6px;padding:7px 12px;color:#94a3b8;font-size:13px;cursor:pointer">Clear</button>` : ''}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Rows', total.toLocaleString(), 'Outbound calls matching filter')}
        ${kpi('Page', page + ' / ' + totalPages, pageSize + ' per page')}
      </div>
      ${table(
        [
          { key: 'source_call_id',          label: 'Call ID',    render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'agent_name',              label: 'Agent' },
          { key: 'lob',                     label: 'LOB' },
          { key: 'call_date',               label: 'Date' },
          { key: 'call_quality_percentage', label: 'Quality%',   render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
          { key: 'fatal_flag',              label: 'Fatal',      render: v => v ? `<span class="badge badge-red">Yes</span>` : `<span class="badge badge-green">No</span>` },
          { key: 'pitch_stage',             label: 'Pitch Stage' },
        ],
        rows,
        { emptyMsg: 'No outbound call records found' }
      )}
      <div style="display:flex;align-items:center;gap:8px;margin-top:16px;justify-content:flex-end">
        <span style="font-size:13px;color:#64748b">${total.toLocaleString()} rows · Page ${page} of ${totalPages}</span>
        ${page > 1 ? `<button onclick="state.explorerPage=${page-1};go('pm-outbound-explorer')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">&#8592; Prev</button>` : ''}
        ${page < totalPages ? `<button onclick="state.explorerPage=${page+1};go('pm-outbound-explorer')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">Next &#8594;</button>` : ''}
      </div>`;
  },

  // ── 18. Call Explorer (smart: inbound or outbound based on process config) ─
  'pm-explorer': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/overview', { processName: state.processName, preset });
    const sourceType = (r.data || {}).sourceType || 'Inbound';
    if (sourceType === 'Outbound') return PM_PAGES['pm-outbound-explorer'](preset);
    return PM_PAGES['pm-inbound-explorer'](preset);
  },

  // ── 19. Daily Trends ─────────────────────────────────────────────────────
  'pm-trends': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/overview', { processName: state.processName, preset });
    const d = r.data || {};
    const trend = d.trend || [];
    setTimeout(() => {
      lineChart(
        'pmTrendsChart',
        [{ name: 'Avg CQ%', data: trend.map(t => t.avgQuality) }],
        trend.map(t => t.date),
        { targetLine: d.targetCqPct, yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Daily Trends', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-trends")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Daily Quality Score Trend</div>
        <div class="chart-wrap" id="pmTrendsChart"></div>
      </div>
      ${trend.length === 0 ? emptyState('No trend data for selected period') : table(
        [
          { key: 'date',       label: 'Date' },
          { key: 'avgQuality', label: 'Avg CQ%', render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(2)}%</span>` : '—' },
        ],
        trend
      )}`;
  },

  // ── 20. Evidence Viewer ───────────────────────────────────────────────────
  'pm-evidence': async function(preset) {
    return `
      ${pageHeader('Evidence Viewer', 'Look up a call by ID')}
      <div class="card" style="max-width:480px;margin-bottom:20px">
        <div style="margin-bottom:12px">
          <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Call ID</label>
          <input id="pmEvidenceCallId" type="text" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px;color:#f1f5f9;font-size:13px" placeholder="e.g. IB-2891 or OB-5512" />
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Source Type</label>
          <select id="pmEvidenceSourceType" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px;color:#f1f5f9;font-size:13px">
            <option value="Inbound">Inbound</option>
            <option value="Outbound">Outbound</option>
          </select>
        </div>
        <button onclick="loadPmEvidence()" style="background:#2563eb;border:none;border-radius:6px;padding:8px 20px;color:#fff;cursor:pointer;font-weight:600">Load Call</button>
      </div>
      <div id="pmEvidenceResult"></div>`;
  },

  // ── 21. Defect Analysis ───────────────────────────────────────────────────
  'pm-defect-analysis': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/pm/parameter-breakdown', { processName: state.processName, preset });
    const d = r.data || {};
    const PARAMS = [
      { key: 'professionalism_maintained',      label: 'Professionalism' },
      { key: 'accurate_issue_probing',           label: 'Issue Probing' },
      { key: 'case_escalated_correctly',         label: 'Escalation' },
      { key: 'proper_hold_procedure',            label: 'Hold Procedure' },
      { key: 'correct_and_complete_information', label: 'Correct Info' },
      { key: 'proper_call_closure',              label: 'Call Closure' },
    ];
    const total = Number(d.total || 0);
    const rows = PARAMS.map(p => {
      const pass = Number(d[p.key] || 0);
      const fail = total - pass;
      const failPct = total > 0 ? +((fail / total) * 100).toFixed(1) : 0;
      return { parameter: p.label, pass_count: pass, fail_count: fail > 0 ? fail : 0, fail_pct: failPct };
    }).sort((a, b) => b.fail_pct - a.fail_pct);
    setTimeout(() => {
      if (rows.length > 0) {
        barChart('pmDefectChart',
          [{ name: 'Defect %', data: rows.map(r => r.fail_pct) }],
          rows.map(r => r.parameter),
          { horizontal: true, yFormatter: v => v + '%' }
        );
      }
    }, 0);
    return `
      ${pageHeader('Defect Analysis', state.processName + ' · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"pm-defect-analysis")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Defect Rate by Parameter (ranked worst first)</div>
        <div class="chart-wrap" id="pmDefectChart"></div>
      </div>
      ${table(
        [
          { key: 'parameter', label: 'Parameter' },
          { key: 'fail_pct',  label: 'Defect %', render: v => {
              const n = Number(v);
              const cls = n > 20 ? 'sev-critical' : n > 10 ? 'sev-high' : '';
              return `<span class="td-mono ${cls}">${n.toFixed(1)}%</span>`;
          }},
          { key: 'fail_count', label: 'Defects',  render: v => Number(v || 0).toLocaleString() },
          { key: 'pass_count', label: 'Passed',   render: v => Number(v || 0).toLocaleString() },
        ],
        rows,
        { emptyMsg: 'No parameter data for selected period' }
      )}`;
  },

  // ── Aliases: nav keys → existing page functions ──────────────────────────
  'pm-parameters':        async function(preset) { return PM_PAGES['pm-param-breakdown'](preset); },
  'pm-analyst-scorecard': async function(preset) { return PM_PAGES['pm-agent-ranking'](preset); },
  'pm-tni':               async function(preset) { return PM_PAGES['pm-tni-report'](preset); },
  'pm-scenario':          async function(preset) { return PM_PAGES['pm-scenario-analysis'](preset); },
  'pm-escalation':        async function(preset) { return PM_PAGES['pm-escalation-analysis'](preset); },
  'pm-cst-crt':           async function(preset) { return PM_PAGES['pm-cst-funnel'](preset); },
  'pm-missed-opp':        async function(preset) { return PM_PAGES['pm-moa'](preset); },

};

async function pmAcknowledgeAlert(alertId) {
  if (!confirm('Acknowledge this alert?')) return;
  const r = await CALLMASTER_API.post('/api/callmaster/pm/alerts/' + alertId + '/acknowledge', {});
  if (r.success) go('pm-fatal-analysis');
  else alert('Failed: ' + (r.error || r.message || 'Unknown error'));
}

async function loadPmEvidence() {
  const callId    = document.getElementById('pmEvidenceCallId').value.trim();
  const srcType   = document.getElementById('pmEvidenceSourceType').value;
  const container = document.getElementById('pmEvidenceResult');
  if (!callId) { container.innerHTML = '<div style="color:#f87171;font-size:13px">Enter a Call ID first.</div>'; return; }
  container.innerHTML = skeleton();
  window._analystCallId    = callId;
  window._analystSourceType = srcType;
  const r = await CALLMASTER_API.get('/api/callmaster/analyst/call/' + callId + '?sourceType=' + encodeURIComponent(srcType));
  if (!r.success || !r.data) { container.innerHTML = '<div style="color:#f87171;font-size:13px">Call not found.</div>'; return; }
  // Reuse analyst-evidence rendering logic via go, or render inline
  const d = r.data;
  const isInbound = srcType === 'Inbound';
  const flagRow = (label, val, bad) => {
    const isBad = bad || (val && val !== 'No' && val !== '0' && val !== 0);
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e293b">
      <span style="color:#94a3b8;font-size:13px">${label}</span>
      <span class="${isBad ? 'sev-critical' : ''}" style="font-size:13px;color:${isBad ? '#ef4444' : '#4ade80'}">${val != null ? val : '—'}</span>
    </div>`;
  };
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="chart-title">Call: ${d.source_call_id}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:12px">
        ${flagRow('Agent', d.agent_employee_name)}
        ${flagRow('Process', d.process_name)}
        ${flagRow('Date', d.call_datetime ? new Date(d.call_datetime).toLocaleString() : d.call_date)}
        ${flagRow('Duration', d.length_in_sec ? Math.floor(d.length_in_sec/60) + 'm ' + (d.length_in_sec%60) + 's' : '—')}
        ${flagRow('Quality Score', d.quality_score != null ? d.quality_score + '%' : '—')}
        ${isInbound ? flagRow('Fraud Risk Score', d.overall_fraud_risk_score, Number(d.overall_fraud_risk_score) > 0.5) : flagRow('Sale Done', d.SaleDone ? 'Yes' : 'No')}
      </div>
    </div>
    ${isInbound ? `
    <div class="card" style="margin-bottom:16px">
      <div class="chart-title">Risk & Compliance Flags</div>
      <div style="margin-top:8px">
        ${flagRow('Data Theft / Misuse',           d.data_theft_or_misuse,           d.data_theft_or_misuse === 'Yes')}
        ${flagRow('Financial Fraud',               d.financial_fraud,                d.financial_fraud === 'Yes')}
        ${flagRow('Escalation Failure',            d.escalation_failure,             d.escalation_failure === 'Yes')}
        ${flagRow('Unprofessional Behavior',       d.unprofessional_behavior,        d.unprofessional_behavior === 'Yes')}
        ${flagRow('System Manipulation',           d.system_manipulation,            d.system_manipulation === 'Yes')}
        ${flagRow('Collusion',                     d.collusion,                      d.collusion === 'Yes')}
        ${flagRow('Policy Communication Failure',  d.policy_communication_failure,   d.policy_communication_failure === 'Yes')}
      </div>
    </div>` : `
    <div class="card" style="margin-bottom:16px">
      <div class="chart-title">Sales Intelligence</div>
      <div style="margin-top:8px">
        ${flagRow('Disposition',         d.CallDisposition)}
        ${flagRow('Feedback Category',   d.Feedback_Category)}
        ${flagRow('Customer Objection',  d.CustomerObjectionCategory)}
        ${flagRow('Agent Rebuttal',      d.AgentRebuttalCategory)}
        ${flagRow('Opening',             d.Opening ? 'Done' : 'Missed', !d.Opening)}
        ${flagRow('Offer Pitched',       d.Offered  ? 'Done' : 'Missed', !d.Offered)}
        ${flagRow('Objection Handling',  d.ObjectionHandling ? 'Done' : 'Missed', !d.ObjectionHandling)}
        ${flagRow('Prepaid Pitch',       d.PrepaidPitch ? 'Done' : 'Missed', !d.PrepaidPitch)}
      </div>
    </div>`}
    ${d.transcript_text ? `
    <div class="card">
      <div class="chart-title">Transcript</div>
      <pre style="white-space:pre-wrap;font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.6">${d.transcript_text}</pre>
    </div>` : ''}`;
}
