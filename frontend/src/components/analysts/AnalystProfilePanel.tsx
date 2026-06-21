import { ClipboardCopy, Target, TrendingUp, User2, X } from 'lucide-react';
import type { TopBottomAgentsData } from '../../api/types';
import { fmtDate, fmtDec, fmtInt, fmtPct } from '../../utils/formatters';
import { copySafeText } from '../../utils/safeExport';
import { useFilters } from '../../context/FiltersContext';
import { useApi } from '../../utils/useApi';
import {
  getAnalystCoaching,
  getAnalystEvidence,
  getAnalystSummary,
  getAnalystTrend,
  type AnalystCoachingData,
  type AnalystEvidenceData,
  type AnalystSummaryData,
  type AnalystTrendData,
} from '../../api/analystApi';
import ChartCard from '../charts/ChartCard';
import TrendLineChart from '../charts/TrendLineChart';
import RiskQueueTable from '../tables/RiskQueueTable';
import LoadingSkeleton from '../states/LoadingSkeleton';
import ErrorState from '../states/ErrorState';
import UnsupportedState from '../states/UnsupportedState';
import EmptyState from '../states/EmptyState';

type Analyst = TopBottomAgentsData['analysts'][number];

interface AnalystProfilePanelProps {
  analyst: Analyst | null;
  onClose: () => void;
}

