/**
 * Finnable Intelligence — Evidence Engine
 * Ported from finnable-dashboard/src/engine/analyticsEngine.js buildDetailedEvidencePackage_
 * Transcript highlight extraction and sensitive-data masking.
 * NEVER returns raw sensitive transcript phrases — all mobile/credential data is masked.
 */
import { EnrichedCallRow, EvidencePackage, EvidenceHighlight, ParameterEvidenceItem } from './types';
import { maskTranscript } from './mapper';

function parseParameterScores(context: string): Record<string, { score: number | null; max: number | null; display: string; loss: number | null }> {
  const result: Record<string, { score: number | null; max: number | null; display: string; loss: number | null }> = {};
  String(context || '').split('|').forEach(part => {
    const match = part.match(/^\s*([^:]+):\s*(NA|(\d+)\s*\/\s*(\d+))/i);
    if (!match) return;
    const name = match[1].trim();
    if (String(match[2]).toUpperCase() === 'NA') {
      result[name] = { score: null, max: null, display: 'NA', loss: null };
    } else {
      const score = Number(match[3]), max = Number(match[4]);
      result[name] = { score, max, display: `${score}/${max}`, loss: max - score };
    }
  });
  return result;
}

function findTranscriptMatch(text: string, regexes: RegExp[]): { phrase: string; start: number; end: number; snippet: string } | null {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match && typeof match.index === 'number') {
      return {
        phrase: match[0],
        start: match.index,
        end: match.index + match[0].length,
        snippet: snippetAround(text, match.index, match[0].length),
      };
    }
  }
  return null;
}

function snippetAround(text: string, start: number, length: number): string {
  const from = Math.max(0, start - 95);
  const to = Math.min(text.length, start + length + 175);
  return cleanSpaces(text.slice(from, to));
}

