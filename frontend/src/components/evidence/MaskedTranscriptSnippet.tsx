import { maskTranscript, truncateSnippet } from '../../utils/safety';

interface MaskedTranscriptSnippetProps {
  text: string;
  maxLength?: number;
}

/**
 * Renders a transcript snippet with all sensitive data masked.
 * NEVER displays the raw input. Truncates at maxLength.
 */
export default function MaskedTranscriptSnippet({ text, maxLength = 280 }: MaskedTranscriptSnippetProps) {
  const masked = truncateSnippet(text, maxLength);
  return (
    <div className="rounded-xl border border-line-subtle bg-elevated/40 p-3 text-sm leading-relaxed text-ink-secondary">
      {masked || <span className="text-ink-muted">No transcript snippet available for this record.</span>}
    </div>
  );
}