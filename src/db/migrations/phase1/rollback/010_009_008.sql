-- ROLLBACK: sheets tables (run AFTER dependent FK tables are dropped)
DROP TABLE IF EXISTS `sheets_sync_log`;
DROP TABLE IF EXISTS `sheets_sync_config`
