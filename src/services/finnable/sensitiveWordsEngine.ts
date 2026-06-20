/**
 * Finnable Intelligence — Sensitive Words Engine
 *
 * Pure aggregation over the rows returned by repository.fetchSensitiveWordRows().
 * The underlying source columns (db_external.CallDetails) hold pipe-delimited
 * multi-word values for SensitiveWordUsed / TopNegativeWordsByAgent /
 * TopNegativeWordsByCustomer and free-text SensitiveWordContext.
 *
 * This engine:
 *   - tokenises pipe-delimited values into individual terms
 *   - counts term occurrences (top terms by absolute count)
 *   - counts incidents per agent
 *   - returns masked context snippets (no full transcript, no mobile numbers)
 *
 * No DB access, no side effects.
 */
import { maskMobile, maskTranscript } from './mapper';

export interface SensitiveWordRow {
  id: string | number;
  AgentName: string;
  CallDate: string;
  SensitiveWordUsed: string;
  SensitiveWordContext: string;
  TopNegativeWordsByAgent: string;
  TopNegativeWordsByCustomer: string;
  MobileNo: string;
}

export interface SensitiveTermCount {
  term: string;
  count: number;
}

export interface SensitiveAgentCount {
  agentName: string;
  incidentCount: number;
}

export interface SensitiveContextSnippet {
  callId: string;
  maskedContext: string;
  agentName: string;
  callDate: string;
  maskedMobile: string;
}

export interface SensitiveWordsSummary {
  totalRows: number;
  totalIncidents: number;
  byTerm: SensitiveTermCount[];
  byAgent: SensitiveAgentCount[];
  byCustomerTerm: SensitiveTermCount[];
  recentContexts: SensitiveContextSnippet[];
}

const NONE_VALUES = /^(none|null|n\/a|na|not available)$/i;
const MAX_TOP_TERMS = 25;
const MAX_TOP_AGENTS = 25;
const MAX_RECENT_CONTEXTS = 25;

function isNone(value: unknown): boolean {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return true;
  return NONE_VALUES.test(text);
}

/**
 * Split a pipe- or comma-delimited cell into normalised tokens.
 *   "abuse | harassment | cuss"  →  ["abuse", "harassment", "cuss"]
 *   "abuse,harassment"           →  ["abuse", "harassment"]
 *   ""                           →  []
 */
function tokenise(value: unknown): string[] {
  const text = String(value === null || value === undefined ? '' : value);
  if (!text || isNone(text)) return [];
  return text
    .split(/[|,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !isNone(t));
}

function increment(map: Map<string, number>, key: string, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + by);
}

function topN(map: Map<string, number>, n: number): SensitiveTermCount[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

export function buildSensitiveWordsSummary(rows: SensitiveWordRow[]): SensitiveWordsSummary {
  const safeRows = Array.isArray(rows) ? rows : [];
  const byTerm = new Map<string, number>();
  const byCustomerTerm = new Map<string, number>();
  const byAgent = new Map<string, number>();
  let totalIncidents = 0;

  for (const row of safeRows) {
    const agent = String(row.AgentName || '').trim() || 'Unknown';

    const usedTokens = tokenise(row.SensitiveWordUsed);
    if (usedTokens.length > 0) {
      totalIncidents += usedTokens.length;
      increment(byAgent, agent, usedTokens.length);
      usedTokens.forEach(t => increment(byTerm, t));
    }

    const customerTokens = tokenise(row.TopNegativeWordsByCustomer);
    customerTokens.forEach(t => increment(byCustomerTerm, t));

    const agentTokens = tokenise(row.TopNegativeWordsByAgent);
    // agent-side negative words go into the agent bucket too, but
    // do not inflate the global "incidents" counter — that's reserved
    // for explicit SensitiveWordUsed flags from QA.
    if (agentTokens.length > 0) {
      increment(byAgent, agent, agentTokens.length);
    }
  }

  const recentContexts: SensitiveContextSnippet[] = safeRows
    .filter(r => !isNone(r.SensitiveWordContext) && String(r.SensitiveWordContext).trim().length > 0)
    .slice(0, MAX_RECENT_CONTEXTS)
    .map(r => ({
      callId: String(r.id),
      maskedContext: maskTranscript(String(r.SensitiveWordContext)),
      agentName: String(r.AgentName || '').trim() || 'Unknown',
      callDate: String(r.CallDate || '').trim(),
      maskedMobile: maskMobile(r.MobileNo),
    }));

  return {
    totalRows: safeRows.length,
    totalIncidents,
    byTerm: topN(byTerm, MAX_TOP_TERMS),
    byAgent: Array.from(byAgent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOP_AGENTS)
      .map(([agentName, incidentCount]) => ({ agentName, incidentCount })),
    byCustomerTerm: topN(byCustomerTerm, MAX_TOP_TERMS),
    recentContexts,
  };
}