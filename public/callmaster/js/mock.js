// public/callmaster/js/mock.js
const USE_MOCK_DATA = true;

// Scale factor per preset so mock numbers feel realistic
const SCALE = { MTD: 1.0, WTD: 0.27, D1: 0.04 };

function s(base, preset) { return Math.round(base * (SCALE[preset] || 1)); }

// ── Mock data factories ──

function mockCeoScorecard(preset) {
  return {
    outbound_score: 79.4,
    inbound_score: 91.2,
    total_calls: s(84200, preset),
    critical_calls: s(312, preset),
    inbound_calls: s(38500, preset),
    outbound_calls: s(45700, preset),
  };
}

function mockCeoProcessMatrix(preset) {
  return [
    { process_name: 'Birlanu MCN', source_type: 'Outbound', quality_score: 79.4, total_calls: s(45700, preset), sla_pct: 88.2, critical_count: s(200, preset) },
    { process_name: 'GNC Inbound', source_type: 'Inbound',  quality_score: 91.2, total_calls: s(38500, preset), sla_pct: 94.1, critical_count: s(112, preset) },
  ];
}

function mockCeoBranchComparison(preset) {
  return [
    { branch: 'Delhi NCR',   quality_score: 88.1, total_calls: s(28000, preset), critical_count: s(98, preset),  trend: 'up' },
    { branch: 'Mumbai',      quality_score: 85.6, total_calls: s(22000, preset), critical_count: s(114, preset), trend: 'down' },
    { branch: 'Bengaluru',   quality_score: 83.2, total_calls: s(18500, preset), critical_count: s(64, preset),  trend: 'up' },
    { branch: 'Hyderabad',   quality_score: 79.9, total_calls: s(15700, preset), critical_count: s(36, preset),  trend: 'flat' },
  ];
}

function mockCeoTrend() {
  const days = 30;
  const cats = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return `${d.getDate()}/${d.getMonth()+1}`;
  });
  const outbound = Array.from({ length: days }, () => +(75 + Math.random() * 10).toFixed(1));
  const inbound  = Array.from({ length: days }, () => +(88 + Math.random() * 8).toFixed(1));
  return { categories: cats, series: [{ name: 'Outbound', data: outbound }, { name: 'Inbound', data: inbound }] };
}

function mockCeoAlerts(preset) {
  return [
    { call_id: 'IB-2891', source_type: 'Inbound', process_name: 'GNC Inbound', agent: 'Ravi Kumar', severity: 'Critical', reason: 'Data theft detected', call_date: '2026-05-27' },
    { call_id: 'OB-5512', source_type: 'Outbound', process_name: 'Birlanu MCN', agent: 'Priya Mehta', severity: 'High', reason: 'Sensitive word used', call_date: '2026-05-27' },
    { call_id: 'IB-2892', source_type: 'Inbound', process_name: 'GNC Inbound', agent: 'Suresh Rao', severity: 'High', reason: 'Escalation failure', call_date: '2026-05-27' },
  ];
}

function mockTqQualityDeepdive(preset) {
  return {
    inbound: { score: 91.2, parameters: [
      { param: 'Opening', pass_rate: 96.1, weight: 10 },
      { param: 'Compliance', pass_rate: 88.4, weight: 15 },
      { param: 'Resolution', pass_rate: 94.7, weight: 20 },
      { param: 'Call Closure', pass_rate: 91.2, weight: 10 },
    ]},
    outbound: { score: 79.4, parameters: [
      { param: 'Opening Pitch', pass_rate: 82.1, weight: 15 },
      { param: 'Context Setting', pass_rate: 74.3, weight: 15 },
      { param: 'Offer Pitch', pass_rate: 71.8, weight: 20 },
      { param: 'Objection Handling', pass_rate: 68.5, weight: 20 },
    ]},
  };
}

function mockTqLeaderboard(preset) {
  return [
    { employee_code: 'EMP001', name: 'Anita Sharma',  process: 'GNC Inbound',  score: 97.2, calls: s(320, preset), classification: 'TQ' },
    { employee_code: 'EMP002', name: 'Rahul Singh',   process: 'GNC Inbound',  score: 94.1, calls: s(290, preset), classification: 'TQ' },
    { employee_code: 'EMP003', name: 'Deepak Verma',  process: 'Birlanu MCN',  score: 82.4, calls: s(410, preset), classification: 'MQ' },
    { employee_code: 'EMP004', name: 'Sonal Gupta',   process: 'Birlanu MCN',  score: 74.1, calls: s(380, preset), classification: 'BQ' },
    { employee_code: 'EMP005', name: 'Kiran Patil',   process: 'GNC Inbound',  score: 88.9, calls: s(310, preset), classification: 'MQ' },
  ];
}

