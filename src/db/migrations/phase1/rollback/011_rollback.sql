-- EMERGENCY ROLLBACK ONLY: Reverses migration 011 — removes provider_code and provider_config columns.
-- This is a destructive operation; data in these columns will be lost.
-- DO NOT execute without explicit database backup and DBA approval.

ALTER TABLE `audit_prompt_config`
DROP COLUMN IF EXISTS `provider_code`,
DROP COLUMN IF EXISTS `provider_config`;
