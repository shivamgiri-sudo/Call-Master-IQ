/**
 * Finnable Intelligence — Analytics Adapter Resolver
 * Process-aware routing: Finnable engine for Finnable client/process, generic otherwise.
 * No endpoint is hardwired to Finnable-only; all routes check process context.
 */
import { DEFAULT_CLIENT_ID } from './types';

export type AnalyticsAdapter = 'finnable' | 'generic';

export interface AdapterContext {
  client_id?: string | number;
  process_name?: string;
}

export function resolveAnalyticsAdapter(context: AdapterContext): AnalyticsAdapter {
  const clientId = String(context.client_id ?? '');
  const finnableClientId = String(process.env.FINNABLE_CLIENT_ID ?? DEFAULT_CLIENT_ID);
  if (clientId && clientId === finnableClientId) return 'finnable';
  if (context.process_name === 'Finnable') return 'finnable';
  return 'generic';
}
