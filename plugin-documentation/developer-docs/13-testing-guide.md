# Testing Guide

The local packages already include tests for several important pieces. Extend tests near the code you change.

## Existing Test Areas

| Package | Test files observed |
| --- | --- |
| `wso2-api-manager` | API client tests, utility tests, selected component tests. |
| `wso2-api-manager-backend` | Router tests and backend WSO2 client tests. |
| `catalog-backend-module-wso2-apim` | Module, provider, client, discovery service, and domain mapper/fetcher tests. |
| `catalog-backend-module-asgardeo` | Module, provider, client, SCIM mapper, and SCIM utility tests. |

## Frontend Client Tests

Test `Wso2ApiManagerClient` when changing:

- Backend paths.
- Request methods.
- Headers.
- Query parameters.
- Error handling.
- JSON parsing behavior.

Important cases:

- `discoveryApi.getBaseUrl('wso2-api-manager')` is called.
- `X-WSO2-Access-Token` is sent when a token is supplied.
- POST routes send `Content-Type: application/json`.
- Non-OK responses throw useful errors.
- Empty successful responses return an empty object.

## Backend Router Tests

Test router behavior when changing:

- Route paths.
- Authentication requirements.
- Request/response shapes.
- Streaming behavior.
- Error status handling.
- Token forwarding.

Important cases:

- Unauthenticated requests are rejected.
- Authenticated requests call the expected client method.
- `X-WSO2-Access-Token` is passed into client methods where intended.
- `/refresh` behavior matches documented behavior.
- Streaming routes preserve content headers.
- Document route handles inline and markdown fallback behavior.

## Backend Client Tests

Test `Wso2ApiManagerClient` when changing:

- Token grant behavior.
- Token caching.
- Scope string.
- Publisher, DevPortal, or Service Catalog base paths.
- 401 fallback.
- TLS dispatcher behavior.
- WSO2 error extraction.

Important cases:

- Missing `tokenUrl` throws during service-account token resolution.
- User token fallback occurs only where intended.
- Service-account token is cached and refreshed before expiry.
- Non-JSON text is handled where methods allow it.

## Catalog Provider Tests

Test `Wso2ApiEntityProvider` when changing:

- Provider id.
- Namespace behavior.
- Schedule config.
- Platform gateway config parsing.
- Full mutation behavior.

Important cases:

- `run` throws if `connect` has not been called.
- Namespace defaults to `default`.
- Full mutation uses provider location key.
- Gateway credentials are handled consistently.

## Entity Mapper Tests

Mapper tests are the best protection for frontend compatibility.

When adding or changing annotations, test:

- Regular API entities.
- API product entities.
- MCP server entities.
- Service entities.
- Gateway-discovered entities.

Important cases:

- Entity names are normalized correctly.
- JSON annotation values are valid JSON strings.
- Required frontend annotations are present.
- Empty or missing WSO2 fields produce safe fallback values.

## Manual Regression Checklist

Before release:

1. Run affected package tests.
2. Build affected packages.
3. Ingest catalog entities from a known WSO2 environment.
4. Inspect one regular API, one API product, one MCP server, and one service entity.
5. Open each frontend card that depends on changed annotations.
6. Exercise backend runtime routes touched by the change.
7. Check backend logs for unexpected warnings or secret exposure.

## Test Gap Notes

- Add or update tests for the current `/health` mismatch before documenting it as supported.
- Add tests around API key generation token behavior before changing user-token vs service-account behavior.
- Add config schema tests or validation coverage for `developerBasePath` if it remains required.
