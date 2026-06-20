// public/callmaster/js/shared/components.js

// ── KPI card ──
function kpi(label, value, sub = '', trendDir = '') {
  const trendClass = trendDir === 'up' ? 'kpi-trend-up' : trendDir === 'down' ? 'kpi-trend-down' : '';
  return `<div class="kpi-card">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value ${trendClass}">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`;
}

// ── Data table ──
// cols: [{key, label, render?}]
// rows: array of objects
function table(cols, rows, { emptyMsg = 'No data', onRowClick } = {}) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">${emptyMsg}</div></div>`;
  }
  const thead = cols.map(c => `<th>${c.label}</th>`).join('');
  const tbody = rows.map(r => {
    const cells = cols.map(c => {
      const val = c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—');
      return `<td>${val}</td>`;
    }).join('');
    const clickAttr = onRowClick ? `style="cursor:pointer" onclick="(${onRowClick.toString()})(${JSON.stringify(r)})"` : '';
    return `<tr ${clickAttr}>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

// ── Quality band badge ──
function bandBadge(band) {
  const map = {
    'Excellent': 'badge badge-green',
    'Good':      'badge badge-tq',
    'Average':   'badge badge-yellow',
    'Below Average': 'badge badge-red',
  };
  return `<span class="${map[band] || 'badge badge-gray'}">${band || '—'}</span>`;
}

// ── Severity badge ──
function sevBadge(sev) {
  const map = {
    'Critical': 'sev-critical',
    'High':     'sev-high',
    'Medium':   'sev-medium',
    'Normal':   'sev-normal',
  };
  return `<span class="${map[sev] || 'sev-normal'}">${sev || 'Normal'}</span>`;
}

// ── TQ/MQ/BQ badge ──
function classificationBadge(cls) {
  const map = { 'TQ': 'badge-tq', 'MQ': 'badge-blue', 'BQ': 'badge-red' };
  return `<span class="badge ${map[cls] || 'badge-gray'}">${cls || '—'}</span>`;
}

// ── Skeleton loaders ──
function skeleton() {
  return `<div class="kpi-grid">
    ${Array(4).fill('<div class="skeleton skeleton-kpi"></div>').join('')}
  </div>
  <div class="skeleton skeleton-chart" style="margin-bottom:16px"></div>
  <div class="skeleton skeleton-chart"></div>`;
}

function skeletonLines(n = 5) {
  return Array(n).fill('<div class="skeleton skeleton-line"></div>').join('');
}

// ── Empty state ──
function emptyState(msg = 'No data available') {
  return `<div class="empty-state">
    <div class="empty-state-icon">📭</div>
    <div class="empty-state-text">${msg}</div>
  </div>`;
}

// ── Toast ──
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Drawer ──
function openDrawer(titleHtml, bodyHtml) {
  const root = document.getElementById('drawerRoot');
  root.querySelector('.drawer-title').innerHTML = titleHtml;
  root.querySelector('.drawer-body').innerHTML = bodyHtml;
  root.classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawerRoot').classList.remove('open');
}

// ── Preset bar ──
function presetBar(activePreset, onChangeFn) {
  const isCustom = activePreset === 'custom';
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const startVal  = (typeof state !== 'undefined' && state.startDate) || monthStart;
  const endVal    = (typeof state !== 'undefined' && state.endDate)   || today;
  const customLabel = isCustom
    ? `${startVal} → ${endVal}`
    : 'Custom';
  return `<div class="preset-bar" style="align-items:center;flex-wrap:wrap;gap:6px">
    ${['MTD','WTD','D1'].map(p => `<button class="preset-btn${p === activePreset ? ' active' : ''}" data-preset="${p}" onclick="${onChangeFn}('${p}')">${p}</button>`).join('')}
    <button class="preset-btn${isCustom ? ' active' : ''}" onclick="toggleCustomRange(this)" style="position:relative">${customLabel}</button>
    <span id="customRangeForm" style="display:${isCustom ? 'inline-flex' : 'none'};align-items:center;gap:6px;flex-wrap:wrap">
      <input type="date" id="customStart" value="${startVal}" max="${today}"
        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:4px 8px;color:#e2e8f0;font-size:12px" />
      <span style="color:#64748b;font-size:12px">to</span>
      <input type="date" id="customEnd" value="${endVal}" max="${today}"
        style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:4px 8px;color:#e2e8f0;font-size:12px" />
      <button onclick="applyCustomRange(${onChangeFn})"
        style="background:#2563eb;border:none;border-radius:6px;padding:4px 12px;color:#fff;font-size:12px;cursor:pointer;font-weight:600">Apply</button>
    </span>
  </div>`;
}

function toggleCustomRange(btn) {
  const form = document.getElementById('customRangeForm');
  if (form) form.style.display = form.style.display === 'none' ? 'inline-flex' : 'none';
}

function applyCustomRange(onChangeFn) {
  const start = document.getElementById('customStart')?.value;
  const end   = document.getElementById('customEnd')?.value;
  if (!start || !end) { alert('Please select both start and end dates.'); return; }
  if (start > end) { alert('Start date must be before end date.'); return; }
  if (typeof state !== 'undefined') {
    state.startDate = start;
    state.endDate   = end;
  }
  if (typeof onChangeFn === 'function') onChangeFn('custom');
}

// ── Page header ──
function pageHeader(title, sub = '') {
  return `<div class="page-header">
    <div>
      <div class="page-title">${title}</div>
      ${sub ? `<div class="page-sub">${sub}</div>` : ''}
    </div>
  </div>`;
}

// ── CSV export from table data (client-side) ──
// cols: same [{key, label}] array as table()
// rows: same array of objects
function exportTableCsv(cols, rows, filename) {
  if (!rows || !rows.length) { toast('No data to export', 'warn'); return; }
  const headers = cols.map(c => c.label).join(',');
  const lines = rows.map(r =>
    cols.map(c => {
      const v = r[c.key];
      if (v == null) return '';
      const s = String(v).replace(/<[^>]*>/g, '').replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(',')
  );
  const csv = [headers, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename || 'export.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

// ── Download a CSV from a backend GET endpoint ──
function downloadCsv(path, filename) {
  if (typeof USE_MOCK_DATA !== 'undefined' && USE_MOCK_DATA) {
    toast('Full export requires live server (disable mock mode)', 'info');
    return;
  }
  const token = CALLMASTER_API._token;
  fetch(path, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
    .then(res => {
      if (!res.ok) throw new Error('Export failed (' + res.status + ')');
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = filename || 'export.csv';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    })
    .catch(e => toast(e.message, 'error'));
}

// ── Export button HTML ──
function exportBtn(label, onclick) {
  return `<button onclick="${onclick}" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap">⬇ ${label}</button>`;
}
