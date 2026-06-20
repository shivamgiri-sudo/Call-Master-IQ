-- EMERGENCY ROLLBACK ONLY: Removes call_plan_glide_milestones table.
-- WARNING: This table references call_plan_of_action; do not drop parent before child,
-- or ensure all child rows are deleted first.
-- DO NOT execute without explicit database backup and DBA approval.

DROP TABLE IF EXISTS `call_plan_glide_milestones`;
