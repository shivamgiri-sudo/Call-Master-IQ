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
  const total = s(38500, preset);
  const tq = Math.round(total * 0.42), bq = Math.round(total * 0.12), mq = total - tq - bq;
  const days = preset === 'D1' ? 1 : preset === 'WTD' ? 7 : 27;
  const trend = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
    avgQuality: +(91 + Math.sin(i) * 2).toFixed(2),
  }));
  return {
    processName: 'GNC Inbound', sourceType: 'Inbound', targetCqPct: 95,
    totalCalls: total, avgQuality: 91.2, fatalPct: 2.8,
    tqCount: tq, mqCount: mq, bqCount: bq,
    tqPct: +((tq/total)*100).toFixed(1), mqPct: +((mq/total)*100).toFixed(1), bqPct: +((bq/total)*100).toFixed(1),
    trend,
  };
}

function mockPmAgentLeaderboard(preset) {
  return [
    { agent_name: 'Anita Sharma',  emp_id: 'EMP001', totalCalls: s(320, preset), avgQuality: 97.2, fatalPct: 0.0, classification: 'TQ' },
    { agent_name: 'Rahul Singh',   emp_id: 'EMP002', totalCalls: s(290, preset), avgQuality: 94.1, fatalPct: 0.3, classification: 'TQ' },
    { agent_name: 'Kiran Patil',   emp_id: 'EMP005', totalCalls: s(310, preset), avgQuality: 88.9, fatalPct: 0.6, classification: 'MQ' },
    { agent_name: 'Meera Joshi',   emp_id: 'EMP006', totalCalls: s(280, preset), avgQuality: 83.4, fatalPct: 1.1, classification: 'BQ' },
  ];
}

function mockPmLobBreakdown(preset) {
  return [
    { lob_name: 'Query',     totalCalls: s(12000, preset), avgQuality: 92.1, fatalPct: 1.8, targetCqPct: 95 },
    { lob_name: 'Complaint', totalCalls: s(9800,  preset), avgQuality: 89.4, fatalPct: 3.2, targetCqPct: 95 },
    { lob_name: 'Request',   totalCalls: s(8400,  preset), avgQuality: 91.8, fatalPct: 2.1, targetCqPct: 95 },
  ];
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
    cst: {
      total: s(45700, preset),
      funnel: [
        { stage: 'Total Calls',      count: s(45700, preset) },
        { stage: 'Opening Pitched',  count: s(38200, preset) },
        { stage: 'Offer Presented',  count: s(28400, preset) },
        { stage: 'Offer Accepted',   count: s(18600, preset) },
        { stage: 'Sale Done',        count: s(9800,  preset) },
      ],
    },
    crt: {
      total: s(7500, preset),
      funnel: [
        { stage: 'Opening Rejected', count: s(7500, preset) },
        { stage: 'Counter Pitched',  count: s(5200, preset) },
        { stage: 'Offer Presented',  count: s(3800, preset) },
        { stage: 'Sale Recovered',   count: s(2200, preset) },
      ],
    },
  };
}

function mockPmNpsCsat(preset) {
  return {
    nps: 10.56, csat: 72.5,
    breakdown: [
      { category: 'Promoter',  count: s(5400, preset) },
      { category: 'Passive',   count: s(8100, preset) },
      { category: 'Detractor', count: s(3200, preset) },
    ],
  };
}

function mockPmMissedOpportunities(preset) {
  return [
    { category: 'Competitor Product', count: s(3200, preset), pct: 25.6 },
    { category: 'Budget Constraint',  count: s(2800, preset), pct: 22.4 },
    { category: 'Low Urgency',        count: s(2100, preset), pct: 16.8 },
    { category: 'Durability',         count: s(1900, preset), pct: 15.2 },
    { category: 'Shipping Speed',     count: s(1400, preset), pct: 11.2 },
    { category: 'Hidden Fees',        count: s(1100, preset), pct: 8.8 },
  ];
}

