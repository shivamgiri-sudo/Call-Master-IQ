/**
 * qualityBuckets.ts — narrow type re-export used by colors.ts.
 *
 * Kept as its own module so the dependency direction stays clean
 * (utils/colors.ts imports only types, not values, from here).
 */

export type QualityBand =
  | 'Excellent'
  | 'Good'
  | 'Improvement Required'
  | 'High Risk'
  | 'Critical Coaching'
  | 'Non-Assessable'
  | 'Limited Evidence';

export type RiskBucket =
  | 'High Priority Risk Trigger'
  | 'Medium Transparency / Sensitive Flag'
  | 'Safe / Guided Self-Entry'
  | 'No Risk Flag';