# Admin User Management API

Status: implemented as safe read-only APIs.

Base path: `/api/admin`

All endpoints require the existing bearer-token auth middleware and admin read access. Responses use the standard `{ success, data }` envelope.

## Endpoints

- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `GET /api/admin/roles`
- `GET /api/admin/permissions`
- `GET /api/admin/role-matrix`

## Query Parameters

`GET /api/admin/users` supports:

- `search`
- `role`
- `status`
- `limit`

## Tables Used

- `user_master`
- `role_master`
- `user_scope_mapping`

## Fields Exposed

- `id`
- `name`
- `email`
- `loginId`
- `role`
- `roleName`
- `status`
- `branch`
- `process`
- `createdAt`
- `lastLoginAt`

## Fields Intentionally Hidden

- password fields
- password hashes
- reset tokens
- JWTs
- secrets
- API keys

## Mutations

No delete endpoint is implemented. Role/status mutation endpoints remain out of scope until schema and authorization rules are explicitly approved.