function mockPmObjectionRebuttal(preset) {
  return {
    objections: [
      { category: 'Price too high',    count: s(1200, preset) },
      { category: 'Not needed now',    count: s(980,  preset) },
      { category: 'Competitor better', count: s(820,  preset) },
    ],
    rebuttals: [
      { category: 'EMI option',        count: s(790, preset) },
      { category: 'Urgency creation',  count: s(480, preset) },
      { category: 'Feature compare',   count: s(308, preset) },
    ],
  };
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
  '/api/callmaster/pm/overview':              (b) => mockPmOverview(b.preset || 'MTD'),
  '/api/callmaster/pm/agent-leaderboard':     (b) => mockPmAgentLeaderboard(b.preset || 'MTD'),
  '/api/callmaster/pm/lob-breakdown':         (b) => mockPmLobBreakdown(b.preset || 'MTD'),
  '/api/callmaster/pm/parameter-breakdown':   (b) => ({ professionalism_maintained: s(94, b.preset||'MTD'), accurate_issue_probing: s(88, b.preset||'MTD'), case_escalated_correctly: s(91, b.preset||'MTD'), proper_hold_procedure: s(87, b.preset||'MTD'), correct_and_complete_information: s(92, b.preset||'MTD'), proper_call_closure: s(95, b.preset||'MTD'), total: s(1200, b.preset||'MTD') }),
  '/api/callmaster/pm/tni-report':            (b) => [
    { agent_name:'Anita Sharma', emp_id:'EMP001', professionalism_maintained:99, accurate_issue_probing:98, case_escalated_correctly:100, proper_hold_procedure:97, correct_and_complete_information:98, proper_call_closure:99, total:s(320,b.preset||'MTD') },
    { agent_name:'Rahul Singh',  emp_id:'EMP002', professionalism_maintained:95, accurate_issue_probing:91, case_escalated_correctly:94,  proper_hold_procedure:90, correct_and_complete_information:93, proper_call_closure:96, total:s(290,b.preset||'MTD') },
    { agent_name:'Kiran Patil',  emp_id:'EMP005', professionalism_maintained:90, accurate_issue_probing:85, case_escalated_correctly:88,  proper_hold_procedure:84, correct_and_complete_information:87, proper_call_closure:91, total:s(310,b.preset||'MTD') },
    { agent_name:'Meera Joshi',  emp_id:'EMP006', professionalism_maintained:85, accurate_issue_probing:79, case_escalated_correctly:82,  proper_hold_procedure:78, correct_and_complete_information:81, proper_call_closure:84, total:s(280,b.preset||'MTD') },
  ],
  '/api/callmaster/pm/coaching-queue':        (b) => [
    { source_call_id:'IB-2891', agent_name:'Meera Joshi',  call_quality_percentage:68.2, status:'pending' },
    { source_call_id:'IB-3102', agent_name:'Rahul Singh',  call_quality_percentage:74.1, status:'pending' },
  ],
  '/api/callmaster/pm/analyst-scorecard':     (b) => mockPmAnalystScorecard(b.preset || 'MTD'),
  '/api/callmaster/pm/fatal-analysis':        (b) => ({ fatalCount: s(180, b.preset||'MTD'), fatalPct: 2.8, fatalByScenario: [{ scenario:'Escalation Failure', count: s(80,b.preset||'MTD'), pct:44.4 }, { scenario:'Data Theft', count: s(18,b.preset||'MTD'), pct:10.0 }, { scenario:'Cuss Word', count: s(12,b.preset||'MTD'), pct:6.7 }] }),
  '/api/callmaster/pm/scenario-breakdown':    (b) => ({ total: s(38500,b.preset||'MTD'), byScenario: [{ scenario:'Query', count:s(12000,b.preset||'MTD'), pct:31.2 }, { scenario:'Complaint', count:s(9800,b.preset||'MTD'), pct:25.5 }, { scenario:'Request', count:s(8400,b.preset||'MTD'), pct:21.8 }] }),
  '/api/callmaster/pm/detail-analysis':       (b) => ({ parameters: [{ param:'Call Answered <5s', passRate:94.2, failRate:5.8 }, { param:'Escalated Correctly', passRate:91.1, failRate:8.9 }, { param:'Correct Info', passRate:88.4, failRate:11.6 }, { param:'Hold Procedure', passRate:87.2, failRate:12.8 }] }),
  '/api/callmaster/pm/escalation-analysis':   (b) => ({ escalation_failures:s(94,b.preset||'MTD'), data_theft_cases:s(18,b.preset||'MTD'), competitor_mentions:s(44,b.preset||'MTD'), cuss_calls:s(12,b.preset||'MTD') }),
  '/api/callmaster/pm/cst-crt-funnel':        (b) => mockPmCstCrt(b.preset || 'MTD'),
  '/api/callmaster/pm/missed-opportunities':  (b) => mockPmMissedOpportunities(b.preset || 'MTD'),
  '/api/callmaster/pm/nps-csat':              (b) => mockPmNpsCsat(b.preset || 'MTD'),
  '/api/callmaster/pm/pitch-stage-analysis':  (b) => ({ stages:[{ stage:'Opening Rejected', count:s(7200,b.preset||'MTD'), pct:18.7 }, { stage:'Offering Rejected', count:s(5400,b.preset||'MTD'), pct:14.0 }, { stage:'After Listen Rejected', count:s(3100,b.preset||'MTD'), pct:8.1 }, { stage:'Sale Done', count:s(9800,b.preset||'MTD'), pct:25.5 }] }),
  '/api/callmaster/pm/objection-rebuttal':    (b) => mockPmObjectionRebuttal(b.preset || 'MTD'),
  '/api/callmaster/pm/inbound-explorer':      (b) => ({ rows:[{ agent_name:'Ravi Kumar', lob_name:'Query', audit_date:'2026-05-27', call_quality_percentage:82.1, fatal_flag:0 }, { agent_name:'Meera Joshi', lob_name:'Complaint', audit_date:'2026-05-27', call_quality_percentage:68.2, fatal_flag:1 }], total:s(38500,b.preset||'MTD'), page:1 }),
  '/api/callmaster/pm/outbound-explorer':     (b) => ({ rows:[{ agent_name:'Ravi Kumar', lob_name:'Sales', audit_date:'2026-05-27', call_quality_percentage:79.4, fatal_flag:0 }], total:s(24200,b.preset||'MTD'), page:1 }),
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
