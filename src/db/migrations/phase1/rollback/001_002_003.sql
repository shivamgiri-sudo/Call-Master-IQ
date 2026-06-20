-- ROLLBACK: plan tables (cascade order: dependents first, then parent)
DROP TABLE IF EXISTS `call_plan_glide_milestones`;
DROP TABLE IF EXISTS `call_plan_action_items`;
DROP TABLE IF EXISTS `call_plan_of_action`
