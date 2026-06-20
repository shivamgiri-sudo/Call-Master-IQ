# Merge Decision Log — Call Master Enterprise IQ

This file records every significant merge/architecture decision made during the Enterprise IQ consolidation.

| Date | Task | Decision | Rationale | Risk |
|------|------|----------|-----------|------|
| 2026-06-20 | Task 1 — Safety Branch | Baseline commit included 8 pre-existing staged files alongside the two documentation scaffold files. Branch name created as `feature/enterprise-iq-merge`, then renamed to `feature/phase-1-foundation` via direct ref file write due to VS Code holding HEAD.lock. | Files were already staged before Task 1 ran. Branch and HEAD are clean, `git fsck --no-reflogs` passed with no corruption. Resetting/rebasing is not worth the risk at this stage. Direct ref write was safe: both branches pointed to identical commit. | Baseline commit is noisier than ideal. Future reviews must inspect file-level diffs carefully. Each future task must report exact files changed and avoid mixing unrelated work. |
