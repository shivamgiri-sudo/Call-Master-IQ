# Final Release Gate Checklist

Status: local validation passed, public release blocked.

## Passed Locally

- Backend TypeScript.
- Backend build.
- Frontend TypeScript.
- Frontend build.
- Runtime smoke.
- Analytics endpoints 15/15.
- RBAC/auth routing.

## Must Remain Blocked Until Closed

- Audit advisories pending.
- Secret rotation pending.
- History cleanup pending.
- Push not approved.
- Public release not approved.

## Pre-Push Checks

- Confirm `.env` is not staged.
- Confirm `node_modules` is not staged.
- Confirm `dist` is not staged.
- Confirm generated docs do not contain live secrets.
- Confirm no raw transcript is exported from UI or API.
- Confirm no raw 500s on new admin/analyst endpoints.

