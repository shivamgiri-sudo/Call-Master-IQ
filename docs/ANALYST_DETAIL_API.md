# Analyst Detail API

Status: implemented for Finnable analytics adapter with honest unsupported responses for unsupported adapters.

Base path: `/api/analytics/analysts/:analystId`

All endpoints require the existing bearer-token auth and scope middleware. Responses use the standard analytics envelope.

## Endpoints

- `GET /api/analytics/analysts/:analystId/summary`
- `GET /api/analytics/analysts/:analystId/trend`
- `GET /api/analytics/analysts/:analystId/evidence`
- `GET /api/analytics/analysts/:analystId/coaching`

## Query Parameters

- `from`
- `to`
- `client_id` or `clientId`
- `process_name` or `process`
- `branch_short_name` or `branch`
- `source_type` or `sourceType`
- `business_lob`
- `limit`
- `offset`

## Data Sources

- Read-only Finnable `db_external.CallDetails` access through existing guarded repository functions.
- Agent display-name mapping through app DB lookup.

## Analyst Matching

Analyst matching supports displayed analyst name, source `AgentName`, and mapped employee-code/name values where available.

## Evidence Safety

Evidence returns safe light records only. It does not return raw transcript text. Mobile values and snippets remain masked by the existing analytics safety helpers.

## Unsupported State

For unsupported adapters, the API returns `success: true` with `data.supported = false` and a reason.

