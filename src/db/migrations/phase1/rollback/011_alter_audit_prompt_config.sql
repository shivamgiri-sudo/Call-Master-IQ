-- ROLLBACK: removes columns added by 011 — use only if rolling back Phase 1
ALTER TABLE `audit_prompt_config`
  DROP COLUMN IF EXISTS `provider_code`,
  DROP COLUMN IF EXISTS `provider_config`
