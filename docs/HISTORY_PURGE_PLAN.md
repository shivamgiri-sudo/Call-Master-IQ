# History Purge Plan — `folder/path/.env` Credential Exposure

> **DO NOT FORCE-PUSH YET.** This document is a review-and-approval plan, not an action plan. Steps are sequenced so that the irreversible step (`git push --force`) happens **last**, only after the operator confirms DB password + JWT secret rotation is complete and the team agrees on the repository-level remediation strategy.

---

## 1. What happened (incident summary)

**Commit `d9d0abe`** ("initial commit — existing codebase + Call Master specs and plans") included `folder/path/.env` with the production DB password and JWT secret in plaintext.

**Commit `7c66911`** ("security: redact hardcoded credentials …") replaced the working-tree contents of that file with placeholders, and added `verify_data*.js` and `folder/` to `.gitignore`.

**The exposure is in git history**, not in the current working tree. The current `folder/path/.env` on disk contains placeholders only. But:

```bash
git show d9d0abe:folder/path/.env
```

returns the original plaintext password to anyone with read access to the repo.

**The redaction is also a forensic signal.** Future attackers scanning the public repo for `.env`-shaped files will see `folder/path/.env` exists, run `git log -p -- folder/path/.env`, and recover the original plaintext from the first commit.

## 2. Required precursor — credential rotation

> These two operations **must complete before any history rewrite** so that the old credentials stop working at the source.

| Credential | Owner | Action | Verification |
|---|---|---|---|
| MySQL `DB_PASSWORD` (Shivamgiri / db_audit / db_external) | Operator / DBA | Generate new password. Update at MySQL server level. Update local `.env` only after server-side rotation. | Try connecting with old password → must FAIL. Try with new → must SUCCEED. |
| `JWT_SECRET` | Operator | Generate ≥ 32-char random secret. Update at server-side env (if multi-instance). Update local `.env`. | Issue a token with old secret → server must REJECT. New secret → ACCEPT. |
| Anthropic / OpenAI / Gemini keys (Phase 4) | Operator | Same procedure if any were ever written into tracked files. (Spot-check: `git log -p --all -S 'sk-' -- '*.env'` etc.) | n/a |

**Once rotated, the historical leak becomes moot** — but it is still recoverable until history is rewritten. That is why both rotation AND history-rewrite are needed.

## 3. Decision — Option A vs Option B

> **The user has not yet chosen.** Both options are documented below for review.

### Option A — `git filter-repo` on the existing repo + force-push

**What it does:** Rewrites git history to remove `folder/path/.env` from every commit. Force-pushes the cleaned history to `origin/main`. Existing clones (developer machines, CI caches) must be re-cloned.

**When to use:**
- Repo is young (≤ a few dozen contributors with cloned copies)
- No external integrations depend on commit SHAs (CI pinning, GitHub PRs referencing commits, release tags, dep-tracking that pins by SHA)
- Team can be notified to re-clone

**Risks:**
- Force-push changes every commit SHA. Anyone with an unpushed commit loses their branch (mitigated by `git push --force-with-lease` after explicit check).
- GitHub will **drop** all PRs that referenced the old SHAs (recreate them, no automated recovery).
- GitHub Action / Dependabot pins referencing SHAs break.
- Anyone who forked the repo before the rewrite will have the original history. (Mitigation: GitHub repo settings → "Force fork cleanup" if available; otherwise rely on forks being private / temporary.)
- **Public clone via `git clone` retains the leaked data on every clone that completed before the force-push**. Anyone who cloned before the rewrite still has the credentials. Only the repo on GitHub loses them.

