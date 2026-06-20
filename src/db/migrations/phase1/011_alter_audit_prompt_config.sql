ALTER TABLE `audit_prompt_config`
  ADD COLUMN IF NOT EXISTS `provider_code`   VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `provider_config` JSON NULL
