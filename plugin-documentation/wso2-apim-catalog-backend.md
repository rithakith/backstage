# WSO2 APIM Catalog Backend Module

Package: `@local/backstage-plugin-catalog-backend-module-wso2-apim`

Source folder: `plugins/catalog-backend-module-wso2-apim`

## Purpose

This catalog backend module discovers WSO2 API Manager data and ingests it into the Backstage catalog.

It creates Backstage catalog entities for:

- WSO2 APIs.
- WSO2 API Products.
- WSO2 MCP servers.
- WSO2 Service Catalog services.
- APIs discovered directly from configured self-hosted gateways.

## Backend Module Registration

The module is registered as:

| Field | Value |
| --- | --- |
| Plugin ID | `catalog` |
| Module ID | `wso2-apim` |

During initialization it:

1. Creates `Wso2ApiEntityProvider` with ID `wso2-publisher-apis`.
2. Adds the provider to `catalogProcessingExtensionPoint`.
3. Reads schedule configuration from `catalog.providers.wso2Apim.schedule`.
4. Runs the provider on that schedule.

## Provider Name

The provider name is:

```text
wso2-publisher-apis
```

This provider name is used as the `locationKey` when applying catalog mutations.

## Configuration

The provider reads:

| Config path | Purpose |
| --- | --- |
| `catalog.providers.wso2Apim.namespace` | Namespace for generated WSO2 entities. Defaults to `default`. |
| `catalog.providers.wso2Apim.schedule` | Schedule for periodic catalog sync. Required by module initialization. |
| `wso2ApiManager.baseUrl` | WSO2 API Manager base URL. |
| `wso2ApiManager.publisherBasePath` | Publisher API base path. |
| `wso2ApiManager.serviceCatalogBasePath` | Service Catalog base path. Defaults to `/api/am/service-catalog/v1`. |
| `wso2ApiManager.auth.clientId` | Service account OAuth client ID. |
| `wso2ApiManager.auth.clientSecret` | Service account OAuth client secret. |
| `wso2ApiManager.auth.tokenUrl` | Optional. Defaults to `{baseUrl}/oauth2/token` in this module. |
| `wso2ApiManager.auth.additionalScopes` | Optional additional OAuth scopes for catalog sync. |
| `wso2ApiManager.tls.rejectUnauthorized` | Optional. Defaults to `true`. |
| `wso2PlatformGateway` | Optional self-hosted gateway discovery and endpoint configuration. |

## Discovery Flow

`Wso2DiscoveryService.discoverAll` orchestrates discovery.

It fetches:

1. Global settings.
2. API list and details.
3. API product list and details.
4. MCP server list.
5. Service Catalog service list.
6. Directly discovered gateway APIs from configured `wso2PlatformGateway` entries.

It maps all results into Backstage entities and returns one combined entity list.

The provider applies a full mutation:

```text
type: full
```

This means each successful run replaces the provider's current catalog output with the newly discovered entity list.

API list discovery uses paginated Publisher requests with `limit=1000` and an increasing `offset`, so catalogs with more than 1000 APIs are fully discovered. After the summary pages are collected, API detail enrichment runs with bounded concurrency of 10 APIs at a time. The provider still applies one full catalog mutation after enrichment completes, avoiding partial catalog state if a later page or detail request fails.

## WSO2 Client Behavior

The module client:

- Uses Undici for WSO2 calls.
- Uses an Undici `Agent` configured from `wso2ApiManager.tls.rejectUnauthorized`.
- Acquires an OAuth access token with client credentials.
- Caches the access token for 50 minutes.
- Retries failed requests up to three times for retryable failures.
- Does not retry most 4xx errors except `401` and `429`.
- Clears the cached token on `401` before retrying.

Base OAuth scopes include:

```text
apim:api_view
apim:publisher_settings
apim:api_create
apim:api_publish
apim:api_import_export
apim:mcp_server_view
apim:mcp_server_create
apim:mcp_server_publish
apim:mcp_server_generate_key
apim:mcp_server_import_export
apim:mcp_server_list_view
apim:llm_provider_read
```

Additional scopes from `wso2ApiManager.auth.additionalScopes` are merged and deduplicated.

## API Entity Mapping

WSO2 APIs are mapped to Backstage `API` entities.

Entity basics:

