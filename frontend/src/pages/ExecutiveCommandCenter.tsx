import { useMemo } from 'react';
import {
  Phone, ShieldCheck, AlertTriangle, TrendingUp, Target, Award, Banknote,
  Users, ArrowUpRight, ArrowDownRight, ClipboardCopy, ClipboardList, Gauge, Route,
} from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import KpiCard from '../components/cards/KpiCard';
import InsightCard from '../components/cards/InsightCard';
import ChartCard from '../components/charts/ChartCard';
import TrendLineChart from '../components/charts/TrendLineChart';
import RiskQueueTable from '../components/tables/RiskQueueTable';
import AnalystTable from '../components/tables/AnalystTable';
import LoadingSkeleton from '../components/states/LoadingSkeleton';
import EmptyState from '../components/states/EmptyState';
import ErrorState from '../components/states/ErrorState';
import UnsupportedState from '../components/states/UnsupportedState';
import { useApi } from '../utils/useApi';
import { useFilters } from '../context/FiltersContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSplitKpis,
  getRiskQueue,
  getAnalystDailyTrend,
  getTopBottomAgents,
  getRiskByProcess,
  getComplianceSummary,
} from '../api/analyticsApi';
import { fmtDec, fmtInt, fmtPct, shortId } from '../utils/formatters';
import EvidenceDrawer from '../components/evidence/EvidenceDrawer';
import type { RiskQueueRecord } from '../api/types';
import { copySafeText } from '../utils/safeExport';

