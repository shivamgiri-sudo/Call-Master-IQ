import {
  X, ClipboardCopy, AlertOctagon, CalendarClock, ClipboardCheck, PhoneCall,
  ShieldCheck, Target, User2,
} from 'lucide-react';
import { useEffect } from 'react';
import type { RiskQueueRecord } from '../../api/types';
import { fmtDateTime, fmtDec } from '../../utils/formatters';
import { maskMobile } from '../../utils/safety';
import { priorityClass, qualityBandClass, riskBucketClass } from '../../utils/colors';
import MaskedTranscriptSnippet from './MaskedTranscriptSnippet';

interface EvidenceDrawerProps {
  record: RiskQueueRecord | null;
  onClose: () => void;
}

/**
 * Slides in from the right. Renders a record's evidence.
 *
 * IMPORTANT: No raw transcript. Mobile is masked. Copy button copies a
 * sanitized summary (NOT raw transcript, NOT JWT, NOT password).
 */
export default function EvidenceDrawer({ record, onClose }: EvidenceDrawerProps) {
  useEffect(() => {
    if (!record) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [record, onClose]);

  const open = Boolean(record);
  const safeSummary = record
    ? [
        `Call ${record.id}`,
        record.analyst ? `Analyst: ${record.analyst}` : '',
        record.date ? `Date: ${record.date}` : '',
        record.riskBucket ? `Risk: ${record.riskBucket}` : '',
        record.qualityScore !== undefined && record.qualityScore !== null && record.qualityScore !== 'N/A'
          ? `Score: ${fmtDec(record.qualityScore, 1)} (${record.qualityBand || '—'})`
          : '',
        record.actionPriority ? `Action: ${record.actionPriority} · ${record.actionOwner || '—'} · SLA ${record.actionSla || '—'}` : '',
      ].filter(Boolean).join('\n')
    : '';
  const parameterEvidence = record ? [
    { label: 'Quality band', value: record.qualityBand, tone: qualityBandClass(String(record.qualityBand)) },
    { label: 'Pitch strength', value: record.pitchStrength, tone: 'pill pill-info' },
    { label: 'Leakage', value: record.leakage, tone: record.leakage ? 'pill pill-warn' : 'pill' },
    { label: 'Support status', value: record.supportStatus, tone: 'pill pill-violet' },
    { label: 'Journey stage', value: record.journeyStage, tone: 'pill' },
    { label: 'Risk level', value: record.riskLevel || record.riskBucket, tone: riskBucketClass(record.riskBucket) },
  ].filter(item => item.value && item.value !== 'N/A') : [];

  const onCopySummary = () => {
    if (!safeSummary) return;
    // Deliberately copy ONLY the sanitized summary. Never raw transcript / mobile / JWT.
    void navigator.clipboard.writeText(safeSummary);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-2xl transform border-l border-line-subtle bg-panel/95 shadow-glass-lg backdrop-blur-glass transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal
        aria-label="Evidence drawer"
      >
        {record ? (
          <div className="flex h-full flex-col">
            <header className="flex items-start justify-between border-b border-line-subtle p-5">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-ink-muted">Evidence</div>
                <h3 className="mt-1 truncate text-lg font-semibold text-ink-primary">
                  Call {record.id}
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">{fmtDateTime(record.date)}</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line-subtle bg-elevated/40 text-ink-secondary hover:text-ink-primary focus-ring"
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <section className="rounded-2xl border border-line-subtle bg-elevated/35 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MetaItem icon={<PhoneCall size={14} />} label="Call ID" value={record.id} />
                  <MetaItem icon={<CalendarClock size={14} />} label="Call date" value={fmtDateTime(record.date)} />
                  <MetaItem icon={<User2 size={14} />} label="Analyst" value={record.analyst || '—'} />
                  <MetaItem icon={<ShieldCheck size={14} />} label="Mobile" value={maskMobile(record.mobile) || '—'} />
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] uppercase tracking-wider text-ink-muted">Overview</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Analyst" value={record.analyst || '—'} />
                  <Field label="Mobile" value={maskMobile(record.mobile) || '—'} />
                  <Field label="Call Type" value={record.callType || '—'} />
                  <Field label="Journey Stage" value={record.journeyStage || '—'} />
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] uppercase tracking-wider text-ink-muted">Quality & Risk</h4>
                <div className="flex flex-wrap gap-2">
                  <span className={riskBucketClass(record.riskBucket)}>{record.riskBucket || 'No risk flag'}</span>
                  <span className={qualityBandClass(String(record.qualityBand))}>
                    {record.qualityScore === 'N/A' || record.qualityScore === null || record.qualityScore === undefined
                      ? '—'
                      : `${fmtDec(record.qualityScore, 1)} · ${record.qualityBand || ''}`}
                  </span>
                  <span className={priorityClass(record.actionPriority)}>{record.actionPriority || 'Monitor'}</span>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] uppercase tracking-wider text-ink-muted">Parameter Evidence</h4>
                {parameterEvidence.length ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {parameterEvidence.map(item => (
                      <div key={item.label} className="rounded-xl border border-line-subtle bg-elevated/35 p-3">
                        <div className="mb-2 text-[10px] uppercase tracking-wider text-ink-muted">{item.label}</div>
                        <span className={item.tone}>{String(item.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-line-subtle bg-elevated/35 p-3 text-xs text-ink-muted">
                    No parameter-level evidence was returned for this call.
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] uppercase tracking-wider text-ink-muted">Recommended Action</h4>
                <div className="rounded-xl border border-line-subtle bg-elevated/40 p-4 text-sm text-ink-secondary">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 font-medium text-ink-primary">
                      <ClipboardCheck size={15} className="text-good" />
                      {record.actionOwner || 'Review owner not returned'}
                    </span>
                    <span className="pill pill-info">{record.actionSla || 'Weekly Review'}</span>
                  </div>
                  {record.insight ? (
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{record.insight}</p>
                  ) : (
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                      Review the masked evidence, validate the QA parameter, and assign coaching only when the call context supports it.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={priorityClass(record.actionPriority)}>{record.actionPriority || 'Monitor'}</span>
                    <span className="pill">
                      <Target size={11} className="inline -translate-y-0.5" /> Copy-safe summary available
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] uppercase tracking-wider text-ink-muted">Masked Snippet</h4>
                <MaskedTranscriptSnippet text={(record as any).SensitiveWordContext || (record as any).feedbackContext || ''} />
                <p className="text-[11px] text-ink-muted">
                  <AlertOctagon size={11} className="inline -translate-y-0.5" /> Mobile, OTP, PIN, CVV and long digit runs are masked client-side.
                </p>
              </section>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-line-subtle p-4">
              <button
                onClick={onCopySummary}
                className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-elevated/40 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
              >
                <ClipboardCopy size={14} />
                Copy sanitized summary
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/15 px-3 py-2 text-xs font-medium text-violet transition-colors hover:bg-violet/20 focus-ring"
              >
                Close
              </button>
            </footer>
          </div>
        ) : null}
      </aside>
    </>
  );
}

function MetaItem({ icon, label, value }: { icon: JSX.Element; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line-subtle bg-panel/65 text-ink-secondary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="mt-0.5 truncate text-sm text-ink-primary">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-elevated/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1 truncate text-sm text-ink-primary">{value}</div>
    </div>
  );
}
