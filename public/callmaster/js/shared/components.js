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
  return `<div class="preset-bar">
    ${['MTD','WTD','D1'].map(p => `<button class="preset-btn${p === activePreset ? ' active' : ''}" data-preset="${p}" onclick="${onChangeFn}('${p}')">${p}</button>`).join('')}
  </div>`;
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