export default function ExecutiveCommandCenter() {
  const { filters, toQuery } = useFilters();
  const navigate = useNavigate();
  const [openRecord, setOpenRecord] = useState<RiskQueueRecord | null>(null);

  const splitKpis = useApi(() => getSplitKpis(toQuery()), [filters]);
  const trend = useApi(() => getAnalystDailyTrend(toQuery()), [filters]);
  const riskQueue = useApi(() => getRiskQueue({ ...toQuery(), page: 1, limit: 10 }), [filters]);
  const topBottom = useApi(() => getTopBottomAgents({ ...toQuery(), page: 1, limit: 10 }), [filters]);
  const riskByProc = useApi(() => getRiskByProcess(toQuery()), [filters]);
  const compliance = useApi(() => getComplianceSummary(toQuery()), [filters]);

  const quality = splitKpis.state.kind === 'ready' && splitKpis.state.result.kind === 'ok'
    ? splitKpis.state.result.data : null;
  const source = splitKpis.state.kind === 'ready' && (splitKpis.state.result.kind === 'ok' || splitKpis.state.result.kind === 'empty')
    ? splitKpis.state.result.meta?.source
    : undefined;

  const trendData = useMemo(() => {
    if (trend.state.kind !== 'ready' || trend.state.result.kind !== 'ok') return [];
    return (trend.state.result.data.trend ?? []).map(p => ({
      date: p.date,
      avgScore: p.avgScore ?? null,
      totalCalls: p.totalCalls,
    }));
  }, [trend.state]);

  const topRiskRows = useMemo(() => {
    if (riskByProc.state.kind !== 'ready' || riskByProc.state.result.kind !== 'ok') return [];
    return (riskByProc.state.result.data.rows ?? []).slice(0, 5);
  }, [riskByProc.state]);

  const analystRows = useMemo(() => {
    if (topBottom.state.kind !== 'ready' || topBottom.state.result.kind !== 'ok') return [];
    return topBottom.state.result.data.analysts ?? [];
  }, [topBottom.state]);

  const lowestAnalyst = analystRows.find(a => a.avgScore !== null && a.avgScore !== undefined);
  const highestAnalyst = [...analystRows]
    .filter(a => a.avgScore !== null && a.avgScore !== undefined)
    .sort((a, b) => Number(b.avgScore) - Number(a.avgScore))[0];
  const latestTrend = trendData[trendData.length - 1];
  const previousTrend = trendData[trendData.length - 2];
  const trendDelta = latestTrend?.avgScore !== null && latestTrend?.avgScore !== undefined
    && previousTrend?.avgScore !== null && previousTrend?.avgScore !== undefined
    ? latestTrend.avgScore - previousTrend.avgScore
    : null;
  const topRiskProcess = topRiskRows[0];
  const pitchRate = quality?.opportunities ? (quality.pitched || 0) / quality.opportunities : null;
  const leakageCount = quality?.opportunities !== undefined && quality?.pitched !== undefined
    ? Math.max(quality.opportunities - quality.pitched, 0)
    : null;
  const openEvidence = (dimension: string, value: string) => {
    navigate(`/evidence?dimension=${encodeURIComponent(dimension)}&value=${encodeURIComponent(value)}`);
  };
  const copyExecutiveSummary = () => {
    copySafeText([
      'Call Master IQ Executive Summary',
      `Total calls: ${fmtInt(quality?.totalCalls ?? 0)}`,
      `Average quality: ${quality?.avgQuality === null || quality?.avgQuality === undefined ? 'not returned' : fmtDec(quality.avgQuality, 1)}`,
      `High risk triggers: ${fmtInt(quality?.highRiskTriggers ?? 0)}`,
      `Opportunities: ${fmtInt(quality?.opportunities ?? 0)}`,
      `Pitch rate: ${pitchRate === null ? 'not returned' : fmtPct(pitchRate, 0)}`,
      lowestAnalyst?.agentName ? `Coaching focus: ${lowestAnalyst.agentName} (${fmtDec(lowestAnalyst.avgScore, 1)})` : 'Coaching focus: not returned',
      topRiskProcess ? `Top risk process: ${topRiskProcess.process}` : 'Top risk process: not returned',
    ].join('\n'));
  };

  return (
    <>
      <PageHeader
        eyebrow="Executive"
        title="Command Center"
        subtitle="Real-time visibility into quality, sales, coaching, and risk across every process."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {source ? <span className="pill pill-violet">Source · {source}</span> : null}
            <button
              onClick={copyExecutiveSummary}
              className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
            >
              <ClipboardCopy size={14} />
              Copy summary
            </button>
          </div>
        )}
      />

      <GlobalFilters />

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <ExecutivePulseCard
          icon={<Gauge size={18} />}
          label="Overall health"
          value={quality?.avgQuality === null || quality?.avgQuality === undefined ? 'No score' : fmtDec(quality.avgQuality, 1)}
          tone={toneForAvg(quality?.avgQuality)}
          detail={quality?.qualityScoredCalls !== undefined ? `${fmtInt(quality.qualityScoredCalls)} scored calls` : 'Awaiting scored call data'}
        />
        <ExecutivePulseCard
          icon={<AlertTriangle size={18} />}
          label="Risk pressure"
          value={quality?.highRiskTriggers === undefined ? 'No signal' : fmtInt(quality.highRiskTriggers)}
          tone={(quality?.highRiskTriggers || 0) > 0 ? 'bad' : 'good'}
          detail={quality?.mediumFlags !== undefined ? `${fmtInt(quality.mediumFlags)} medium flags` : 'No medium flag count returned'}
        />
        <ExecutivePulseCard
          icon={<Route size={18} />}
          label="Sales motion"
          value={pitchRate === null ? 'No sales data' : fmtPct(pitchRate, 0)}
          tone={pitchRate === null ? 'neutral' : pitchRate >= 0.7 ? 'good' : pitchRate >= 0.45 ? 'warn' : 'bad'}
          detail={leakageCount === null ? 'Opportunity data unavailable' : `${fmtInt(leakageCount)} unpitched opportunities`}
        />
        <ExecutivePulseCard
          icon={<ClipboardList size={18} />}
          label="Coaching urgency"
          value={lowestAnalyst?.avgScore === null || lowestAnalyst?.avgScore === undefined ? 'No analyst data' : fmtDec(lowestAnalyst.avgScore, 1)}
          tone={toneForAvg(lowestAnalyst?.avgScore)}
          detail={lowestAnalyst?.agentName ? `${lowestAnalyst.agentName} needs review` : 'No ranked analyst returned'}
        />
      </section>

      {/* KPI Row */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {renderKpi(splitKpis.state, (data) => ({
          label: 'Total Calls',
          value: fmtInt(data.totalCalls ?? 0),
          icon: <Phone size={16} />,
          tone: 'neutral' as const,
          hint: data.qualityScoredCalls !== undefined
            ? `${fmtInt(data.qualityScoredCalls)} scored`
            : undefined,
          onClick: () => navigate('/quality'),
        }))}

        {renderKpi(splitKpis.state, (data) => ({
          label: 'Avg Quality',
          value: data.avgQuality === null || data.avgQuality === undefined ? '—' : fmtDec(data.avgQuality, 1),
          icon: <ShieldCheck size={16} />,
          tone: toneForAvg(data.avgQuality),
          hint: data.salesMixedAvgQuality !== undefined && data.supportAvgQuality !== undefined
            ? `Sales/Mix ${fmtDec(data.salesMixedAvgQuality, 1)} · Support ${fmtDec(data.supportAvgQuality, 1)}`
            : undefined,
          onClick: () => navigate('/quality'),
        }))}

        {renderKpi(splitKpis.state, (data) => ({
          label: 'High Risk Triggers',
          value: fmtInt(data.highRiskTriggers ?? 0),
          icon: <AlertTriangle size={16} />,
          tone: (data.highRiskTriggers ?? 0) > 0 ? 'bad' : 'neutral',
          hint: data.mediumFlags !== undefined ? `${fmtInt(data.mediumFlags)} medium flags` : undefined,
          onClick: () => openEvidence('risk', 'High Priority Risk Trigger'),
        }))}

        {renderKpi(splitKpis.state, (data) => ({
          label: 'Opportunities',
          value: fmtInt(data.opportunities ?? 0),
          icon: <TrendingUp size={16} />,
          tone: 'info',
          hint: data.pitched !== undefined && data.opportunities !== undefined && data.opportunities > 0
            ? `Pitch rate ${fmtPct((data.pitched || 0) / data.opportunities, 0)}`
            : undefined,
          onClick: () => navigate('/sales-funnel'),
        }))}

        {renderKpi(splitKpis.state, (data) => ({
          label: 'Strong Pitch',
          value: fmtInt(data.strongPitch ?? 0),
          icon: <Award size={16} />,
          tone: 'good',
          hint: data.pitched !== undefined ? `${fmtInt(data.pitched)} pitches attempted` : undefined,
          onClick: () => openEvidence('funnel', 'Strong Pitch'),
        }))}

        {renderKpi(splitKpis.state, (data) => ({
          label: 'Disbursal Signal',
          value: fmtInt(data.disbursalSignal ?? 0),
          icon: <Banknote size={16} />,
          tone: 'good',
          hint: 'Successful outcomes',
          onClick: () => openEvidence('funnel', 'Disbursal Signal'),
        }))}

        {renderKpi(compliance.state, (data) => ({
          label: 'Compliance Buckets',
          value: data.buckets ? fmtInt(data.buckets.reduce((s, b) => s + (b.count || 0), 0)) : '—',
          icon: <ShieldCheck size={16} />,
          tone: 'info',
          hint: data.buckets?.length ? `${data.buckets.length} categories` : undefined,
          onClick: () => navigate('/risk'),
        }))}

        {renderKpi(topBottom.state, (data) => ({
          label: 'Analyst Coverage',
          value: fmtInt(data.total ?? 0),
          icon: <Users size={16} />,
          tone: 'neutral',
          hint: data.analysts?.length ? `Top avg ${fmtDec(data.analysts[0]?.avgScore, 1) || '—'}` : undefined,
          onClick: () => navigate('/analysts'),
        }))}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <InsightCard
          tone={(quality?.highRiskTriggers || 0) > 0 ? 'bad' : 'good'}
          icon={<AlertTriangle size={14} />}
          title="What needs attention today?"
          description={quality?.highRiskTriggers
            ? `${fmtInt(quality.highRiskTriggers)} high-risk triggers are active. Start with the risk queue and evidence review.`
            : 'No high-risk trigger count returned for the selected window.'}
          meta={topRiskProcess ? `Top process: ${topRiskProcess.process}` : 'Process risk not available'}
          onClick={() => openEvidence('risk', 'High Priority Risk Trigger')}
        />
        <InsightCard
          tone={trendDelta === null ? 'neutral' : trendDelta >= 0 ? 'good' : 'warn'}
          icon={trendDelta === null || trendDelta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          title="Where are we moving?"
          description={trendDelta === null
            ? 'Daily quality movement needs at least two scored trend points.'
            : `Average quality ${trendDelta >= 0 ? 'improved' : 'declined'} by ${fmtDec(Math.abs(trendDelta), 1)} points from the previous trend point.`}
          meta={latestTrend?.date ? `Latest: ${latestTrend.date}` : 'No trend date'}
        />
        <InsightCard
          tone={leakageCount === null ? 'neutral' : leakageCount > 0 ? 'warn' : 'good'}
          icon={<Target size={14} />}
          title="Where are sales leaking?"
          description={leakageCount === null
            ? 'Sales opportunity and pitch counts were not returned.'
            : leakageCount > 0
              ? `${fmtInt(leakageCount)} opportunities did not receive a pitch in this window.`
              : 'Every returned opportunity has a pitch attempt signal.'}
          meta={pitchRate === null ? 'Pitch rate unavailable' : `Pitch rate ${fmtPct(pitchRate, 0)}`}
          onClick={() => openEvidence('funnel', 'Sales / Mixed Opportunities')}
        />
        <InsightCard
          tone={toneForAvg(lowestAnalyst?.avgScore)}
          icon={<Users size={14} />}
          title="Who needs coaching?"
          description={lowestAnalyst?.agentName
            ? `${lowestAnalyst.agentName} is the lowest returned analyst at ${fmtDec(lowestAnalyst.avgScore, 1)} average quality.`
            : 'No analyst ranking was returned for this filter.'}
          meta={highestAnalyst?.agentName ? `Top returned: ${highestAnalyst.agentName}` : 'No benchmark'}
        />
        <InsightCard
          tone={topRiskProcess && (topRiskProcess.criticalCalls + topRiskProcess.highRiskCalls) > 0 ? 'bad' : 'neutral'}
          icon={<ShieldCheck size={14} />}
          title="Which process has risk?"
          description={topRiskProcess
            ? `${topRiskProcess.process} has ${fmtInt(topRiskProcess.criticalCalls)} critical and ${fmtInt(topRiskProcess.highRiskCalls)} high-risk calls.`
            : 'No process-level risk rows were returned.'}
          meta="Review process controls"
        />
      </section>

      {/* Trend + Risk by process */}
      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {renderChart(
            trend.state,
            trendData.length > 0,
            <TrendLineChart
              data={trendData}
              series={[
                { key: 'avgScore', label: 'Avg Quality', color: '#9D7BFF' },
                { key: 'totalCalls', label: 'Total Calls', color: '#38E1FF' },
              ]}
            />,
          )}
        </div>
        <div>
          <ChartCard
            title="Top 5 risk areas"
            subtitle={riskByProc.state.kind === 'ready' && riskByProc.state.result.kind === 'ok' ? `Grouped by ${riskByProc.state.result.data.dimension ?? 'process'}` : ''}
            loading={riskByProc.state.kind === 'loading'}
            empty={riskByProc.state.kind === 'ready' && (riskByProc.state.result.kind === 'empty' || (riskByProc.state.result.kind === 'ok' && (riskByProc.state.result.data.rows ?? []).length === 0))}
          >
            {renderRiskByProc(riskByProc.state, topRiskRows)}
          </ChartCard>
        </div>
      </section>

      {/* Risk queue preview + Top analysts */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Risk & Compliance Queue"
            subtitle="High-priority triggers. Click a row for evidence."
            loading={riskQueue.state.kind === 'loading'}
            empty={false}
            actions={<button onClick={() => navigate('/risk')} className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong hover:text-ink-primary">View all</button>}
          >
            {renderRiskQueue(riskQueue.state, setOpenRecord)}
          </ChartCard>
        </div>
        <div>
          <ChartCard
            title="Top analysts"
            subtitle="By average quality score (ascending = lowest first)."
            loading={topBottom.state.kind === 'loading'}
            empty={false}
            actions={<button onClick={() => navigate('/analysts')} className="rounded-lg border border-line-subtle bg-elevated/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-secondary hover:border-line-strong hover:text-ink-primary">View all</button>}
          >
            {renderAnalystPreview(topBottom.state)}
          </ChartCard>
        </div>
      </section>

      <EvidenceDrawer record={openRecord} onClose={() => setOpenRecord(null)} />
    </>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toneForAvg(avg: number | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (avg === null || avg === undefined) return 'neutral';
  if (avg >= 85) return 'good';
  if (avg >= 70) return 'warn';
  return 'bad';
}

function renderKpi<T>(
  state: ReturnType<typeof useApi<T>>['state'],
  build: (data: T) => React.ComponentProps<typeof KpiCard>,
): JSX.Element {
  if (state.kind === 'loading') return <KpiCard {...build({} as T)} loading />;
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return (
      <KpiCard
        label="—"
        value="—"
        tone="bad"
        hint={state.result.code || 'error'}
      />
    );
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return (
      <KpiCard
        label="—"
        value="N/A"
        tone="neutral"
        hint={state.result.reason}
      />
    );
  }
  if (state.kind === 'ready' && state.result.kind === 'empty') {
    return <KpiCard {...build({} as T)} value="—" hint="No data in window" />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    return <KpiCard {...build(state.result.data)} />;
  }
  return <KpiCard {...build({} as T)} loading />;
}

function renderChart(
  state: ReturnType<typeof useApi<any>>['state'],
  hasData: boolean,
  body: JSX.Element,
): JSX.Element {
  if (state.kind === 'loading') {
    return <ChartCard title="Daily trend" subtitle="Quality + volume over the selected window" loading />;
  }
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return (
      <ChartCard title="Daily trend" subtitle="Quality + volume over the selected window">
        <ErrorState
          status={state.result.status}
          code={state.result.code}
          message={state.result.message}
        />
      </ChartCard>
    );
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return (
      <ChartCard title="Daily trend" subtitle="Quality + volume over the selected window">
        <UnsupportedState reason={state.result.reason} />
      </ChartCard>
    );
  }
  if (!hasData) {
    return (
      <ChartCard title="Daily trend" subtitle="Quality + volume over the selected window" empty />
    );
  }
  return (
    <ChartCard title="Daily trend" subtitle="Quality + volume over the selected window">
      {body}
    </ChartCard>
  );
}

function renderRiskByProc(
  state: ReturnType<typeof useApi<any>>['state'],
  rows: Array<{ process: string; criticalCalls: number; highRiskCalls: number }>,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (rows.length === 0) {
    return <EmptyState title="No risk by process" description="No process-level risk records in the selected window." />;
  }
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <InsightCard
          key={r.process}
          tone={(r.criticalCalls + r.highRiskCalls) > 0 ? 'bad' : 'neutral'}
          icon={<AlertTriangle size={14} />}
          title={r.process}
          description={`${fmtInt(r.criticalCalls)} critical · ${fmtInt(r.highRiskCalls)} high`}
          meta={`Updated ${shortId(r.process)}`}
        />
      ))}
    </div>
  );
}