function mockPmOverview(preset) {
  return {
    quality_score: 91.2, total_calls: s(38500, preset),
    defect_count: s(3400, preset), critical_count: s(112, preset),
    target_cq_pct: 95, source_type: 'Inbound',
  };
}

function mockPmAnalystScorecard(preset) {
  return [
    { employee_code: 'EMP001', name: 'Anita Sharma',  score: 97.2, calls: s(320, preset), fatal_count: 0,  classification: 'TQ' },
    { employee_code: 'EMP002', name: 'Rahul Singh',   score: 94.1, calls: s(290, preset), fatal_count: 1,  classification: 'TQ' },
    { employee_code: 'EMP005', name: 'Kiran Patil',   score: 88.9, calls: s(310, preset), fatal_count: 2,  classification: 'MQ' },
    { employee_code: 'EMP006', name: 'Meera Joshi',   score: 83.4, calls: s(280, preset), fatal_count: 3,  classification: 'BQ' },
  ];
}

function mockPmFatalAnalysis(preset) {
  return {
    fatal_pct: 2.8, without_fatal_cq: 93.6,
    top_contributors: [
      { agent: 'Meera Joshi', fatal_count: 3 },
      { agent: 'Rahul Singh', fatal_count: 1 },
    ],
    day_wise: { categories: ['Mon','Tue','Wed','Thu','Fri'], fatal_pct: [3.1, 2.4, 2.9, 2.2, 3.8] },
    scenario_fatal: {
      scenarios: ['Query','Complaint','Request','Sale Done'],
      fatal_types: ['Data Theft','Financial Fraud','Escalation Failure','Unprofessional'],
      matrix: [[1,0,2,0],[3,1,0,1],[0,0,1,0],[0,0,0,1]],
    },
  };
}

function mockPmCstCrt(preset) {
  return {
    cst: { total_calls: s(45700, preset), ops: s(38200, preset), cps: s(28400, preset), offer_success: s(18600, preset), sale_done: s(9800, preset), success_rate: 21.4 },
    crt: { or: s(7500, preset), cr: s(9800, preset), opr: s(9800, preset), por: s(2200, preset), failure_rate: 27.4 },
  };
}

function mockPmNpsCsat(preset) {
  return {
    nps_score: 10.56,
    csat_score: 72.5,
    detractors: s(3200, preset), passives: s(8100, preset), promoters: s(5400, preset),
    day_wise: {
      categories: ['Mon','Tue','Wed','Thu','Fri'],
      nps: [8.2, 11.4, 10.9, 12.1, 10.2],
      csat: [70.1, 73.2, 72.8, 74.1, 71.8],
    },
  };
}

function mockPmMissedOpportunities(preset) {
  return {
    total_opportunities: s(45700, preset),
    mo_count: s(12500, preset),
    categories: [
      { category: 'Competitor Product', count: s(3200, preset), contr_pct: 25.6, observation: 'Agents failing to address competitor feature gap; no counter-script available' },
      { category: 'Budget Constraint',  count: s(2800, preset), contr_pct: 22.4, observation: 'EMI explanation not being done in 60%+ of objection cases' },
      { category: 'Low Urgency',        count: s(2100, preset), contr_pct: 16.8, observation: 'Agents not creating urgency using limited-time offer language' },
      { category: 'Durability',         count: s(1900, preset), contr_pct: 15.2, observation: 'Product quality rebuttals weak; escalation to supervisor in 30%+ cases' },
      { category: 'Shipping Speed',     count: s(1400, preset), contr_pct: 11.2, observation: 'Delivery timeline not being communicated proactively' },
      { category: 'Hidden Fees',        count: s(1100, preset), contr_pct: 8.8,  observation: 'Transparency gap; agents not disclosing processing fees upfront' },
    ],
  };
}

function mockPmObjectionRebuttal(preset) {
  return [
    { objection: 'Price too high',    rebuttal: 'EMI option',      count: s(1200, preset), failed_rebuttal_pct: 34.2, failed_rebuttal: s(410, preset), successful_rebuttal_pct: 65.8, successful_rebuttal: s(790, preset), conversion_pct: 18.4 },
    { objection: 'Not needed now',    rebuttal: 'Urgency creation', count: s(980, preset),  failed_rebuttal_pct: 51.0, failed_rebuttal: s(500, preset), successful_rebuttal_pct: 49.0, successful_rebuttal: s(480, preset), conversion_pct: 12.1 },
    { objection: 'Competitor better', rebuttal: 'Feature compare',  count: s(820, preset),  failed_rebuttal_pct: 62.4, failed_rebuttal: s(512, preset), successful_rebuttal_pct: 37.6, successful_rebuttal: s(308, preset), conversion_pct: 8.9 },
  ];
}

