// public/callmaster/js/app.js

// ── API client ──
const CALLMASTER_API = {
  _token: null,
  setToken(t) { this._token = t; },
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    const res = await fetch(path, { headers, ...options });
    if (res.status === 401) { doLogout(); return { success: false }; }
    return res.json();
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  get(path) {
    return this.request(path);
  },
};

// ── State ──
const state = {
  page: null,
  preset: 'MTD',
  user: null,
};

// ── JWT helpers ──
function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  } catch { return null; }
}

// ── Nav definitions per role ──
const NAV_CONFIG = {
  admin: [
    { label: 'User Management',   page: 'admin-users',             icon: '👥' },
    { label: 'Employees',         page: 'admin-employees',         icon: '🧑‍💼' },
    { label: 'Agent Aliases',     page: 'admin-aliases',           icon: '🔗' },
    { label: 'Process Config',    page: 'admin-processes',         icon: '⚙️' },
    { label: 'Exclusion Rules',   page: 'admin-exclusions',        icon: '🚫' },
    { label: 'Coaching Queue',    page: 'admin-coaching',          icon: '🎓' },
    { label: 'Calibration',       page: 'admin-calibration',       icon: '🎯' },
    { label: 'Audit Config',      page: 'admin-audit-config',      icon: '📋' },
    { label: 'Data Sources',      page: 'admin-data-sources',      icon: '🗄️' },
    { label: 'Impersonate',       page: 'admin-impersonate',       icon: '🎭' },
    { label: 'System Health',     page: 'admin-health',            icon: '💚' },
  ],
  ceo: [
    { label: 'Org Scorecard',     page: 'ceo-scorecard',       icon: '🏆' },
    { label: 'Process Matrix',    page: 'ceo-process-matrix',  icon: '📊' },
    { label: 'Branch Comparison', page: 'ceo-branch-comparison',icon: '🏢' },
    { label: 'SLA Compliance',    page: 'ceo-sla-overview',    icon: '⏱️' },
    { label: 'Risk Exposure',     page: 'ceo-risk-exposure',   icon: '🚨' },
    { label: 'Month Trend',       page: 'ceo-trend',           icon: '📈' },
    { label: 'Critical Alerts',   page: 'ceo-alerts',          icon: '🔔' },
  ],
  tq_head: [
    { label: 'Quality Deep-Dive', page: 'tq-quality-deepdive', icon: '🔬' },
    { label: 'TNI Heatmap',       page: 'tq-tni-heatmap',      icon: '🌡️' },
    { label: 'Analyst Leaderboard',page: 'tq-leaderboard',     icon: '🥇' },
    { label: 'Coaching Queue',    page: 'tq-coaching-queue',   icon: '🎓' },
    { label: 'Calibration',       page: 'tq-calibration',      icon: '⚖️' },
    { label: 'Audit Efficiency',  page: 'tq-audit-efficiency', icon: '📌' },
    { label: 'Parameter Drift',   page: 'tq-parameter-drift',  icon: '📉' },
    { label: 'SLA Tracker',       page: 'tq-sla-tracker',      icon: '✅' },
  ],
  branch_manager: [
    { label: 'Branch Health',     page: 'bm-health',            icon: '💪' },
    { label: 'Process Breakdown', page: 'bm-process-breakdown', icon: '📊' },
    { label: 'Team Performance',  page: 'bm-team-performance',  icon: '👥' },
    { label: 'Daily SLA',         page: 'bm-daily-sla',         icon: '⏱️' },
    { label: 'Risk Calls',        page: 'bm-risk-calls',        icon: '🚨' },
    { label: 'Action Items',      page: 'bm-action-items',      icon: '✅' },
  ],
  process_manager: [
    { label: 'Process Overview',  page: 'pm-overview',          icon: '📊' },
    { label: 'Parameters',        page: 'pm-parameters',        icon: '📋' },
    { label: 'Call Explorer',     page: 'pm-explorer',          icon: '🔍' },
    { label: 'Analyst Scorecard', page: 'pm-analyst-scorecard', icon: '🥇' },
    { label: 'TNI Report',        page: 'pm-tni',               icon: '🌡️' },
    { label: 'Daily Trends',      page: 'pm-trends',            icon: '📈' },
    { label: 'Evidence Viewer',   page: 'pm-evidence',          icon: '🎧' },
    { label: 'Defect Analysis',   page: 'pm-defect-analysis',   icon: '🔎' },
    { label: '── Inbound ──',     page: null,                   icon: '' },
    { label: 'Fatal Analysis',    page: 'pm-fatal-analysis',    icon: '⚠️' },
    { label: 'Scenario Breakdown',page: 'pm-scenario',          icon: '📂' },
    { label: 'Detail Analysis',   page: 'pm-detail-analysis',   icon: '📑' },
    { label: 'Escalation',        page: 'pm-escalation',        icon: '🔥' },
    { label: '── Outbound ──',    page: null,                   icon: '' },
    { label: 'CST/CRT Funnel',    page: 'pm-cst-crt',           icon: '🔽' },
    { label: 'Missed Opportunity',page: 'pm-missed-opp',        icon: '💸' },
    { label: 'NPS & CSAT',        page: 'pm-nps-csat',          icon: '😊' },
    { label: 'Pitch Stage',       page: 'pm-pitch-stage',       icon: '🎯' },
    { label: 'Objection Rebuttal',page: 'pm-objection-rebuttal',icon: '🥊' },
  ],
  analyst: [
    { label: 'My Score',          page: 'analyst-overview',  icon: '⭐' },
    { label: 'My Defects',        page: 'analyst-defects',   icon: '📉' },
    { label: 'My Calls',          page: 'analyst-calls',     icon: '📞' },
    { label: 'Evidence Review',   page: 'analyst-evidence',  icon: '🎧' },
    { label: 'Score Trend',       page: 'analyst-trend',     icon: '📈' },
    { label: 'Coaching',          page: 'analyst-coaching',  icon: '🎓' },
  ],
};

