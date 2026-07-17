# API Reference

This API reference is for developers. It is not needed in the user guide.

The routes are exposed by `@local/backstage-plugin-wso2-api-manager-backend`.

## Base URL

Frontend code should discover the backend base URL with:

```ts
discoveryApi.getBaseUrl('wso2-api-manager')
```

Do not hard-code `/api/wso2-api-manager` in reusable frontend client code. The document download hook currently builds explicit backend URLs for document content; keep that behavior in mind when refactoring.

## Authentication

All routes in the inspected router require Backstage user credentials.

Optional WSO2 user token header:

```text
X-WSO2-Access-Token: <wso2-user-access-token>
```

The backend never treats the normal Backstage `Authorization` header as a WSO2 token.

## Error Format

Most JSON routes return:

```json
{
  "message": "error details"
}
```

Streaming routes may return upstream status and raw text body.

## `POST /refresh`

Requests a WSO2 catalog refresh.

Current behavior:

- Authenticates the Backstage user.
- Logs that a manual refresh was requested.
- Returns a message.

Important: the inspected source does not directly trigger the WSO2 catalog entity provider. A comment states that a real trigger would need an event bus or shared service.

Response:

```json
{
  "message": "Catalog refresh triggered. This may take a few moments to reflect in the catalog."
}
```

## `GET /gateways`

Returns a combined list of:

- APIM environments from Publisher settings.
- Self-hosted gateways from `wso2PlatformGateway` config.

The route attempts to fetch Publisher settings using the service account. If that fails, it logs a warning and still returns configured self-hosted gateways where possible.

Gateway fields include:

| Field | Description |
| --- | --- |
| `name` | Gateway or environment name. |
| `type` | Normalized gateway type. |
| `gatewayType` | Same normalized type value for display compatibility. |
| `description` | APIM or config-derived description. |
| `source` | `APIM` or `Config`. |
| `urls` | Endpoint URLs. |
| `status` | `Online` or `Offline` for configured gateways. |
| `discoveredApis` | APIs discovered from configured gateway discovery URLs. |

## `POST /apis/:apiId/generate-key`

Generates an API key through the WSO2 DevPortal API.

Request body:

```json
{
  "keyName": "Backstage_Key"
}
```

If `keyName` is not supplied, the backend client defaults to:

```text
Backstage_Key
```

The backend sends this payload to WSO2:

```json
{
  "keyName": "Backstage_Key",
  "keyType": "PRODUCTION",
  "validityPeriod": 3600,
  "additionalProperties": {}
}
```

Review note: the inspected route authenticates the Backstage user but does not pass the returned WSO2 user token into the backend client. Current behavior is service-account based.

## `GET /apis/:apiId/revisions`

Fetches WSO2 Publisher revisions for an API.

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `query` | No | Passed to WSO2 Publisher revisions endpoint. Example: `deployed:true`. |

Backend upstream call:

```text
GET {publisherBasePath}/apis/{apiId}/revisions?query=...
```

Returns the WSO2 revisions response:

```ts
{
  count: number;
  list: Array<{
    id: string;
    displayName: string;
    description?: string;
    createdTime?: string;
    deploymentInfo?: Array<{
      name: string;
      type: string;
      deployedTime: string;
    }>;
  }>;
}
```

## `GET /services`

Fetches services from the WSO2 Service Catalog.

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `limit` | No | Passed to WSO2 Service Catalog. |
| `offset` | No | Passed to WSO2 Service Catalog. |

Backend upstream call:

```text
GET {serviceCatalogBasePath}/services
```

## `GET /services/:serviceId/usage`

Fetches usage information for a WSO2 Service Catalog service.

Backend upstream call:

```text
GET {serviceCatalogBasePath}/services/{serviceId}/usage
```

## `GET /services/:serviceId/definition`

Fetches the service definition as text.

The route sends the backend client response body directly with `res.send(definition)`.

This endpoint can return non-JSON content.

## `GET /apis/:apiId/wsdl`

Streams WSDL content from WSO2 Publisher.

Backend upstream call:

```text
GET {publisherBasePath}/apis/{apiId}/wsdl
```

The backend sends this `Accept` header upstream:

```text
application/zip, application/wsdl+xml, text/xml, */*
```

The route preserves upstream headers where available:

- `Content-Type`
- `Content-Disposition`

If the upstream response has no body, the route returns `204`.

## `GET /apis/:apiId/documents/:documentId/content`

Streams or returns document content from WSO2 Publisher.

Backend upstream call:

```text
GET {publisherBasePath}/apis/{apiId}/documents/{documentId}/content
```

The backend appends a timestamp query parameter when calling WSO2:

```text
?t={Date.now()}
```

Special behavior:

- If WSO2 returns `404`, the backend fetches document metadata.
- If the document source type is `INLINE`, it returns inline content as `text/plain`.
- If the document source type is `MARKDOWN`, it returns inline content as `text/markdown`.
- If WSO2 returns JSON content, the backend extracts `inlineContent` when present, otherwise returns formatted JSON as text.
- Otherwise, the route streams the upstream body and preserves content headers where possible.

## `GET /health`

Review note: this endpoint is referenced by the frontend client and by backend auth policy, but the inspected router does not define it.

Do not document `GET /health` as an available backend endpoint until the router implements it.