export default function AnalystProfilePanel({ analyst, onClose }: AnalystProfilePanelProps) {
  const { filters, toQuery } = useFilters();
  const analystId = analyst?.agentName || '';
  const emptyResult: any = { kind: 'empty', meta: { source: 'generic', cacheHit: false, queryMs: 0, totalMs: 0, from: '', to: '' } };
  const summaryApi = useApi<AnalystSummaryData>(() => analystId ? getAnalystSummary(analystId, toQuery()) : Promise.resolve(emptyResult), [filters, analystId]);
  const trendApi = useApi<AnalystTrendData>(() => analystId ? getAnalystTrend(analystId, toQuery()) : Promise.resolve(emptyResult), [filters, analystId]);
  const evidenceApi = useApi<AnalystEvidenceData>(() => analystId ? getAnalystEvidence(analystId, { ...toQuery(), limit: 20, offset: 0 }) : Promise.resolve(emptyResult), [filters, analystId]);
  const coachingApi = useApi<AnalystCoachingData>(() => analystId ? getAnalystCoaching(analystId, toQuery()) : Promise.resolve(emptyResult), [filters, analystId]);

  if (!analyst) return null;

  const liveSummary = summaryApi.state.kind === 'ready' && summaryApi.state.result.kind === 'ok'
    ? summaryApi.state.result.data.summary
    : null;
  const current = liveSummary || analyst;
  const liveCoaching = coachingApi.state.kind === 'ready' && coachingApi.state.result.kind === 'ok'
    ? coachingApi.state.result.data
    : null;
  const pitchRate = current.opportunities ? (current.pitchAttempts || 0) / current.opportunities : null;
  const strongPitchRate = current.pitchAttempts ? (current.strongPitch || 0) / current.pitchAttempts : null;
  const riskRate = current.totalCalls ? (current.highRiskCount || 0) / current.totalCalls : null;
  const weakness = liveCoaching?.weaknesses?.[0]?.parameter || getWeakness(current);
  const recommendation = liveCoaching?.recommendations?.[0] || getRecommendation(current);

  const copyCoachingSummary = () => {
    copySafeText([
      'Call Master IQ Coaching Summary',
      `Analyst: ${analyst.agentName || 'not returned'}`,
      `Total calls: ${fmtInt(current.totalCalls)}`,
      `Average quality: ${current.avgScore === null || current.avgScore === undefined ? 'not returned' : fmtDec(current.avgScore, 1)}`,
      `High-risk count: ${fmtInt(current.highRiskCount)}`,
      `Opportunities: ${fmtInt(current.opportunities)}`,
      `Pitch rate: ${pitchRate === null ? 'not returned' : fmtPct(pitchRate, 0)}`,
      `Recommended coaching: ${recommendation}`,
    ].join('\n'));
  };

  return (
    <section className="mt-6 rounded-2xl border border-line-subtle bg-panel/80 p-5 shadow-glass backdrop-blur-glass">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet/30 bg-violet/10 text-violet">
            <User2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Analyst profile</div>
            <h3 className="mt-1 truncate text-lg font-semibold text-ink-primary">{analyst.agentName || 'Unknown analyst'}</h3>
            <p className="text-xs text-ink-muted">Last call: {fmtDate(analyst.lastCallDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copyCoachingSummary}
            className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
          >
            <ClipboardCopy size={14} />
            Copy coaching summary
          </button>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line-subtle bg-elevated/40 text-ink-secondary transition-colors hover:text-ink-primary focus-ring"
            aria-label="Close analyst profile"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total calls" value={fmtInt(current.totalCalls)} />
        <Metric label="Average quality" value={current.avgScore === null || current.avgScore === undefined ? '—' : fmtDec(current.avgScore, 1)} tone={scoreTone(current.avgScore)} />
        <Metric label="High risk" value={fmtInt(current.highRiskCount)} tone={(current.highRiskCount || 0) > 0 ? 'bad' : 'good'} />
        <Metric label="Pitch rate" value={pitchRate === null ? '—' : fmtPct(pitchRate, 0)} tone={pitchRate === null ? 'neutral' : pitchRate >= 0.7 ? 'good' : 'warn'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <TrendingUp size={15} className="text-blue" />
            Sales indicators
          </div>
          <Field label="Opportunities" value={fmtInt(current.opportunities)} />
          <Field label="Pitch attempts" value={fmtInt(current.pitchAttempts)} />
          <Field label="Strong pitch rate" value={strongPitchRate === null ? '—' : fmtPct(strongPitchRate, 0)} />
          <Field label="Disbursals" value={fmtInt(current.disbursals)} />
        </div>

        <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <Target size={15} className="text-warn" />
            Coaching recommendation
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">{recommendation}</p>
          <div className="mt-3 rounded-lg border border-line-subtle bg-panel/45 p-3 text-xs text-ink-muted">
            Parameter weakness: {weakness}
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
          <div className="mb-3 text-sm font-semibold text-ink-primary">Evidence and trend</div>
          <Field label="Risk rate" value={riskRate === null ? '—' : fmtPct(riskRate, 0)} />
          <Field label="Live detail" value={summaryApi.state.kind === 'ready' && summaryApi.state.result.kind === 'ok' ? 'Available' : 'Pending / unavailable'} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Analyst trend" subtitle="Live analyst-specific quality and volume trend." loading={trendApi.state.kind === 'loading'}>
          {renderTrend(trendApi.state)}
        </ChartCard>
        <ChartCard title="Analyst evidence" subtitle="Masked evidence records only. No raw transcript." loading={evidenceApi.state.kind === 'loading'}>
          {renderEvidence(evidenceApi.state)}
        </ChartCard>
      </div>
    </section>
  );
}

function renderTrend(state: ReturnType<typeof useApi<any>>['state']) {
  if (state.kind === 'ready' && state.result.kind === 'error') return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  if (state.kind === 'ready' && state.result.kind === 'unsupported') return <UnsupportedState reason={state.result.reason} />;
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    const trend = state.result.data.trend || [];
    if (trend.length === 0) return <EmptyState title="No analyst trend" description="No trend points returned for this analyst and filter." />;
    return <TrendLineChart data={trend} series={[{ key: 'avgScore', label: 'Avg Quality', color: '#9D7BFF' }, { key: 'totalCalls', label: 'Calls', color: '#38E1FF' }]} />;
  }
  return <LoadingSkeleton variant="chart" />;
}

function renderEvidence(state: ReturnType<typeof useApi<any>>['state']) {
  if (state.kind === 'ready' && state.result.kind === 'error') return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  if (state.kind === 'ready' && state.result.kind === 'unsupported') return <UnsupportedState reason={state.result.reason} />;
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    const records = state.result.data.records || [];
    if (records.length === 0) return <EmptyState title="No analyst evidence" description="No risk, leakage, or coaching evidence returned for this analyst." />;
    return <RiskQueueTable records={records} loading={false} />;
  }
  return <LoadingSkeleton variant="table" rows={4} />;
}

function getWeakness(analyst: Analyst): string {
  if ((analyst.highRiskCount || 0) > 0) return 'Risk control and compliance language';
  if (analyst.opportunities && (analyst.pitchAttempts || 0) < analyst.opportunities) return 'Opportunity pitching coverage';
  if (analyst.pitchAttempts && (analyst.strongPitch || 0) / analyst.pitchAttempts < 0.5) return 'Pitch strength and objection handling';
  if ((analyst.avgScore || 0) < 70) return 'Quality fundamentals';
  return 'No clear weakness returned by available summary fields';
}

function getRecommendation(analyst: Analyst): string {
  if ((analyst.highRiskCount || 0) > 0) return 'Review high-risk calls first, validate evidence, then assign focused compliance coaching.';
  if ((analyst.avgScore || 0) < 70) return 'Schedule QA calibration and review lowest scoring parameters before next production cycle.';
  if (analyst.opportunities && (analyst.pitchAttempts || 0) < analyst.opportunities) return 'Coach on identifying sales moments and making a compliant pitch attempt.';
  return 'Maintain current performance and use peer examples for quality consistency.';
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink-primary';
  return (
    <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 last:mb-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

function scoreTone(score: number | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (score === null || score === undefined) return 'neutral';
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}
