-- EMERGENCY ROLLBACK ONLY: Removes call_plan_of_action table.
-- WARNING: Dependent tables (call_plan_action_items, call_plan_glide_milestones)
-- must be dropped first, or use DROP ... CASCADE if supported by schema.
-- DO NOT execute without explicit database backup and DBA approval.

DROP TABLE IF EXISTS `call_plan_of_action`;
