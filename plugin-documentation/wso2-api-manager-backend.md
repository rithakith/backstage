# WSO2 API Manager Backend Plugin

Package: `@local/backstage-plugin-wso2-api-manager-backend`

Source folder: `plugins/wso2-api-manager-backend`

## Purpose

This plugin provides the backend API used by the WSO2 API Manager frontend plugin.

It is responsible for:

- Authenticating Backstage user requests.
- Reading WSO2 API Manager configuration.
- Acquiring and caching WSO2 service account tokens.
- Passing a WSO2 user access token to WSO2 when the frontend supplies one.
- Falling back to service account access for selected WSO2 calls when a user token receives a `401`.
- Proxying selected WSO2 Publisher, DevPortal, Service Catalog, and gateway discovery operations.

## Backend Plugin ID

The backend plugin is created with plugin ID:

```text
wso2-api-manager
```

The frontend discovers this plugin through:

```ts
discoveryApi.getBaseUrl('wso2-api-manager')
```

## Configuration

The backend reads configuration from:

- `wso2ApiManager`
- `wso2PlatformGateway`

Required `wso2ApiManager` fields:

| Field | Purpose |
| --- | --- |
| `baseUrl` | Base WSO2 API Manager URL. |
| `publisherBasePath` | Base path for Publisher API calls. |
| `developerBasePath` | Base path for DevPortal API calls. |
| `auth.clientId` | Service account OAuth client ID. |
| `auth.clientSecret` | Service account OAuth client secret. |

Optional `wso2ApiManager` fields:

| Field | Default | Purpose |
| --- | --- | --- |
| `serviceCatalogBasePath` | `/api/am/service-catalog/v1` | Base path for Service Catalog calls. |
| `auth.tokenUrl` | No fallback in `readWso2ApiManagerConfig`; later required by token acquisition. | Token URL for service account access. |
| `tls.rejectUnauthorized` | `true` | Whether TLS certificate validation is enforced. |

`wso2PlatformGateway` is optional and is used for self-hosted gateway discovery and display.

Each configured gateway can include:

| Field | Purpose |
| --- | --- |
| `name` | Gateway environment name. |
| `urls` | Gateway base URLs. |
| `discoveryUrl` | URL used to discover APIs directly from the gateway. |
| `discoveryUsername` | Optional basic auth username for gateway discovery. |
| `discoveryPassword` | Optional basic auth password for gateway discovery. |
| `environmentType` | Gateway environment type. Defaults to `PRODUCTION` in this backend plugin. |
| `description` | Optional display description. |
| `organizationId` | Optional organization ID. |

## Authentication Model

Every route calls `ensureAuthenticated`.

`ensureAuthenticated`:

- Requires Backstage user credentials through `httpAuth.credentials(req, { allow: ['user'] })`.
- Returns only the `X-WSO2-Access-Token` request header when present.
- Does not return the regular Backstage `Authorization` header because that token is a Backstage identity token, not a WSO2 access token.

This means frontend requests must be made by authenticated Backstage users, and WSO2 user-token behavior depends on the frontend sending `X-WSO2-Access-Token`.

## Service Account Token Handling

The backend client acquires service account access tokens with the client credentials grant.

Token request:

- URL: `wso2ApiManager.auth.tokenUrl`
- Auth: HTTP Basic using `clientId:clientSecret`
- Grant type: `client_credentials`
- Scope string:

```text
apim:api_generate_key apim:api_create apim:api_manage apim:api_view apim:api_publish apim:subscribe apim:api_key apim:mcp_server_view apim:publisher_settings apim:app_manage
```

The token is cached until five minutes before its expiry.

## Routes

### `POST /refresh`

Requires an authenticated Backstage user.

Current behavior:

- Logs that a WSO2 catalog refresh was requested.
- Returns a message saying catalog refresh was triggered.

Important implementation detail:

- The current route does not directly trigger the WSO2 catalog entity provider. The source comments state that this would require an event bus or shared service.

### `GET /gateways`

Requires an authenticated Backstage user.

Returns a combined list of:

- APIM environments from Publisher `/settings`.
- Self-hosted gateways from `wso2PlatformGateway`.

For APIM environments, the backend maps:

- Name
- Gateway type
- Description
- Source as `APIM`
- Endpoint URLs
- Status as `Online`

