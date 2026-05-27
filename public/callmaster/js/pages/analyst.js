// public/callmaster/js/pages/analyst.js

const ANALYST_PAGES = {

  'analyst-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/overview', { preset });
    const d = r.data || {};

    // Handle both real API format and mock format defensively
    const score   = d.overall_score  ?? d.my_score  ?? 0;
    const total   = d.total_calls    ?? d.my_calls  ?? 0;
    const fatal   = d.fatal_count    ?? d.my_fatal  ?? 0;
    const target  = d.target_cq_pct ?? 95;
    const trendDir = Number(score) >= Number(target) ? 'up' : 'down';

    // Process breakdown table — real API returns processes array
    const processes = Array.isArray(d.processes) ? d.processes : [];

    return `
      ${pageHeader('My Score Overview', 'Your personal quality metrics · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"analyst-overview")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Overall CQ%',    Number(score).toFixed(1) + '%', 'Target ' + target + '%', trendDir)}
        ${kpi('Total Calls',    Number(total).toLocaleString(), 'Calls evaluated')}
        ${kpi('Fatal Count',    Number(fatal).toLocaleString(), 'Fatal defects', fatal > 0 ? 'down' : 'up')}
      </div>
      ${processes.length > 0 ? `
        <div class="card" style="margin-bottom:16px">
          <div class="chart-title">Process Breakdown</div>
          ${table(
            [
              { key: 'process_name', label: 'Process' },
              { key: 'source_type',  label: 'Type',       render: v => v ? `<span class="badge badge-${v === 'Inbound' ? 'blue' : 'violet'}">${v}</span>` : '—' },
              { key: 'total_calls',  label: 'Calls',      render: v => Number(v || 0).toLocaleString() },
              { key: 'avg_score',    label: 'Avg CQ%',    render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}%</span>` : '—' },
              { key: 'fatal_count',  label: 'Fatals',     render: v => Number(v) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
            ],
            processes,
            { emptyMsg: 'No process data available' }
          )}
        </div>
      ` : ''}`;
  },

  'analyst-defects': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/defects', { preset });
    const d = r.data || {};

    // Handle both real API (flat array) and mock ({ params: [...] })
    const raw    = Array.isArray(d) ? d : (d.params || []);
    const params = [...raw].sort((a, b) => (b.lost_marks || 0) - (a.lost_marks || 0));

    function fmtParam(name) {
      if (!name) return '—';
      return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    setTimeout(() => {
      if (params.length > 0) {
        barChart(
          'analystDefectChart',
          [{ name: 'Lost Marks', data: params.map(p => Number(p.lost_marks || 0)) }],
          params.map(p => fmtParam(p.param)),
          { horizontal: true, yFormatter: v => Number(v).toFixed(1) }
        );
      }
    }, 0);

    return `
      ${pageHeader('My Defect Breakdown', 'Parameters sorted by lost marks · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"analyst-defects")')}
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Lost Marks by Parameter</div>
        <div class="chart-wrap" id="analystDefectChart"></div>
      </div>
      ${params.length === 0 ? emptyState('No defect data for selected period') : table(
        [
          { key: 'param',       label: 'Parameter',  render: v => fmtParam(v) },
          { key: 'lost_marks',  label: 'Lost Marks', render: v => v != null ? `<span class="td-mono">${Number(v).toFixed(1)}</span>` : '—' },
        ],
        params,
        { emptyMsg: 'No defect data for selected period' }
      )}`;
  },

  'analyst-calls': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/my-calls', { preset });
    const d = r.data || {};

    // Handle both real API { total, calls: [...] } and mock { total, calls: [...] }
    const calls = Array.isArray(d.calls) ? d.calls : (Array.isArray(d) ? d : []);
    const total = d.total ?? calls.length;

    return `
      ${pageHeader('My Calls', total + ' calls in selected period · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"analyst-calls")')}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Calls', Number(total).toLocaleString(), 'Evaluated calls in period')}
      </div>
      ${table(
        [
          { key: 'id',             label: 'Call ID',   render: v => `<span class="td-mono">${v || '—'}</span>` },
          { key: 'source_type',    label: 'Type',      render: v => v ? `<span class="badge badge-${v === 'Inbound' ? 'blue' : 'violet'}">${v}</span>` : '—' },
          { key: 'process_name',   label: 'Process' },
          { key: 'call_date',      label: 'Date',      render: (v, row) => { const dt = v || row.date; return dt ? new Date(dt).toLocaleDateString() : '—'; } },
          { key: 'quality_score',  label: 'CQ%',       render: (v, row) => { const s = v ?? row.score; return s != null ? `<span class="td-mono">${Number(s).toFixed(1)}%</span>` : '—'; } },
          { key: 'quality_band',   label: 'Band',      render: (v, row) => bandBadge(v || row.band) },
          { key: 'alert_severity', label: 'Severity',  render: (v, row) => sevBadge(v || row.severity) },
        ],
        calls,
        { emptyMsg: 'No calls found for selected period' }
      )}`;
  },

  'analyst-evidence': function() {
    return `
      ${pageHeader('Evidence Review', 'Call-level detail')}
      ${emptyState('Click a call from My Calls to view its detail evidence.')}`;
  },

  'analyst-trend': async function() {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/trend', {});
    const d = r.data || {};

    // Real API: flat array [{call_date, avg_score}]
    // Mock: { categories: [...], series: [{data:[...]}] }
    const rows       = Array.isArray(d) ? d : [];
    const seriesData = rows.length ? rows.map(row => Number(row.avg_score || 0)) : (d.series?.[0]?.data || []);
    const cats       = rows.length ? rows.map(row => row.call_date) : (d.categories || []);

    setTimeout(() => {
      lineChart(
        'analystTrendChart',
        [{ name: 'My CQ%', data: seriesData }],
        cats,
        { yFormatter: v => v + '%', targetLine: 95 }
      );
    }, 0);

    return `
      ${pageHeader('Score Trend', 'Your CQ% over the last 30 days')}
      <div class="card">
        <div class="chart-title">My CQ% — Last 30 Days</div>
        <div class="chart-wrap" id="analystTrendChart"></div>
      </div>`;
  },

  'analyst-coaching': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/analyst/coaching');
    const d = r.data || {};

    // Real API: flat array, mock: { sessions: [...] }
    const sessions = Array.isArray(d) ? d : (d.sessions || []);

    function statusBadgeClass(status) {
      const s = (status || '').toLowerCase();
      if (s === 'completed' || s === 'closed') return 'badge-green';
      if (s === 'open' || s === 'pending')     return 'badge-yellow';
      return 'badge-gray';
    }

    function priorityBadgeClass(priority) {
      const p = (priority || '').toLowerCase();
      if (p === 'high')   return 'badge-red';
      if (p === 'medium') return 'badge-yellow';
      return 'badge-gray';
    }

    if (sessions.length === 0) {
      return `
        ${pageHeader('Coaching Notes', 'Your personal coaching sessions')}
        ${emptyState('No coaching sessions found.')}`;
    }

    const cards = sessions.map(s => {
      const title   = s.title || s.coaching_title || 'Coaching Session';
      const status  = s.status  || 'Open';
      const notes   = s.notes   || '—';
      const coach   = s.coach   || s.coach_name || '—';
      const date    = s.created_at || s.date ? new Date(s.created_at || s.date).toLocaleDateString() : '—';
      const priority = s.priority || '';

      return `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div style="font-weight:600;font-size:14px;color:#e2e8f0">${title}</div>
          <div style="display:flex;gap:6px;align-items:center">
            ${priority ? `<span class="badge ${priorityBadgeClass(priority)}">${priority}</span>` : ''}
            <span class="badge ${statusBadgeClass(status)}">${status}</span>
          </div>
        </div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:12px;line-height:1.5">${notes}</div>
        <div style="font-size:12px;color:#64748b;display:flex;gap:16px">
          <span>Coach: <strong style="color:#94a3b8">${coach}</strong></span>
          <span>Date: <strong style="color:#94a3b8">${date}</strong></span>
        </div>
      </div>`;
    }).join('');

    return `
      ${pageHeader('Coaching Notes', sessions.length + ' coaching session' + (sessions.length !== 1 ? 's' : ''))}
      ${cards}`;
  },
};