| Field | Value |
| --- | --- |
| `apiVersion` | `backstage.io/v1alpha1` |
| `kind` | `API` |
| `metadata.name` | Normalized WSO2 API name. |
| `metadata.namespace` | Configured namespace, defaulting to `default`. |
| `metadata.title` | WSO2 `displayName` or `name`. |
| `metadata.description` | WSO2 description or `WSO2 API: {name}`. |
| `metadata.tags` | Normalized WSO2 tags. |
| `spec.type` | Lowercase WSO2 API type. |
| `spec.lifecycle` | `production` |
| `spec.owner` | Normalized WSO2 provider or `unknown`. |
| `spec.definition` | Fetched WSO2 API definition or placeholder. |

Annotations:

| Annotation | Meaning |
| --- | --- |
| `backstage.io/managed-by-location` | `wso2-apim:{providerId}` |
| `backstage.io/managed-by-origin-location` | `wso2-apim:{providerId}` |
| `wso2.com/api-id` | WSO2 API ID. |
| `wso2.com/api-name` | WSO2 API name. |
| `wso2.com/api-version` | WSO2 API version. |
| `wso2.com/api-context` | WSO2 API context. |
| `wso2.com/api-provider` | WSO2 API provider. |
| `wso2.com/api-type` | WSO2 API type. |
| `wso2.com/api-lifecycle-status` | WSO2 lifecycle status. |
| `wso2.com/api-gateway` | Gateway type or gateway vendor. |
| `wso2.com/is-discovered` | `true` when `initiatedFromGateway` is true, otherwise `false`. |
| `wso2.com/api-documents` | JSON string of WSO2 API documents. |
| `wso2.com/gateway-endpoints` | Reconstructed gateway endpoint list from global settings and deployment data. |
| `wso2.com/raw-endpoint-urls` | Raw WSO2 `endpointURLs`. |
| `wso2.com/platform-gateway-endpoints` | Endpoint list built from configured `wso2PlatformGateway` entries when configured. |
| `wso2.com/api-raw-json` | Full WSO2 API object as JSON. |
| `wso2.com/api-throttling-policy` | API throttling policy. |
| `wso2.com/api-transports` | JSON string of transports. |
| `wso2.com/api-visibility` | WSO2 visibility. |

## API Definition Fetching

For API definitions:

- Async-style API types use the WSO2 asyncapi endpoint.
- Other API types use the WSO2 swagger endpoint.

Async-style types:

- `WEBSUB`
- `WS`
- `SSE`
- `ASYNC`

If definition fetching fails, the module stores a placeholder string:

```text
WSO2 API Document content placeholder for {apiName}. Status: {status}
```

The frontend treats this placeholder as a loading/syncing state.

## Gateway Endpoint Reconstruction

For WSO2 APIs and API Products, gateway endpoints are reconstructed from:

- WSO2 global settings.
- Deployment names from the API or product.
- Gateway type or gateway vendor.
- VHost data and additional properties.
- API context and version.

The mapper attempts to match environments by:

- Deployed gateway name.
- Environment display name.
- Gateway type.

If the environment has direct endpoint URLs, those are used.

If direct endpoints are not available, the mapper builds URLs from vhost host, ports, base path, context, and version.

## API Product Entity Mapping

WSO2 API Products are mapped to Backstage `API` entities.

Entity basics:

| Field | Value |
| --- | --- |
| `metadata.name` | Normalized product name. |
| `metadata.title` | Product display name or name. |
| `metadata.description` | Product description or `WSO2 API Product: {name}`. |
| `spec.type` | `api_product` |
| `spec.lifecycle` | `production` |
| `spec.owner` | Technical owner, business owner, provider, or `unknown`. |
| `spec.definition` | Product definition or `WSO2 API Product: {name}`. |

Additional product annotations:

| Annotation | Meaning |
| --- | --- |
| `wso2.com/is-api-product` | Always `true` for product entities. |
| `wso2.com/product-resources` | JSON string of product APIs and operations. |
| `wso2.com/business-owner` | Product business owner. |
| `wso2.com/business-owner-email` | Product business owner email. |
| `wso2.com/technical-owner` | Product technical owner. |
| `wso2.com/technical-owner-email` | Product technical owner email. |

## MCP Server Entity Mapping

WSO2 MCP servers are mapped to Backstage `API` entities.

Entity basics:

| Field | Value |
| --- | --- |
| `metadata.name` | Normalized MCP server name. |
| `metadata.title` | MCP server name. |
| `metadata.description` | MCP description or `WSO2 MCP Server: {name}`. |
| `spec.type` | `mcp` |
| `spec.lifecycle` | `production` |
| `spec.owner` | MCP provider or `unknown`. |
| `spec.definition` | `WSO2 MCP Server: {name}` |