// ── Page registry — maps page key → render function ──
function getPageFn(page) {
  return CEO_PAGES[page] || TQ_PAGES[page] || PM_PAGES[page] ||
         BM_PAGES[page]  || ANALYST_PAGES[page] || ADMIN_PAGES[page] || null;
}

// ── Router ──
function go(page, preset) {
  if (!state.user) return;
  if (preset) state.preset = preset;
  state.page = page;

  destroyAllCharts();

  const fn = getPageFn(page);
  const pc = document.getElementById('pageContent');
  if (!fn) {
    pc.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-text">Page not found: ${page}</div></div>`;
    return;
  }

  // Show skeleton while loading
  pc.innerHTML = skeleton();

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Render the page (fn may be async)
  Promise.resolve(fn(state.preset)).then(html => {
    if (state.page === page) {  // guard against race conditions
      pc.innerHTML = html;
    }
  }).catch(err => {
    pc.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${err.message}</div></div>`;
  });
}

// ── Sidebar builder ──
function buildNav(role) {
  const items = NAV_CONFIG[role] || [];
  const container = document.getElementById('navLinks');
  container.innerHTML = items.map(item => {
    if (!item.page) {
      return `<div class="nav-section-label">${item.label}</div>`;
    }
    return `<div class="nav-item" data-page="${item.page}" onclick="go('${item.page}')">
      <span class="nav-icon">${item.icon}</span>
      <span>${item.label}</span>
    </div>`;
  }).join('');
}

// ── Login / logout ──
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');

  if (!username || !password) { errEl.textContent = 'Please enter username and password'; return; }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.textContent = '';

  try {
    let result;
    if (typeof USE_MOCK_DATA !== 'undefined' && USE_MOCK_DATA) {
      // Mock login: any password works for demo users
      const mockUsers = {
        'admin':    { role: 'admin',           branch_ids: ['*'], process_ids: ['*'] },
        'ceo':      { role: 'ceo',             branch_ids: ['*'], process_ids: ['*'] },
        'tq':       { role: 'tq_head',         branch_ids: ['*'], process_ids: ['*'] },
        'bm':       { role: 'branch_manager',  branch_ids: ['Delhi NCR'], process_ids: ['*'] },
        'pm':       { role: 'process_manager', branch_ids: ['*'], process_ids: ['GNC Inbound'] },
        'analyst':  { role: 'analyst',         branch_ids: ['Delhi NCR'], process_ids: ['GNC Inbound'], employee_code: 'EMP001' },
      };
      const u = mockUsers[username.toLowerCase()];
      if (!u) { errEl.textContent = 'Mock users: admin, ceo, tq, bm, pm, analyst'; btn.disabled = false; btn.textContent = 'Sign In'; return; }
      result = { success: true, token: 'mock.token.payload', user: { ...u, username, full_name: username.charAt(0).toUpperCase() + username.slice(1), user_id: 1, employee_code: u.employee_code || null } };
      CALLMASTER_API._token = result.token;
    } else {
      result = await CALLMASTER_API.post('/api/callmaster/auth/login', { username, password });
    }

    if (!result.success) { errEl.textContent = result.message || 'Login failed'; return; }

    onLogin(result.token, result.user);
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function onLogin(token, user) {
  state.user = user;
  CALLMASTER_API.setToken(token);
  sessionStorage.setItem('cm_token', token);
  sessionStorage.setItem('cm_user', JSON.stringify(user));

  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('personaBadge').className = `persona-badge badge-${user.role}`;
  document.getElementById('personaBadge').textContent = user.role.replace('_', ' ').toUpperCase();
  document.getElementById('topbarUser').textContent = user.full_name;

  buildNav(user.role);

  // Navigate to first real page for this role
  const firstPage = (NAV_CONFIG[user.role] || []).find(i => i.page);
  if (firstPage) go(firstPage.page);
}

function doLogout() {
  sessionStorage.removeItem('cm_token');
  sessionStorage.removeItem('cm_user');
  state.user = null;
  state.page = null;
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('navLinks').innerHTML = '';
  document.getElementById('pageContent').innerHTML = '';
}

// ── Enter key on login form ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginOverlay').classList.contains('hidden')) {
    doLogin();
  }
});

// ── Auto-restore session ──
(function restoreSession() {
  const token = sessionStorage.getItem('cm_token');
  const user  = sessionStorage.getItem('cm_user');
  if (token && user) {
    try {
      onLogin(token, JSON.parse(user));
    } catch {
      doLogout();
    }
  }
})();
