-- EMERGENCY ROLLBACK ONLY: Removes sheets_sync_log table.
-- WARNING: This table references sheets_sync_config; do not drop parent before child,
-- or ensure all child rows are deleted first.
-- DO NOT execute without explicit database backup and DBA approval.

DROP TABLE IF EXISTS `sheets_sync_log`;