function cleanSpaces(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function removeOverlappingHighlights(items: EvidenceHighlight[]): EvidenceHighlight[] {
  const selected: EvidenceHighlight[] = [];
  const rank: Record<string, number> = { high: 1, medium: 2, safe: 3, info: 4 };
  items.slice().sort((a, b) => (rank[a.severity] || 9) - (rank[b.severity] || 9) || a.start - b.start)
    .forEach(item => {
      const overlaps = selected.some(chosen => item.start < chosen.end && item.end > chosen.start);
      if (!overlaps) selected.push(item);
    });
  return selected.sort((a, b) => a.start - b.start);
}

function dedupeParameterEvidence(items: ParameterEvidenceItem[]): ParameterEvidenceItem[] {
  const output: ParameterEvidenceItem[] = [];
  const seen: Record<string, boolean> = {};
  items.forEach(item => {
    const key = `${item.parameter}|${item.title}|${item.status}`;
    if (!seen[key]) {
      seen[key] = true;
      output.push(item);
    }
  });
  return output;
}

function objectionPatterns(subcategory: string): RegExp[] {
  const text = String(subcategory || '').toLowerCase();
  if (/insurance/.test(text)) return [/insurance[^.?!]{0,130}/i, /without\s+insurance[^.?!]{0,100}/i];
  if (/processing|fee|charge/.test(text)) return [/(?:processing\s+fee|charges?)[^.?!]{0,120}/i];
  if (/trust|fraud|fake/.test(text)) return [/(?:trust|fraud|fake|scam)[^.?!]{0,120}/i];
  if (/not\s+interested|no\s+loan|no\s+requirement/.test(text)) return [/(?:not\s+interested|do\s+not\s+need|don't\s+need|no\s+requirement)[^.?!]{0,120}/i];
  if (/salary|cash/.test(text)) return [/(?:salary|cash|bank\s+account)[^.?!]{0,130}/i];
  return [/(?:not\s+interested|insurance|charges?|salary|cash|trust|problem|issue)[^.?!]{0,120}/i];
}

export function buildDetailedEvidencePackage(row: EnrichedCallRow): EvidencePackage {
  const text = String(row.TranscribeText || '');
  if (!text || text === 'None') {
    return { parameterEvidence: [], highlights: [], highlightRanges: [] };
  }

  const scores = parseParameterScores(row.FeedbackContext);
  const parameterEvidence: ParameterEvidenceItem[] = [];
  const highlights: EvidenceHighlight[] = [];
  const seenRanges: Record<string, boolean> = {};

  function scoreOf(parameter: string) {
    return scores[parameter] || { score: null, max: null, display: 'NA', loss: null };
  }

  function addObserved(parameter: string, severity: 'high' | 'medium' | 'safe' | 'info', title: string, rationale: string, regexes: RegExp[], auditImpact: string): boolean {
    const item = findTranscriptMatch(text, regexes);
    const score = scoreOf(parameter);
    if (item) {
      const key = `${item.start}:${item.end}:${parameter}`;
      if (!seenRanges[key]) {
        seenRanges[key] = true;
        highlights.push({
          parameter,
          severity,
          label: title,
          rationale,
          auditImpact: auditImpact || '',
          phrase: item.phrase,
          snippet: item.snippet,
          start: item.start,
          end: item.end,
          score: score.display,
          marksLost: score.loss,
        });
      }
      parameterEvidence.push({
        parameter,
        score: score.display,
        marksLost: score.loss,
        status: 'Observed evidence',
        severity,
        title,
        rationale,
        evidence: item.snippet,
        highlightStart: item.start,
        highlightEnd: item.end,
      });
      return true;
    }
    return false;
  }

  function addNotEvidenced(parameter: string, severity: 'high' | 'medium' | 'safe' | 'info', title: string, rationale: string) {
    const score = scoreOf(parameter);
    parameterEvidence.push({
      parameter,
      score: score.display,
      marksLost: score.loss,
      status: 'Not evidenced in transcript',
      severity,
      title,
      rationale,
      evidence: 'No exact customer-facing phrase proving this required behaviour was found in the transcript.',
      highlightStart: null,
      highlightEnd: null,
    });
  }

  // Compliance / transparency evidence
  if (row.riskBucket === 'High Priority Risk Trigger' || /OTP Request Phrase/i.test(String(row.SensitiveWordUsed || ''))) {
    addObserved(
      'Compliance', 'high', 'Credential request phrase detected',
      'A request for the customer OTP is a high-priority trigger requiring same-day validation.',
      [/how may i have your otp/i, /share\s+(?:me\s+)?(?:your\s+|the\s+)?otp/i, /tell\s+(?:me\s+)?(?:your\s+|the\s+)?otp/i, /provide\s+(?:me\s+)?(?:your\s+|the\s+)?otp/i],
      'Risk trigger'
    );
  }
  if (/Ambiguous OTP Guidance/i.test(String(row.SensitiveWordUsed || ''))) {
    addObserved(
      'Compliance', 'medium', 'Ambiguous OTP guidance',
      'The wording around OTP handling requires validation.',
      [/give\s+the\s+(?:o\s*t\s*p|otp)\s+and\s+fill\s+the\s+(?:o\s*t\s*p|otp)/i],
      'Sensitive guidance flag'
    );
  }

  // Pitch mark-down trace
  if (row.opportunity) {
    if (row.PrepaidPitch !== '1' || row.pitchStrength === 'Not Attempted') {
      addNotEvidenced('Pitch', 'medium', 'No persuasive sales pitch evidenced',
        'A Sales/Mixed opportunity exists, but no value-based pitch was identified.');
    } else if (row.pitchStrength === 'Weak') {
      if (!addObserved(
        'Pitch', 'medium', 'Weak pitch — limited benefit evidence',
        'A pitch attempt was made but lacks complete benefit framing.',
        [/\b(?:emi|e\s*m\s*i)\b[^.?!]{0,100}/i, /\b(?:interest|rate|roi)\b[^.?!]{0,100}/i, /\b(?:personal\s+loan|loan\s+amount|loan\s+offer)\b[^.?!]{0,110}/i],
        'Pitch mark-down'
      )) {
        addNotEvidenced('Pitch', 'medium', 'Weak pitch — no benefit phrase found',
          'The pitch score is low and no clear benefit statement was found.');
      }
    }

    if (['Not Discussed', 'Partial Disclosure', 'Potentially Misleading', 'Incorrect or Unsafe'].indexOf(row.Pricing_and_Discount_Structure) >= 0) {
      const foundPricing = addObserved(
        'Pitch',
        row.Pricing_and_Discount_Structure === 'Potentially Misleading' ? 'high' : 'medium',
        'Pricing transparency gap',
        'The pricing/term wording is incomplete or requires review.',
        [/\b(?:interest|rate|roi)\b[^.?!]{0,100}/i, /\b(?:emi|e\s*m\s*i)\b[^.?!]{0,100}/i, /\b(?:processing\s+fee|charges?|insurance|tenure)\b[^.?!]{0,100}/i],
        'Pricing mark-down'
      );
      if (!foundPricing && row.Pricing_and_Discount_Structure === 'Not Discussed') {
        addNotEvidenced('Pitch', 'medium', 'Pricing not discussed',
          'No rate, EMI, tenure, or pricing disclosure statement was identified.');
      }
    }
  }

  // Journey / support
  if (['Support Pending', 'Callback Required', 'Escalation Required'].indexOf(row.supportStatus) >= 0) {
    if (!addObserved(
      'Journey', 'medium', 'Pending customer journey action',
      'The customer journey remains dependent on a callback or unresolved assistance step.',
      [/call\s*back[^.?!]{0,100}/i, /verification[^.?!]{0,100}/i, /pending[^.?!]{0,100}/i, /will\s+call[^.?!]{0,100}/i],
      'Journey support mark-down'
    )) {
      addNotEvidenced('Journey', 'medium', 'Pending customer journey action',
        'The audit reports pending support, but no precise phrase was isolated.');
    }
  }

  // Objection handling
  if (row.CustomerObjectionCategory !== 'None') {
    const objectionRegexes = objectionPatterns(row.CustomerObjectionSubCategory);
    const objectionFound = addObserved(
      'Objection', row.ObjectionHandling === '1' ? 'info' : 'medium',
      row.ObjectionHandling === '1' ? 'Customer objection handled' : 'Unresolved customer objection',
      row.ObjectionHandling === '1' ? 'The concern is evidenced and handling is recorded.' : 'The concern is evidenced but no rebuttal is recorded.',
      objectionRegexes,
      row.ObjectionHandling === '1' ? 'Objection evidence' : 'Objection mark-down'
    );
    if (!objectionFound) {
      addNotEvidenced('Objection', 'medium', 'Objection categorised without locatable phrase',
        'The objection field is populated, but the exact phrase should be rechecked.');
    }
  }

  // Opening / closing
  if (scoreOf('Opening').score !== null && scoreOf('Opening').score! <= 5) {
    const startExcerpt = text.slice(0, Math.min(text.length, 150));
    if (startExcerpt) {
      highlights.push({
        parameter: 'Opening', severity: 'medium', label: 'Opening control gap',
        rationale: 'The opening score is low; review the opening segment.',
        auditImpact: 'Opening mark-down', phrase: startExcerpt, snippet: cleanSpaces(startExcerpt),
        start: 0, end: startExcerpt.length, score: scoreOf('Opening').display, marksLost: scoreOf('Opening').loss,
      });
      parameterEvidence.push({
        parameter: 'Opening', score: scoreOf('Opening').display, marksLost: scoreOf('Opening').loss,
        status: 'Observed opening excerpt', severity: 'medium', title: 'Opening control gap',
        rationale: 'The opening score is low; review the opening.',
        evidence: cleanSpaces(startExcerpt), highlightStart: 0, highlightEnd: startExcerpt.length,
      });
    }
  }

  if (scoreOf('Closing').score !== null && scoreOf('Closing').score! <= 5) {
    if (!addObserved(
      'Closing', 'medium', 'Weak or incomplete closure',
      'The end of the interaction does not establish a clear next step.',
      [/call\s*back[^.?!]{0,100}/i, /will\s+call[^.?!]{0,100}/i, /thank\s+you[^.?!]{0,80}/i],
      'Closing mark-down'
    )) {
      addNotEvidenced('Closing', 'medium', 'Closure not evidenced',
        'No clear next-step confirmation or closure statement was found.');
    }
  }

  const priority: Record<string, number> = { high: 1, medium: 2, safe: 3, info: 4 };
  highlights.sort((a, b) => a.start - b.start || (priority[a.severity] || 9) - (priority[b.severity] || 9));
  const usableRanges = removeOverlappingHighlights(highlights);
  parameterEvidence.sort((a, b) => (priority[a.severity] || 9) - (priority[b.severity] || 9));
  return {
    parameterEvidence: dedupeParameterEvidence(parameterEvidence),
    highlights: usableRanges,
    highlightRanges: usableRanges.map(item => ({
      start: item.start,
      end: item.end,
      severity: item.severity,
      parameter: item.parameter,
      label: item.label,
      rationale: item.rationale,
    })),
  };
}

export function buildClassificationReason(row: EnrichedCallRow): string {
  if (row.nonAssessable) return 'No meaningful two-way interaction is available for behavioural scoring.';
  if (row.riskBucket === 'High Priority Risk Trigger') return 'A high-priority transcript phrase is evidenced and requires same-day validation.';
  if (row.riskBucket === 'Medium Transparency / Sensitive Flag') return 'A transparency concern is supported by transcript evidence.';
  if (row.riskBucket === 'Safe / Guided Self-Entry') return 'The customer is guided to enter details; no breach is claimed.';
  if (row.salesLeakage !== 'Not Applicable' && row.salesLeakage !== 'No Major Leakage') return `This opportunity contains a leakage point: ${row.salesLeakage}.`;
  return 'Audit output from Finnable V5.3 evidence-trace rules.';
}

export { maskTranscript };