**Tool:** [`git-filter-repo`](https://github.com/newren/git-filter-repo) (the modern, maintained successor to `git filter-branch` and `BFG`).

### Option B — Fresh clean repo + history import

**What it does:**
1. Create a new GitHub repo (`Call-Master-IQ-v2` or similar).
2. Build a fresh root commit that contains only the **current** working tree of `main` (post-redaction, post-Phase-2-Task-3-closure).
3. Add a squash-imported commit with the **current** code.
4. Archive the old repo as read-only.
5. Re-point any CI / webhooks / GitHub Pages / issue trackers.

**When to use:**
- Repo has many external integrators, or SHA-pinning is widely used.
- The "blast radius" of a force-push is too high to tolerate.
- You can afford to lose the historical commit graph (most one-time contributors will not care; the release notes / changelog in the new repo is reconstructed manually).

**Costs:**
- Lose the entire git history of decisions, issues, debugging breadcrumbs.
- Lose the ability to bisect or inspect "why was this line added" beyond what's documented in `docs/`.
- Lose PR history (PR titles, review comments) on the new repo.
- Operational cost: every external pointer (CI, badges, release URLs) needs to be re-pointed.

### Decision criteria (operator chooses)

| Question | If YES → | If NO → |
|---|---|---|
| Do fewer than 5 people have active clones of the repo? | A | B |
| Do you have pinned CI actions / SHAs / Dependabot that would break? | B | A |
| Is git history valuable for forensic / archaeology / bisect? | A | B |
| Are there active PRs from external contributors? | B (close + reopen on new repo) | A |
| Is there a release / changelog pinned to specific commits? | B (rebuild release notes) | A |

**My recommendation (subject to operator override): Option A.** Repo is young, single-org, MVP-stage. The force-push cost is low. The history value is moderate but can be preserved within a single repo by being careful about force-push.

## 4. Option A — exact commands (NOT to be executed yet)

> Pre-flight: confirm operator has rotated DB password and JWT secret.

### Step 4.1 — backup everything before doing anything irreversible

```bash
# Local backup of full repo state including reflog
cp -r /path/to/Call-Master-IQ /path/to/Call-Master-IQ.backup-pre-history-purge
cd /path/to/Call-Master-IQ

# Bundle the current state into a portable file
git bundle create /path/to/Call-Master-IQ.backup.bundle --all
```

### Step 4.2 — install `git-filter-repo`

```bash
pip install git-filter-repo
# OR
brew install git-filter-repo
# OR follow https://github.com/newren/git-filter-repo#installation
```

### Step 4.3 — run filter-repo to remove the offending path from all commits

```bash
# Run from repo root, on the feature branch first (safe — no force-push yet)
git checkout feature/mvp-final-validation-and-frontend
git filter-repo --invert-paths --path folder/path/.env
```

**Expected effect:** All commits that ever contained `folder/path/.env` are rewritten to remove that path. Commit SHAs change. `folder/path/.env` is no longer in any commit reachable from any ref.

**Verify:**

```bash
# No commit should reference folder/path/.env anymore
git log --all --oneline -- folder/path/.env
# (should print nothing)

# Working-tree file should still exist on disk (git rm --cached preserved it)
ls -la folder/path/.env
```

### Step 4.4 — verify the password is no longer recoverable

```bash
# Should return empty
git log --all -p | grep -E 'DB_PASSWORD=|JWT_SECRET=|call_master_super_secret_change_this' || echo "OK: no plaintext credential assignments in any reachable commit"

# Sweep for any other tracked-file history leak
git log --all -p | grep -E "(DB_PASSWORD|JWT_SECRET)\s*=" | grep -v placeholder || echo "OK: no leaked credential assignments"
```

### Step 4.5 — force-push the cleaned branch

> This is the irreversible step. Verify DB password + JWT secret rotation is complete before proceeding.

```bash
# Push feature branch first (non-destructive if it's the only one)
git push --force-with-lease origin feature/mvp-final-validation-and-frontend

# After team ack, push main
git checkout main
git push --force-with-lease origin main
```

### Step 4.6 — post-push communication

Notify every developer with a clone:
```bash
# On every dev machine:
cd /path/to/Call-Master-IQ
git fetch origin
git reset --hard origin/main   # or origin/feature/mvp-final-validation-and-frontend
```

Anyone with **uncommitted local work** must `git stash` first.

### Step 4.7 — verify on GitHub

1. Open `https://github.com/shivamgiri-sudo/Call-Master-IQ/commits/main` — SHAs should all have changed.
2. Browse the file tree — `folder/path/.env` should not appear.
3. Use a fresh clone on a separate machine:
   ```bash
   cd /tmp && git clone https://github.com/shivamgiri-sudo/Call-Master-IQ.git fresh-clone
   cd fresh-clone
   git log --all -p | grep -E 'DB_PASSWORD=|JWT_SECRET=' || echo "OK: clean clone is credential-free"
   ```

## 5. Option B — exact commands (NOT to be executed yet)

```bash
# 1. Create new repo on GitHub: Call-Master-IQ-v2 (private)
# 2. From current working tree, build a fresh history
cd /path/to/Call-Master-IQ
git remote add v2 https://github.com/shivamgiri-sudo/Call-Master-IQ-v2.git
git checkout --orphan fresh-main
git add -A
git commit -m "feat: Call Master Enterprise IQ — post Phase 2 Task 3 closure MVP"
git push v2 fresh-main:main
# 3. Archive old repo: GitHub → Settings → Archive this repository
# 4. Re-point any CI / webhooks / Pages to new repo URL
```

## 6. What I will do when you give the green light

Tell me which option (A or B). Confirm the password rotation step is done. I will then:

1. Run the `backup` step.
2. Run the `git filter-repo` step.
3. Verify with `git log --all -p | grep` to confirm no plaintext leaks remain.
4. Stop and show you the verification output before any force-push.
5. Wait for your explicit go-ahead on the force-push.
6. Communicate the post-push reset to the team.

I will **never** `git push --force` without that explicit step-6 confirmation.

---

## 7. What this plan does NOT cover

- Removing credentials from forks / clones that happened before the rewrite. Those require either repo takedown + recreation (extreme) or accepting that the original leak window included those forks.
- Removing credentials from CI caches, GitHub Actions logs, Dependabot alerts, or any third-party services that indexed the repo (e.g., search engines, code-search aggregators).
- Removing the credentials from any user who `git clone`d before the rewrite.
- The .claude/settings.local.json reference to the password (also redacted in commit `7c66911`); same purge plan applies if that file ever appeared in plaintext in any commit. (Spot-check needed.)

These are operator-level follow-ups beyond the git-history rewrite.