For configured self-hosted gateways, the backend maps:

- Name
- Type
- Description
- Source as `Config`
- URLs
- Status
- Discovered APIs when `discoveryUrl` is configured

Gateway type normalization maps empty, `wso2/synapse`, `synapse`, `regular`, and `wso2` to `wso2`.

### `POST /apis/:apiId/generate-key`

Requires an authenticated Backstage user.

Request body:

```json
{
  "keyName": "Backstage_Key"
}
```

The backend calls the WSO2 DevPortal API:

```text
POST /apis/{apiId}/api-keys/generate
```

Generated key request sent to WSO2:

```json
{
  "keyName": "Backstage_Key",
  "keyType": "PRODUCTION",
  "validityPeriod": 3600,
  "additionalProperties": {}
}
```

The implementation currently calls `client.generateApiKey` without passing the user token returned by `ensureAuthenticated`, so this operation uses the service account path in the inspected source.

### `GET /apis/:apiId/revisions`

Requires an authenticated Backstage user.

Query parameters:

- `query`, for example `deployed:true`

The backend calls the WSO2 Publisher revisions endpoint:

```text
GET /apis/{apiId}/revisions
```

When a WSO2 user token is provided and receives `401`, the client retries with the service account token.

### `GET /services`

Requires an authenticated Backstage user.

Query parameters:

- `limit`
- `offset`

The backend calls the WSO2 Service Catalog services endpoint.

When a WSO2 user token is provided and receives `401`, the client retries with the service account token.

### `GET /services/:serviceId/usage`

Requires an authenticated Backstage user.

The backend calls the WSO2 Service Catalog service usage endpoint.

### `GET /services/:serviceId/definition`

Requires an authenticated Backstage user.

The backend retrieves the service definition as text from the WSO2 Service Catalog API.

When a WSO2 user token is provided and receives `401`, the client retries with the service account token.

### `GET /apis/:apiId/wsdl`

Requires an authenticated Backstage user.

The backend streams WSDL content from the WSO2 Publisher API.

It preserves response headers where available:

- `Content-Type`
- `Content-Disposition`

It accepts:

```text
application/zip, application/wsdl+xml, text/xml, */*
```

When a WSO2 user token is provided and receives `401`, the client retries with the service account token.

### `GET /apis/:apiId/documents/:documentId/content`

Requires an authenticated Backstage user.

The backend streams document content from the WSO2 Publisher API.

Special behavior:

- If the WSO2 content endpoint returns `404`, the backend fetches document metadata.
- If the document is `INLINE` or `MARKDOWN`, it returns inline content from the metadata response.
- If WSO2 returns JSON content, the backend extracts `inlineContent` or returns formatted JSON as text.
- Otherwise, it streams the WSO2 response body.

## Client Request Families

The backend client groups WSO2 calls into three families.

### DevPortal Requests

Base URL:

```text
{baseUrl}{developerBasePath}
```

Used for:

- API key generation.

### Service Catalog Requests

Base URL:

```text
{baseUrl}{serviceCatalogBasePath}
```

Used for:

- Service listing.
- Service usage.
- Service definition.

### Publisher Requests

Base URL:

```text
{baseUrl}{publisherBasePath}
```

Used for:

- Revisions.
- Documents.
- Document content.
- WSDL.
- Settings.

## Error Handling

The backend extracts WSO2 error messages by:

- Reading the response body as text.
- Attempting to parse JSON.
- Returning `message: description` when both fields exist.
- Falling back to `message`, `description`, raw body, response status text, or status code.

Routes generally return `500` with a JSON `{ message }` body when an operation fails, except streaming routes may return the upstream status/body for upstream failures.

## TLS Behavior

When `wso2ApiManager.tls.rejectUnauthorized` is false, the backend creates an Undici `Agent` with TLS certificate validation disabled.

This affects outgoing WSO2 requests made by the backend client.

## Current Gaps and Source Details

- The frontend client implements `getHealth('/health')`, but the inspected router does not define `GET /health`.
- The `/refresh` route returns a message but does not currently cause an immediate provider run.
- `POST /apis/:apiId/generate-key` calls `ensureAuthenticated` but does not pass the returned WSO2 user token to `generateApiKey` in the inspected code path.
