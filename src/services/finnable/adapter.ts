/**
 * Finnable Intelligence — Analytics Adapter Resolver
 * Process-aware routing: Finnable engine for Finnable client/process, generic otherwise.
 * No endpoint is hardwired to Finnable-only; all routes check process context.
 */
import { DEFAULT_CLIENT_ID } from './types';

export type AnalyticsAdapter = 'finnable' | 'generic';

export interface AdapterContext {
  client_id?: string;
  process_name?: string;
}

export function resolveAnalyticsAdapter(context: AdapterContext): AnalyticsAdapter {
  if (context.client_id === DEFAULT_CLIENT_ID) return 'finnable';
  if (context.process_name === 'Finnable') return 'finnable';
  return 'generic';
}
