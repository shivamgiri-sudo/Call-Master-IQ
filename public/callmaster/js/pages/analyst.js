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
    const page     = state.explorerPage   || 1;
    const search   = state.explorerSearch || '';
    const pageSize = 20;
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/my-calls', { preset, page, pageSize, search });
    const d = r.data || {};

    // Handle both real API { total, calls: [...] } and mock { total, calls: [...] }
    const calls = Array.isArray(d.calls) ? d.calls : (Array.isArray(d) ? d : []);
    const total = d.total ?? calls.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const exportCols = [
      { key: 'id', label: 'Call ID' }, { key: 'source_type', label: 'Type' },
      { key: 'process_name', label: 'Process' }, { key: 'call_date', label: 'Date' },
      { key: 'quality_score', label: 'CQ%' }, { key: 'quality_band', label: 'Band' },
      { key: 'alert_severity', label: 'Severity' },
    ];

    return `
      ${pageHeader('My Calls', total + ' calls in selected period · ' + preset)}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${presetBar(preset, 'go.bind(null,"analyst-calls")')}
        ${exportBtn('Export CSV', `exportTableCsv(${JSON.stringify(exportCols)}, ${JSON.stringify(calls)}, 'my_calls_${preset}_p${page}.csv')`)}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <input id="explorerSearchInput" type="text" value="${search.replace(/"/g,'&quot;')}"
          placeholder="Search call ID, process..."
          style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:7px 12px;color:#e2e8f0;font-size:13px;min-width:220px"
          onkeydown="if(event.key==='Enter'){state.explorerSearch=this.value;state.explorerPage=1;go('analyst-calls')}" />
        <button onclick="state.explorerSearch=document.getElementById('explorerSearchInput').value;state.explorerPage=1;go('analyst-calls')"
          style="background:#2563eb;border:none;border-radius:6px;padding:7px 14px;color:#fff;font-size:13px;cursor:pointer">Search</button>
        ${search ? `<button onclick="state.explorerSearch='';state.explorerPage=1;go('analyst-calls')" style="background:#334155;border:none;border-radius:6px;padding:7px 12px;color:#94a3b8;font-size:13px;cursor:pointer">Clear</button>` : ''}
      </div>
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Calls', Number(total).toLocaleString(), 'Evaluated calls in period')}
        ${kpi('Page', page + ' / ' + totalPages, pageSize + ' per page')}
      </div>
      ${table(
        [
          { key: 'id', label: 'Call ID', render: (v, row) => v ? `<a href="#" onclick="event.preventDefault();window._analystCallId='${String(v).replace(/'/g,"\\'")}';window._analystSourceType='${String((row&&row.source_type)||'Inbound').replace(/'/g,"\\'")}';go('analyst-evidence')" style="color:#60a5fa;font-family:monospace;text-decoration:none">${v}</a>` : '—' },
          { key: 'source_type',    label: 'Type',      render: v => v ? `<span class="badge badge-${v === 'Inbound' ? 'blue' : 'violet'}">${v}</span>` : '—' },
          { key: 'process_name',   label: 'Process' },
          { key: 'call_date',      label: 'Date',      render: (v, row) => { const dt = v || row.date; return dt ? new Date(dt).toLocaleDateString() : '—'; } },
          { key: 'quality_score',  label: 'CQ%',       render: (v, row) => { const s = v ?? row.score; return s != null ? `<span class="td-mono">${Number(s).toFixed(1)}%</span>` : '—'; } },
          { key: 'quality_band',   label: 'Band',      render: (v, row) => bandBadge(v || row.band) },
          { key: 'alert_severity', label: 'Severity',  render: (v, row) => sevBadge(v || row.severity) },
          { key: '_dispute', label: '', render: (_, row) =>
              `<button class="badge badge-yellow" style="cursor:pointer;border:none;padding:4px 10px"
                onclick="openDisputeModal('${String(row.id || row.source_call_id).replace(/'/g,"\\'")}','${(row.source_type||'Inbound').replace(/'/g,"\\'")}')">Dispute</button>`
          },
        ],
        calls,
        { emptyMsg: 'No calls found for selected period' }
      )}
      <div style="display:flex;align-items:center;gap:8px;margin-top:16px;justify-content:flex-end">
        <span style="font-size:13px;color:#64748b">${Number(total).toLocaleString()} calls · Page ${page} of ${totalPages}</span>
        ${page > 1 ? `<button onclick="state.explorerPage=${page-1};go('analyst-calls')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">&#8592; Prev</button>` : ''}
        ${page < totalPages ? `<button onclick="state.explorerPage=${page+1};go('analyst-calls')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">Next &#8594;</button>` : ''}
      </div>
      <div id="disputeModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;align-items:center;justify-content:center">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;width:480px;max-width:90vw">
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:#f1f5f9">Dispute Call Score</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:16px" id="disputeCallId"></div>
          <div style="margin-bottom:12px">
            <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Reason for Dispute *</label>
            <textarea id="disputeFeedbackText" rows="4" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px;color:#f1f5f9;font-size:13px;resize:vertical" placeholder="Describe why you are disputing this score..."></textarea>
          </div>
          <div style="margin-bottom:20px">
            <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:4px">Evidence Notes (optional)</label>
            <textarea id="disputeEvidenceNotes" rows="3" style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px;color:#f1f5f9;font-size:13px;resize:vertical" placeholder="Any additional evidence or notes..."></textarea>
          </div>
          <div id="disputeError" style="color:#f87171;font-size:12px;margin-bottom:12px;display:none"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button onclick="closeDisputeModal()" style="background:#334155;border:none;border-radius:6px;padding:8px 16px;color:#94a3b8;cursor:pointer">Cancel</button>
            <button onclick="submitDispute()" style="background:#2563eb;border:none;border-radius:6px;padding:8px 16px;color:#fff;cursor:pointer;font-weight:600">Submit Dispute</button>
          </div>
        </div>
      </div>`;
  },

  'analyst-evidence': async function(preset) {
    const callId    = window._analystCallId    || null;
    const sourceType = window._analystSourceType || 'Inbound';

    if (!callId) {
      return `
        ${pageHeader('Call Intelligence 360', 'Select a call to review')}
        ${emptyState('Click any Call ID in My Calls to view the full intelligence report.')}`;
    }

    const r = await CALLMASTER_API.get(`/api/callmaster/analyst/call/${callId}?sourceType=${encodeURIComponent(sourceType)}`);
    const d = r.data;

    if (!d) {
      return `
        ${pageHeader('Call Intelligence 360', 'Call not found')}
        ${emptyState('No data found for this call ID.')}`;
    }

    const isInbound = (d.source_type || sourceType) === 'Inbound';

    function flagBadge(val, label) {
      const v = String(val || '').toLowerCase().trim();
      const isYes = v === 'yes' || v === '1' || v === 'true';
      return isYes
        ? `<span class="badge badge-red" style="margin-right:4px">${label}</span>`
        : `<span class="badge badge-gray" style="margin-right:4px">${label}: No</span>`;
    }

    function yesNoBadge(val, label) {
      const v = String(val || '').toLowerCase().trim();
      const isYes = v === 'yes' || v === '1' || v === 'true';
      return `<span class="badge ${isYes ? 'badge-green' : 'badge-red'}" style="margin-right:4px">${label}: ${isYes ? 'Yes' : 'No'}</span>`;
    }

    const scoreColor = d.quality_score != null
      ? (Number(d.quality_score) >= 90 ? '#22c55e' : Number(d.quality_score) >= 85 ? '#f59e0b' : '#ef4444')
      : '#94a3b8';

    const callMeta = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">CALL ID</div>
            <div style="font-size:18px;font-weight:700;color:#e2e8f0;font-family:monospace">${d.source_call_id || callId}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">AGENT</div>
            <div style="font-size:15px;font-weight:600;color:#e2e8f0">${d.agent_employee_name || '—'}</div>
            <div style="font-size:12px;color:#64748b">${d.agent_employee_code || '—'}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">PROCESS</div>
            <div style="font-size:14px;color:#e2e8f0">${d.process_name || '—'}</div>
            <div style="font-size:12px;color:#64748b">${d.branch_short_name || '—'}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">DATE</div>
            <div style="font-size:14px;color:#e2e8f0">${d.call_datetime ? new Date(d.call_datetime).toLocaleString() : '—'}</div>
            <div style="font-size:12px;color:#64748b">${d.length_in_sec ? Math.floor(d.length_in_sec / 60) + 'm ' + (d.length_in_sec % 60) + 's' : '—'}</div>
          </div>
          ${d.quality_score != null ? `
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:4px">QUALITY</div>
            <div style="font-size:24px;font-weight:700;color:${scoreColor}">${Number(d.quality_score).toFixed(1)}%</div>
            <div style="font-size:12px;color:#64748b">${d.total_score ?? '—'} / ${d.max_score ?? '—'}</div>
          </div>` : ''}
        </div>
      </div>`;

    const inboundSection = isInbound ? `
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Risk &amp; Compliance Flags</div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">
          ${flagBadge(d.data_theft_or_misuse,        'Data Theft')}
          ${flagBadge(d.financial_fraud,              'Financial Fraud')}
          ${flagBadge(d.escalation_failure,           'Escalation Failure')}
          ${flagBadge(d.unprofessional_behavior,      'Unprofessional')}
          ${flagBadge(d.system_manipulation,          'System Manipulation')}
          ${flagBadge(d.collusion,                    'Collusion')}
          ${flagBadge(d.policy_communication_failure, 'Policy Failure')}
        </div>
        ${d.overall_fraud_risk_score != null ? `<div style="margin-top:12px;font-size:13px;color:#94a3b8">Fraud Risk Score: <strong style="color:#f59e0b">${d.overall_fraud_risk_score}</strong></div>` : ''}
      </div>` : '';

    const outboundSection = !isInbound ? `
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Sales &amp; Call Intelligence</div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">
          ${yesNoBadge(d.Opening,           'Opening')}
          ${yesNoBadge(d.Offered,           'Offered')}
          ${yesNoBadge(d.ObjectionHandling, 'Objection Handled')}
          ${yesNoBadge(d.PrepaidPitch,      'Prepaid Pitch')}
          ${yesNoBadge(d.SaleDone,          'Sale Done')}
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
          ${d.UpsellingEfforts     ? `<div style="font-size:13px;color:#94a3b8">Upselling: <strong style="color:#e2e8f0">${d.UpsellingEfforts}</strong></div>` : ''}
          ${d.CallDisposition      ? `<div style="font-size:13px;color:#94a3b8">Disposition: <strong style="color:#e2e8f0">${d.CallDisposition}</strong></div>` : ''}
          ${d.Feedback_Category    ? `<div style="font-size:13px;color:#94a3b8">Quality Score: <strong style="color:#e2e8f0">${d.Feedback_Category}</strong></div>` : ''}
          ${d.CustomerObjectionCategory ? `<div style="font-size:13px;color:#94a3b8">Customer Objection: <strong style="color:#e2e8f0">${d.CustomerObjectionCategory}</strong></div>` : ''}
          ${d.AgentRebuttalCategory     ? `<div style="font-size:13px;color:#94a3b8">Agent Rebuttal: <strong style="color:#e2e8f0">${d.AgentRebuttalCategory}</strong></div>` : ''}
        </div>
      </div>` : '';

    const improvSection = d.areas_for_improvement ? `
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Areas for Improvement</div>
        <div style="margin-top:8px;font-size:13px;color:#94a3b8;line-height:1.6">${String(d.areas_for_improvement).replace(/\n/g, '<br>')}</div>
      </div>` : '';

    const transcriptSection = d.transcript_text ? `
      <div class="card" style="margin-bottom:16px">
        <div class="chart-title">Call Transcript</div>
        <div style="margin-top:12px;font-size:13px;color:#94a3b8;line-height:1.7;white-space:pre-wrap;max-height:400px;overflow-y:auto;background:#0f172a;padding:16px;border-radius:8px;font-family:monospace">${String(d.transcript_text).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>` : '';

    return `
      ${pageHeader('Call Intelligence 360', (d.source_type || sourceType) + ' · ' + (d.process_name || ''))}
      <div style="margin-bottom:16px">
        <button onclick="go('analyst-calls')" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">&#8592; Back to My Calls</button>
      </div>
      ${callMeta}
      ${inboundSection}
      ${outboundSection}
      ${improvSection}
      ${transcriptSection}`;
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

  'analyst-coaching': async function(preset) {
    const r = await CALLMASTER_API.get('/api/callmaster/analyst/coaching-assignments');
    const d = r.data || {};
    const items = Array.isArray(d) ? d : (d.data || []);
    return `
      ${pageHeader('My Coaching', items.length + ' assigned modules')}
      ${items.length === 0 ? emptyState('No coaching assignments yet') : table(
        [
          { key: 'coaching_title',     label: 'Title' },
          { key: 'defect_parameter',   label: 'Defect Area' },
          { key: 'coaching_body',      label: 'Content',       render: v => v ? `<span style="max-width:300px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${String(v).replace(/"/g,'&quot;')}">${v}</span>` : '—' },
          { key: 'completion_status',  label: 'Status',        render: v => `<span class="badge badge-${v==='completed'?'green':v==='viewed'?'blue':'yellow'}">${v||'pending'}</span>` },
          { key: '_actions',           label: '',              render: (_, row) => row.completion_status !== 'completed' ? `<button class="badge badge-blue" style="cursor:pointer;border:none;padding:4px 10px" onclick="markCoaching(${row.assignment_id},'${row.completion_status==='pending'?'viewed':'completed'}')">Mark ${row.completion_status==='pending'?'Viewed':'Complete'}</button>` : '' },
        ],
        items
      )}`;
  },
};

async function markCoaching(assignmentId, status) {
  const r = await CALLMASTER_API.request('/api/callmaster/analyst/coaching-assignments/' + assignmentId + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (r.success) go('analyst-coaching');
}

function openDisputeModal(callId, sourceType) {
  window._disputeCallId = callId;
  window._disputeSourceType = sourceType;
  document.getElementById('disputeCallId').textContent = 'Call: ' + callId + ' (' + sourceType + ')';
  document.getElementById('disputeFeedbackText').value = '';
  document.getElementById('disputeEvidenceNotes').value = '';
  document.getElementById('disputeError').style.display = 'none';
  const m = document.getElementById('disputeModal');
  m.style.display = 'flex';
}

function closeDisputeModal() {
  document.getElementById('disputeModal').style.display = 'none';
}

async function submitDispute() {
  const feedbackText = document.getElementById('disputeFeedbackText').value.trim();
  const evidenceNotes = document.getElementById('disputeEvidenceNotes').value.trim();
  const errEl = document.getElementById('disputeError');
  if (!feedbackText) { errEl.textContent = 'Reason for dispute is required.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  try {
    const r = await CALLMASTER_API.post('/api/callmaster/analyst/feedback', {
      sourceCallId: window._disputeCallId,
      sourceType: window._disputeSourceType,
      feedbackText,
      evidenceNotes,
    });
    if (r.success) {
      closeDisputeModal();
      alert('Dispute submitted successfully.');
    } else {
      errEl.textContent = r.error || 'Failed to submit dispute.';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.style.display = 'block';
  }
}