MCP annotations:

| Annotation | Meaning |
| --- | --- |
| `wso2.com/api-id` | MCP server ID. |
| `wso2.com/api-name` | MCP server name. |
| `wso2.com/api-type` | `MCP` |
| `wso2.com/is-mcp-server` | `true` |
| `wso2.com/api-raw-json` | Full MCP server object as JSON. |
| `wso2.com/mcp-tools` | JSON string of MCP tools. |
| `wso2.com/api-documents` | JSON string of MCP documents. |

## Service Entity Mapping

WSO2 Service Catalog services are mapped to Backstage `API` entities.

Entity basics:

| Field | Value |
| --- | --- |
| `metadata.name` | Normalized service name. |
| `metadata.description` | Service description or `Service {name}`. |
| `spec.type` | `service` |
| `spec.lifecycle` | `production` |
| `spec.owner` | `unknown` |
| `spec.definition` | Service description or `WSO2 Service Definition placeholder`. |

Service annotations:

| Annotation | Meaning |
| --- | --- |
| `wso2.com/is-service` | `true` |
| `wso2.com/service-id` | Service ID. |
| `wso2.com/service-name` | Service name. |
| `wso2.com/service-version` | Service version. |
| `wso2.com/service-url` | Service URL. |
| `wso2.com/service-definition-type` | Service definition type. |
| `backstage.io/managed-by-location` | `wso2-provider:{providerId}` |
| `backstage.io/managed-by-origin-location` | `wso2-provider:{providerId}` |

## Self-Hosted Gateway Discovery

The module reads `wso2PlatformGateway` entries.

For each gateway with `discoveryUrl`:

1. It calls the discovery URL.
2. It accepts array responses or object responses with `list`, `apis`, or `items`.
3. For each API ID, it calls `{discoveryUrl}/{apiId}` for details.
4. It maps each discovered API into a Backstage `API` entity.

The discovery request uses Basic auth when `discoveryUsername` and `discoveryPassword` are configured.

## Self-Hosted Gateway Entity Mapping

Gateway-discovered APIs are mapped into namespace:

```text
wso2-gateways
```

Entity name:

```text
{normalized-display-name}-{normalized-discovered-from}
```

Important annotations:

| Annotation | Meaning |
| --- | --- |
| `wso2-gateway.com/api-id` | Gateway API ID. |
| `wso2-gateway.com/api-name` | Display name. |
| `wso2-gateway.com/api-version` | Gateway API version or `1.0.0`. |
| `wso2-gateway.com/api-context` | Gateway API context or `/`. |
| `wso2-gateway.com/discovered-from` | Gateway name. |
| `wso2-gateway.com/api-endpoints` | Gateway endpoint list. |
| `wso2.com/api-id` | Same API ID for frontend compatibility. |
| `wso2.com/organization-id` | Organization ID when available. |
| `wso2.com/api-discovery-type` | `self-hosted-gateway` |
| `wso2.com/api-gateway-vendor` | Normalized gateway vendor. |
| `wso2.com/is-discovered` | Currently set to `false` in the inspected mapper. |
| `wso2.com/api-raw-json` | Full discovered API object as JSON. |
| `wso2.com/api-documents` | JSON string of documents when available. |

The `spec.definition` is `api.fetchedSwagger` when available.

## Relationship to the Frontend Plugin

This module provides most of the annotations consumed by the WSO2 API Manager frontend plugin.

The most important frontend annotations are:

- `wso2.com/api-id`
- `wso2-gateway.com/api-id`
- `wso2.com/api-discovery-type`
- `wso2.com/is-discovered`
- `wso2.com/api-raw-json`
- `wso2.com/gateway-endpoints`
- `wso2.com/platform-gateway-endpoints`
- `wso2-gateway.com/api-endpoints`
- `wso2.com/api-documents`
- `wso2.com/product-resources`
- `wso2.com/mcp-tools`

## Current Source Details

- The client uses the client credentials grant for WSO2 API Manager access.
- Self-hosted gateway-discovered entities set `wso2.com/api-discovery-type` to `self-hosted-gateway`, but currently set `wso2.com/is-discovered` to `false`.
- The module requires `catalog.providers.wso2Apim.schedule`; no default schedule is provided in the module source.

