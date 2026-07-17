# Catalog Ingestion Internals

The WSO2 APIM catalog package is `@local/backstage-plugin-catalog-backend-module-wso2-apim`.

## Module Registration

The module is registered in `src/module.ts` as:

```text
pluginId: catalog
moduleId: wso2-apim
```

It creates a `Wso2ApiEntityProvider` with id:

```text
wso2-publisher-apis
```

The module:

1. Adds the provider through `catalogProcessingExtensionPoint`.
2. Reads the schedule from `catalog.providers.wso2Apim.schedule`.
3. Runs the provider with the scheduler.

## Entity Provider

`Wso2ApiEntityProvider` implements Backstage `EntityProvider`.

The provider:

- Stores the catalog connection passed through `connect`.
- Reads `catalog.providers.wso2Apim.namespace`, defaulting to `default`.
- Reads self-hosted gateway config from `wso2PlatformGateway`.
- Calls `Wso2DiscoveryService.discoverAll`.
- Applies a full mutation with `locationKey` equal to the provider name.

If the provider is run before `connect`, it throws:

```text
wso2-publisher-apis entity provider is not initialized
```

## Full Mutation Behavior

The provider applies:

```text
type: full
```

This means each successful run replaces the complete set of entities owned by this provider location key.

Developer implication: do not manually edit provider-owned catalog entities in place. Changes should come from WSO2 source data or mapper code.

## Discovery Service

`Wso2DiscoveryService.discoverAll` orchestrates discovery in this order:

1. Fetch global settings.
2. Fetch APIs from Publisher.
3. Fetch API products from Publisher.
4. Fetch MCP servers from Publisher.
5. Fetch services from the WSO2 Service Catalog.
6. Discover APIs directly from configured self-hosted gateways.
7. Map all results to Backstage entities.

The final entity list combines:

- API entities.
- API product entities.
- MCP server entities.
- Service entities.
- Gateway-discovered API entities.

## WSO2 Catalog Client

`Wso2Client` reads:

- `wso2ApiManager.baseUrl`
- `wso2ApiManager.publisherBasePath`
- `wso2ApiManager.serviceCatalogBasePath`
- `wso2ApiManager.auth.clientId`
- `wso2ApiManager.auth.clientSecret`
- `wso2ApiManager.auth.tokenUrl`
- `wso2ApiManager.auth.additionalScopes`
- `wso2ApiManager.tls.rejectUnauthorized`

If `auth.tokenUrl` is not configured, this catalog client defaults to:

```text
{wso2ApiManager.baseUrl}/oauth2/token
```

This differs from the runtime backend client, which throws if `tokenUrl` is missing during token acquisition.

## Catalog Client Retry Behavior

For WSO2 GET requests, `Wso2Client` retries up to three times.

It does not retry most 4xx responses. It can retry `401` and `429`. On `401`, it clears the cached token before the next attempt.

The retry delay is exponential:

```text
attempt 1 -> 2000 ms
attempt 2 -> 4000 ms
```

## API Discovery

The API fetcher:

- Calls `{publisherBasePath}/apis?limit=1000`.
- Fetches detail for each API using `{publisherBasePath}/apis/{apiId}`.
- Fetches documents from `{publisherBasePath}/apis/{apiId}/documents`.
- Fetches an OpenAPI definition from `{publisherBasePath}/apis/{apiId}/swagger`.
- Fetches an AsyncAPI definition from `{publisherBasePath}/apis/{apiId}/asyncapi` for API types `WEBSUB`, `WS`, `SSE`, and `ASYNC`.

If definition fetch fails, it returns a placeholder string containing the API name and status when available.

## API Product Discovery

The API product fetcher:

- Calls `{publisherBasePath}/api-products`.
- Fetches detail for each product using `{publisherBasePath}/api-products/{productId}`.
- Fetches product Swagger from `{publisherBasePath}/api-products/{productId}/swagger`.

If product definition fetch fails, it returns a placeholder string.

## MCP Server Discovery

The MCP fetcher:

- Calls `{publisherBasePath}/mcp-servers`.
- Fetches detail for each MCP server using `{publisherBasePath}/mcp-servers/{mcpId}`.
- Extracts operations whose `feature` is `TOOL`.
- Maps those operations into `wso2.com/mcp-tools`.
- Fetches documents from `{publisherBasePath}/mcp-servers/{mcpId}/documents`.

## Service Discovery

The service fetcher calls:

```text
{serviceCatalogBasePath}/services?limit=1000&offset=0
```

It maps returned services into Backstage `API` entities with `spec.type: service` and `wso2.com/is-service: true`.

## Gateway Discovery

The provider reads `wso2PlatformGateway` config and passes gateway entries into discovery.

Each configured gateway can include:

- `name`
- `urls`
- `discoveryUrl`
- `discoveryUsername`
- `discoveryPassword`
- `environmentType`
- `organizationId`

Discovered gateway APIs are mapped into namespace:

```text
wso2-gateways
```

Those entities receive both `wso2-gateway.com/*` annotations and selected `wso2.com/*` compatibility annotations.
