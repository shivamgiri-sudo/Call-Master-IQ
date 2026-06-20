-- EMERGENCY ROLLBACK ONLY: Removes sheets_sync_config table.
-- WARNING: This table is referenced by sheets_sync_log; do not drop child before parent,
-- or ensure all child rows are deleted first.
-- DO NOT execute without explicit database backup and DBA approval.

DROP TABLE IF EXISTS `sheets_sync_config`;