function renderRiskQueue(
  state: ReturnType<typeof useApi<any>>['state'],
  setOpen: (r: RiskQueueRecord) => void,
): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    return <RiskQueueTable records={state.result.data.records} onRowClick={setOpen} loading={false} />;
  }
  return <LoadingSkeleton variant="table" rows={6} />;
}

function renderAnalystPreview(state: ReturnType<typeof useApi<any>>['state']): JSX.Element {
  if (state.kind === 'ready' && state.result.kind === 'error') {
    return <ErrorState status={state.result.status} code={state.result.code} message={state.result.message} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'unsupported') {
    return <UnsupportedState reason={state.result.reason} />;
  }
  if (state.kind === 'ready' && state.result.kind === 'ok') {
    const analysts = state.result.data.analysts || [];
    return <AnalystTable analysts={analysts.slice(0, 6)} loading={false} />;
  }
  return <LoadingSkeleton variant="table" rows={6} />;
}

function ExecutivePulseCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  detail: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const toneClasses: Record<typeof tone, string> = {
    good: 'border-good/25 bg-good/10 text-good',
    warn: 'border-warn/25 bg-warn/10 text-warn',
    bad: 'border-bad/25 bg-bad/10 text-bad',
    neutral: 'border-line-subtle bg-elevated/40 text-ink-secondary',
  };

  return (
    <div className="rounded-2xl border border-line-subtle bg-panel/80 p-4 shadow-glass backdrop-blur-glass">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
          <div className="mt-2 truncate text-2xl font-semibold text-ink-primary">{value}</div>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 min-h-[32px] text-xs leading-relaxed text-ink-secondary">{detail}</p>
    </div>
  );
}
