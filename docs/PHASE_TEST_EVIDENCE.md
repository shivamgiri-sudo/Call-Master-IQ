# Phase Test Evidence — Call Master Enterprise IQ

This file records build results, smoke test outputs, and exit-criteria evidence for each phase.

> **Task numbering note:** Claude's internal sequential task counter (Task 1, Task 2, Task 3…) does not map 1-to-1 to the approved phase plan task labels. The approved Phase 1 plan has: safety branch, docs scaffold, migration runner, SQL files 001–011, dry-run + backup gate, requireTables middleware, 3 P0 fixes, final build + smoke test. Claude combined the docs scaffold into the safety branch task and labelled the migration runner as "Task 3". All approved deliverables are present; only the numbering label differs. Future task reports will reference the approved deliverable name, not the sequential counter.

## Phase 1 — Foundation, Safety & Schema

| Check | Command | Expected | Actual | Pass/Fail |
|-------|---------|----------|--------|-----------|
| Safety branch created | `git branch --show-current` | `feature/phase-1-foundation` | `feature/phase-1-foundation` | ✅ |
| Baseline commit | `git rev-parse HEAD` (at task 1 end) | `edb72d7` | `edb72d7245ebf8c64c368cc488b65297b9f11c23` | ✅ |
| Docs scaffold committed | `git show --stat edb72d7` | MERGE_DECISION_LOG.md + PHASE_TEST_EVIDENCE.md | Both files present | ✅ |
| Migration runner build | `npm run build` | exit 0 | exit 0, 0 errors | ✅ |
| Phase 1 dry-run (empty dir) | `npm run migrate:phase1:dry-run` | exit 0, "No SQL files found" | exit 0, "No SQL files found in phase 1 directory." | ✅ |
| Phase 4 dry-run (empty dir) | `npm run migrate:phase4:dry-run` | exit 0, "No SQL files found" | exit 0, "No SQL files found in phase 4 directory." | ✅ |
| Phase 1 dry-run (11 SQL files) | `npm run migrate:phase1:dry-run` | exit 0, all 11 files listed, zero DB calls | exit 0, all 11 WOULD APPLY lines printed, no pool.execute issued (verified against unreachable host 192.168.10.42) | ✅ |
| Phase 4 dry-run (empty dir, re-verify) | `npm run migrate:phase4:dry-run` | exit 0, "No SQL files found" | exit 0, confirmed no regression after dry-run fix | ✅ |

## Phase 1 — Pre-Migration Evidence (pre-flight, captured before live run)

> Captured against 192.168.10.6 / Shivamgiri. Live migration NOT yet run. Awaiting operator backup confirmation.

### SHOW CREATE TABLE audit_prompt_config (pre-migration)

```sql
CREATE TABLE `audit_prompt_config` (
  `prompt_id` int NOT NULL AUTO_INCREMENT,
  `client_id` varchar(50) NOT NULL,
  `process_name` varchar(255) DEFAULT NULL,
  `business_lob` varchar(100) DEFAULT NULL,
  `source_type` enum('Inbound','Outbound','Chat','Email') NOT NULL,
  `prompt_version` int DEFAULT '1',
  `system_prompt` mediumtext NOT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` varchar(100) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`prompt_id`),
  KEY `idx_apc_client` (`client_id`),
  KEY `idx_apc_lob` (`business_lob`),
  KEY `idx_apc_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

### Row count (pre-migration)

| table | rows |
|-------|------|
| audit_prompt_config | 27 |

### Columns (pre-migration) — audit_prompt_config

| COLUMN_NAME | DATA_TYPE | IS_NULLABLE |
|-------------|-----------|-------------|
| prompt_id | int | NO |
| client_id | varchar | NO |
| process_name | varchar | YES |
| business_lob | varchar | YES |
| source_type | enum | NO |
| prompt_version | int | YES |
| system_prompt | mediumtext | NO |
| is_active | tinyint | YES |
| created_by | varchar | YES |
| created_at | timestamp | YES |
| updated_by | varchar | YES |
| updated_at | timestamp | YES |

> `provider_code` and `provider_config` columns are **absent** — confirms migration 011 has not been applied.

### Table existence check (pre-migration)

| table_name | exists |
|------------|--------|
| app_notification | ✅ |
| call_best_call_library | ✅ |
| call_plan_action_items | ✅ |
| call_plan_glide_milestones | ✅ |
| call_plan_of_action | ✅ |
| daily_insight | ✅ |
| qa_intervention | ✅ |
| qa_watch_list | ✅ |
| sheets_sync_config | ✅ |
| sheets_sync_log | ✅ |
| schema_migrations | ❌ (does not exist — will be created by runner) |

### Dry-run output (pre-migration, step 3 of pre-flight)

```
[dry-run] Phase 1 — no changes will be made to the database

[dry-run] WOULD APPLY: 001_create_call_plan_of_action.sql
[dry-run] WOULD APPLY: 002_create_call_plan_action_items.sql
[dry-run] WOULD APPLY: 003_create_call_plan_glide_milestones.sql
[dry-run] WOULD APPLY: 004_create_call_best_call_library.sql
[dry-run] WOULD APPLY: 005_create_daily_insight.sql
[dry-run] WOULD APPLY: 006_create_qa_intervention.sql
[dry-run] WOULD APPLY: 007_create_qa_watch_list.sql
[dry-run] WOULD APPLY: 008_create_sheets_sync_config.sql
[dry-run] WOULD APPLY: 009_create_sheets_sync_log.sql
[dry-run] WOULD APPLY: 010_create_app_notification.sql
[dry-run] WOULD APPLY: 011_alter_audit_prompt_config.sql

[migrate] Phase 1 dry-run complete. No database changes made.
```

Exit 0. Zero DB connections made.

### Safety scan results

| Check | Result |
|-------|--------|
| `db_audit` referenced in any phase1 SQL? | NONE FOUND |
| `db_external` referenced in any phase1 SQL? | NONE FOUND |
| `DROP TABLE` / `TRUNCATE` / `DELETE FROM` in apply files? | NONE FOUND |
| Migration 011 DDL — columns added | `provider_code VARCHAR(50) NULL`, `provider_config JSON NULL` — both nullable, additive only |
| Existing rows affected? | No — nullable columns, no DEFAULT required, no UPDATE |

### Pre-flight verdict

- ✅ DB connectivity confirmed (MySQL 8.0.42, Shivamgiri)
- ✅ 10 of 11 target tables already exist (001–010 will be no-ops)
- ✅ Migration 011 is the only real DDL change — two nullable column additions
- ✅ 27 rows in `audit_prompt_config` — none will be modified
- ✅ No dangerous SQL in any apply file
- ✅ Dry-run exits 0 with all 11 files listed
- ⏳ **Awaiting backup confirmation before live run is authorized**
