import { ClipboardCopy, Target, TrendingUp, User2, X } from 'lucide-react';
import type { TopBottomAgentsData } from '../../api/types';
import { fmtDate, fmtDec, fmtInt, fmtPct } from '../../utils/formatters';
import { copySafeText } from '../../utils/safeExport';

type Analyst = TopBottomAgentsData['analysts'][number];

interface AnalystProfilePanelProps {
  analyst: Analyst | null;
  onClose: () => void;
}

export default function AnalystProfilePanel({ analyst, onClose }: AnalystProfilePanelProps) {
  if (!analyst) return null;

  const pitchRate = analyst.opportunities ? (analyst.pitchAttempts || 0) / analyst.opportunities : null;
  const strongPitchRate = analyst.pitchAttempts ? (analyst.strongPitch || 0) / analyst.pitchAttempts : null;
  const riskRate = analyst.totalCalls ? (analyst.highRiskCount || 0) / analyst.totalCalls : null;
  const weakness = getWeakness(analyst);
  const recommendation = getRecommendation(analyst);

  const copyCoachingSummary = () => {
    copySafeText([
      'Call Master IQ Coaching Summary',
      `Analyst: ${analyst.agentName || 'not returned'}`,
      `Total calls: ${fmtInt(analyst.totalCalls)}`,
      `Average quality: ${analyst.avgScore === null || analyst.avgScore === undefined ? 'not returned' : fmtDec(analyst.avgScore, 1)}`,
      `High-risk count: ${fmtInt(analyst.highRiskCount)}`,
      `Opportunities: ${fmtInt(analyst.opportunities)}`,
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
        <Metric label="Total calls" value={fmtInt(analyst.totalCalls)} />
        <Metric label="Average quality" value={analyst.avgScore === null || analyst.avgScore === undefined ? '—' : fmtDec(analyst.avgScore, 1)} tone={scoreTone(analyst.avgScore)} />
        <Metric label="High risk" value={fmtInt(analyst.highRiskCount)} tone={(analyst.highRiskCount || 0) > 0 ? 'bad' : 'good'} />
        <Metric label="Pitch rate" value={pitchRate === null ? '—' : fmtPct(pitchRate, 0)} tone={pitchRate === null ? 'neutral' : pitchRate >= 0.7 ? 'good' : 'warn'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <TrendingUp size={15} className="text-blue" />
            Sales indicators
          </div>
          <Field label="Opportunities" value={fmtInt(analyst.opportunities)} />
          <Field label="Pitch attempts" value={fmtInt(analyst.pitchAttempts)} />
          <Field label="Strong pitch rate" value={strongPitchRate === null ? '—' : fmtPct(strongPitchRate, 0)} />
          <Field label="Disbursals" value={fmtInt(analyst.disbursals)} />
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
          <div className="mt-3 rounded-lg border border-warn/25 bg-warn/10 p-3 text-xs leading-relaxed text-warn">
            Analyst-specific evidence list and trend endpoint are not available yet. Showing returned summary fields only.
          </div>
        </div>
      </div>
    </section>
  );
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
