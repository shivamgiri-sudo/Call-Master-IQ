ALTER TABLE `audit_prompt_config`
  ADD COLUMN `provider_code`   VARCHAR(50) NULL,
  ADD COLUMN `provider_config` JSON NULL
