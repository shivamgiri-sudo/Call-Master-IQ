// public/callmaster/js/pages/ceo.js

const CEO_PAGES = {

  'ceo-scorecard': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/scorecard', { preset });
    const d = r.data;
    setTimeout(() => {
      lineChart('ceoScoreChart', [
        { name: 'Outbound', data: [72,74,78,79,77,80,79] },
        { name: 'Inbound',  data: [88,90,91,89,92,91,91] },
      ], ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], { targetLine: 85 });
    }, 0);
    return `
      ${pageHeader('Org Quality Scorecard', 'Cross-process quality intelligence')}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-scorecard")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Inbound CQ%',  d.inbound_score  ? d.inbound_score.toFixed(1)+'%'  : '—', 'GNC Inbound')}
        ${kpi('Outbound CQ%', d.outbound_score ? d.outbound_score.toFixed(1)+'%' : '—', 'Birlanu MCN')}
        ${kpi('Total Calls',  Number(d.total_calls).toLocaleString(), 'Inbound '+Number(d.inbound_calls).toLocaleString()+' · Outbound '+Number(d.outbound_calls).toLocaleString())}
        ${kpi('Critical Calls', Number(d.critical_calls).toLocaleString(), 'Critical + High severity', d.critical_calls > 50 ? 'down' : 'up')}
      </div>
      <div class="card">
        <div class="chart-title">7-Day Quality Trend</div>
        <div class="chart-wrap" id="ceoScoreChart"></div>
      </div>`;
  },

  'ceo-process-matrix': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/process-matrix', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Process Health Matrix', 'All active processes · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-process-matrix")')}
      </div>
      ${table(
        [
          { key: 'process_name',   label: 'Process' },
          { key: 'source_type',    label: 'Type',      render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'quality_score',  label: 'CQ%',        render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'total_calls',    label: 'Calls',      render: v => Number(v).toLocaleString() },
          { key: 'critical_count', label: 'Critical',   render: v => Number(v) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
          { key: 'high_risk_count',label: 'High Risk',  render: v => Number(v).toLocaleString() },
        ],
        rows,
        { emptyMsg: 'No process data for selected period' }
      )}`;
  },

  'ceo-branch-comparison': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/branch-comparison', { preset });
    const rows = r.data || [];
    setTimeout(() => {
      barChart('ceoBranchChart',
        [{ name: 'Quality Score', data: rows.map(r => r.quality_score) }],
        rows.map(r => r.branch),
        { yFormatter: v => v + '%' }
      );
    }, 0);
    return `
      ${pageHeader('Branch Comparison', preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-branch-comparison")')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="chart-title">Quality Score by Branch</div>
          <div class="chart-wrap" id="ceoBranchChart"></div>
        </div>
        <div class="card">
          ${table(
            [
              { key: 'branch',         label: 'Branch' },
              { key: 'quality_score',  label: 'CQ%',      render: v => v ? `<span class="td-mono">${v}%</span>` : '—' },
              { key: 'total_calls',    label: 'Calls',    render: v => Number(v).toLocaleString() },
              { key: 'critical_count', label: 'Critical', render: v => Number(v) > 0 ? `<span class="sev-critical">${v}</span>` : '0' },
            ],
            rows
          )}
        </div>
      </div>`;
  },

  'ceo-sla-overview': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/sla-overview', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('SLA Compliance', 'Audit coverage by process · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-sla-overview")')}
      </div>
      ${table(
        [
          { key: 'process_name', label: 'Process' },
          { key: 'source_type',  label: 'Type',      render: v => `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` },
          { key: 'total_calls',  label: 'Total Calls', render: v => Number(v).toLocaleString() },
          { key: 'sla_pct',      label: 'Audit SLA%',  render: v => v != null ? `${v}%` : '—' },
        ],
        rows
      )}`;
  },

  'ceo-risk-exposure': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/risk-exposure', { preset });
    const d = r.data || {};
    const breakdown = d.breakdown || [];
    const critical = breakdown.find(b => b.alert_severity === 'Critical');
    const high     = breakdown.find(b => b.alert_severity === 'High');
    const medium   = breakdown.find(b => b.alert_severity === 'Medium');
    setTimeout(() => {
      barChart('ceoRiskChart',
        [{ name: 'Count', data: breakdown.map(b => Number(b.count)) }],
        breakdown.map(b => b.alert_severity),
        { yFormatter: v => Number(v).toLocaleString() }
      );
    }, 0);
    return `
      ${pageHeader('Risk Exposure', 'High-risk call analysis · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-risk-exposure")')}
      </div>
      <div class="kpi-grid">
        ${kpi('Total Risk Calls', Number(d.total_risk || 0).toLocaleString(), 'Critical + High + Medium')}
        ${kpi('Critical', Number(critical?.count || 0).toLocaleString(), 'Data theft, fraud, collusion', 'down')}
        ${kpi('High',     Number(high?.count     || 0).toLocaleString(), 'Escalation, cuss, unprofessional')}
        ${kpi('Medium',   Number(medium?.count   || 0).toLocaleString(), 'Below target quality')}
      </div>
      <div class="card">
        <div class="chart-title">Risk Severity Breakdown</div>
        <div class="chart-wrap" id="ceoRiskChart"></div>
      </div>`;
  },

  'ceo-trend': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/trend', { preset });
    const rows = r.data || [];
    setTimeout(() => {
      if (rows.series) {
        // mock format: {categories, series}
        lineChart('ceoTrendChart', rows.series, rows.categories, { yFormatter: v => v + '%', targetLine: 85 });
      } else {
        // real format: array of {call_date, source_type, avg_score}
        const inbound  = rows.filter(r => r.source_type === 'Inbound');
        const outbound = rows.filter(r => r.source_type === 'Outbound');
        const cats = [...new Set(rows.map(r => r.call_date))].sort();
        lineChart('ceoTrendChart', [
          { name: 'Outbound', data: cats.map(d => { const f = outbound.find(r => r.call_date === d); return f ? Number(f.avg_score) : null; }) },
          { name: 'Inbound',  data: cats.map(d => { const f = inbound.find(r => r.call_date === d); return f ? Number(f.avg_score) : null; }) },
        ], cats, { yFormatter: v => v + '%', targetLine: 85 });
      }
    }, 0);
    return `
      ${pageHeader('Month Trend', '30-day quality score trend')}
      <div class="card">
        <div class="chart-title">Quality Score — Last 30 Days</div>
        <div class="chart-wrap" id="ceoTrendChart"></div>
      </div>`;
  },

  'ceo-alerts': async function(preset) {
    const r = await CALLMASTER_API.post('/api/callmaster/ceo/alerts', { preset });
    const rows = r.data || [];
    return `
      ${pageHeader('Critical Alerts', 'Critical + High severity calls · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        ${presetBar(preset, 'go.bind(null,"ceo-alerts")')}
      </div>
      ${table(
        [
          { key: 'source_call_id', label: 'Call ID',   render: v => `<span class="td-mono">${v}</span>` },
          { key: 'source_type',    label: 'Type' },
          { key: 'process_name',   label: 'Process' },
          { key: 'agent',          label: 'Agent' },
          { key: 'alert_severity', label: 'Severity',  render: v => sevBadge(v) },
          { key: 'call_date',      label: 'Date' },
        ],
        rows,
        { emptyMsg: 'No critical alerts in selected period' }
      )}`;
  },
};