// ── Mock API override ──

const _MOCK_ROUTES = {
  '/api/callmaster/ceo/scorecard':         (b) => mockCeoScorecard(b.preset || 'MTD'),
  '/api/callmaster/ceo/process-matrix':    (b) => mockCeoProcessMatrix(b.preset || 'MTD'),
  '/api/callmaster/ceo/branch-comparison': (b) => mockCeoBranchComparison(b.preset || 'MTD'),
  '/api/callmaster/ceo/sla-overview':      ()  => ({ sla_pct: 91.4, by_process: [{ process: 'GNC Inbound', sla_pct: 94.1 }, { process: 'Birlanu MCN', sla_pct: 88.2 }] }),
  '/api/callmaster/ceo/risk-exposure':     (b) => ({ total_risk: 312, categories: [{ cat: 'Data Theft', count: 18 }, { cat: 'Escalation Failure', count: 94 }, { cat: 'Sensitive Word', count: 200 }] }),
  '/api/callmaster/ceo/trend':             ()  => mockCeoTrend(),
  '/api/callmaster/ceo/alerts':            (b) => mockCeoAlerts(b.preset || 'MTD'),
  '/api/callmaster/tq/quality-deepdive':   (b) => mockTqQualityDeepdive(b.preset || 'MTD'),
  '/api/callmaster/tq/leaderboard':        (b) => mockTqLeaderboard(b.preset || 'MTD'),
  '/api/callmaster/tq/tni-heatmap':        ()  => ({ agents: ['Anita','Rahul','Kiran','Meera'], params: ['Opening','Compliance','Resolution','Closure'], matrix: [[0,1,0,0],[1,3,0,2],[0,2,1,0],[2,4,3,1]] }),
  '/api/callmaster/tq/coaching-queue':     (b) => ({ open: s(14, b.preset||'MTD'), items: [{ id:1, agent:'Meera Joshi', reason:'Fatal call — escalation failure', priority:'High', status:'Open', due:'2026-06-02' }] }),
  '/api/callmaster/tq/calibration':        ()  => ({ sessions: [{ id:1, date:'2026-05-20', process:'GNC Inbound', variance_score:3.2, status:'Closed' }] }),
  '/api/callmaster/tq/audit-efficiency':   (b) => ({ manual_audits: s(1240, b.preset||'MTD'), ai_audits: s(3800, b.preset||'MTD'), pending: s(180, b.preset||'MTD') }),
  '/api/callmaster/tq/parameter-drift':    ()  => ({ declining: [{ param:'Compliance', change_pct: -4.2 }, { param:'Offer Pitch', change_pct: -6.8 }] }),
  '/api/callmaster/tq/sla-tracker':        ()  => ({ rows: [{ auditor:'Pooja', process:'GNC Inbound', sla_pct:96.2 }, { auditor:'Amit', process:'Birlanu MCN', sla_pct:84.1 }] }),
  '/api/callmaster/pm/overview':           (b) => mockPmOverview(b.preset || 'MTD'),
  '/api/callmaster/pm/parameter-breakdown':(b) => ({ params: [{ param:'Resolution', weight:20, pass_rate:94.7, trend:'up' }, { param:'Compliance', weight:15, pass_rate:88.4, trend:'down' }] }),
  '/api/callmaster/pm/explorer':           (b) => ({ total: 38500, calls: [{ id:'IB-2891', agent:'Ravi Kumar', date:'2026-05-27', score:82.1, band:'Average', severity:'Critical' }] }),
  '/api/callmaster/pm/analyst-scorecard':  (b) => mockPmAnalystScorecard(b.preset || 'MTD'),
  '/api/callmaster/pm/tni-report':         ()  => ({ agents:['Anita','Rahul'], params:['Resolution','Compliance'], matrix:[[0,1],[2,3]] }),
  '/api/callmaster/pm/trends':             ()  => mockCeoTrend(),
  '/api/callmaster/pm/fatal-analysis':     (b) => mockPmFatalAnalysis(b.preset || 'MTD'),
  '/api/callmaster/pm/scenario-breakdown': (b) => ({ scenarios:[{scenario:'Query',score:92.1,calls:s(12000,b.preset||'MTD'),fatal:s(80,b.preset||'MTD')},{scenario:'Complaint',score:89.4,calls:s(9800,b.preset||'MTD'),fatal:s(220,b.preset||'MTD')}] }),
  '/api/callmaster/pm/detail-analysis':    (b) => ({ rows:[{ name:'Anita Sharma', score:97.2, calls:s(320,b.preset||'MTD'), classification:'TQ', params:{ Resolution:100, Compliance:96 } }] }),
  '/api/callmaster/pm/escalation-analysis':(b) => ({ potential_escalations:s(180,b.preset||'MTD'), social_media_threat:s(12,b.preset||'MTD'), scam_mentions:s(8,b.preset||'MTD'), competitor_mentions:s(44,b.preset||'MTD') }),
  '/api/callmaster/pm/cst-crt-funnel':     (b) => mockPmCstCrt(b.preset || 'MTD'),
  '/api/callmaster/pm/missed-opportunities':(b)=> mockPmMissedOpportunities(b.preset || 'MTD'),
  '/api/callmaster/pm/nps-csat':           (b) => mockPmNpsCsat(b.preset || 'MTD'),
  '/api/callmaster/pm/pitch-stage-analysis':(b)=> ({ op:[{category:'Direct Pitch',success_rate:68.2,count:s(18000,b.preset||'MTD')}], offered:[{discount_type:'10%',total_offered:s(8200,b.preset||'MTD'),or_count:s(2100,b.preset||'MTD'),or_pct:25.6,os_count:s(4800,b.preset||'MTD'),os_pct:58.5,sale_count:s(1300,b.preset||'MTD'),conversion_pct:15.9}] }),
  '/api/callmaster/pm/objection-rebuttal': (b) => mockPmObjectionRebuttal(b.preset || 'MTD'),
  '/api/callmaster/bm/health':             (b) => ({ quality_score:87.4, total_calls:s(18500,b.preset||'MTD'), critical_count:s(64,b.preset||'MTD') }),
  '/api/callmaster/bm/process-breakdown':  (b) => ({ processes:[{name:'GNC Inbound',score:91.2,calls:s(8800,b.preset||'MTD')},{name:'Birlanu MCN',score:79.4,calls:s(9700,b.preset||'MTD')}] }),
  '/api/callmaster/bm/team-performance':   (b) => ({ agents:[{name:'Anita Sharma',score:97.2,calls:s(320,b.preset||'MTD'),risk:0,coaching:'None'}] }),
  '/api/callmaster/bm/daily-sla':          ()  => ({ coverage_pct:88.4, audited:s(1240,'D1'), total:s(1400,'D1'), breaches:[] }),
  '/api/callmaster/bm/risk-calls':         (b) => ({ calls:[{id:'IB-2891',agent:'Ravi Kumar',severity:'Critical',reason:'Data theft',date:'2026-05-27'}] }),
  '/api/callmaster/bm/action-items':       ()  => ({ items:[{id:1,type:'Coaching',agent:'Meera Joshi',due:'2026-06-02',status:'Open'}] }),
  '/api/callmaster/analyst/overview':      (b) => ({ my_score:88.9, my_calls:s(310,b.preset||'MTD'), my_fatal:2, target_cq_pct:95 }),
  '/api/callmaster/analyst/defects':       (b) => ({ params:[{param:'Compliance',lost_marks:s(18,b.preset||'MTD')},{param:'Resolution',lost_marks:s(8,b.preset||'MTD')}] }),
  '/api/callmaster/analyst/my-calls':      (b) => ({ total:s(310,b.preset||'MTD'), calls:[{id:'IB-2910',date:'2026-05-27',score:82.1,band:'Average',severity:'Normal'}] }),
  '/api/callmaster/analyst/trend':         ()  => mockCeoTrend(),
  '/api/callmaster/analyst/coaching':      ()  => ({ sessions:[{id:1,date:'2026-05-20',coach:'Pooja',notes:'Work on compliance script adherence',status:'Acknowledged'}] }),
};

// Override CALLMASTER_API.request when USE_MOCK_DATA=true
if (typeof CALLMASTER_API !== 'undefined' && USE_MOCK_DATA) {
  CALLMASTER_API.request = async function(path, options = {}) {
    const key = path.replace(/\/[0-9]+$/, '/:id');  // normalize :id routes
    const handler = _MOCK_ROUTES[path] || _MOCK_ROUTES[key];
    if (!handler) {
      console.warn('[mock] No mock for', path);
      return { success: true, data: [] };
    }
    const body = options.body ? JSON.parse(options.body) : {};
    await new Promise(r => setTimeout(r, 80));  // simulate network latency
    return { success: true, data: handler(body) };
  };
}
