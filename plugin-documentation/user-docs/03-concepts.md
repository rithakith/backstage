# Concepts

This page explains the main concepts users will see in the WSO2 plugin suite.

## WSO2 API Entity

A WSO2 API is imported into Backstage as a catalog `API` entity.

It can show:

- API name and version.
- Context.
- Provider.
- Lifecycle state.
- Definition.
- Documents.
- Gateway URLs.
- Runtime actions where supported.

## API Product

A WSO2 API Product is also imported as a Backstage `API` entity.

In the UI, API products can show the APIs and operations included in the product.

## MCP Server

A WSO2 MCP server is imported as a Backstage `API` entity with MCP-specific metadata.

The UI can show MCP tools when the catalog entity contains tool metadata.

## Service Catalog Service

A WSO2 Service Catalog service is imported as a Backstage `API` entity with service-specific annotations.

The WSO2 API Manager page can show services and fetch usage or definition data where available.

## Gateway

The plugin can show two kinds of gateway information:

| Gateway source | Meaning |
| --- | --- |
| APIM environment | Gateway information returned by WSO2 API Manager Publisher settings. |
| Configured self-hosted gateway | Gateway configured in Backstage under `wso2PlatformGateway`. |

Self-hosted gateways can optionally include a discovery URL. If configured, the catalog module can ingest APIs discovered directly from that gateway.

## Catalog Ingestion

Catalog ingestion is the process that copies WSO2 metadata into Backstage catalog entities.

The WSO2 APIM catalog module runs on a schedule. It performs a full refresh of the WSO2 entities it owns.

If an API is missing from Backstage, the issue is usually in one of these areas:

- WSO2 API visibility or permissions.
- Service-account scopes.
- Catalog provider schedule.
- WSO2 base URL or API base paths.
- Entity mapping or annotation generation.

## Runtime Operations

Runtime operations are actions the frontend performs through the WSO2 backend plugin after the page has loaded.

Examples:

- Listing gateways.
- Generating API keys.
- Checking revisions.
- Loading services.
- Loading service usage.
- Downloading service definitions.
- Downloading WSDL files.
- Downloading WSO2 documents.

These actions require the backend plugin to be registered and reachable.

## WSO2 User Token

Some frontend actions may send a WSO2 user access token to the backend using the `X-WSO2-Access-Token` header.

The backend may use that token for selected WSO2 calls. In some paths, if the user token fails with `401`, the backend can fall back to the configured service account.

For exact route behavior, use the developer docs.

## Asgardeo

Asgardeo integration is optional.

It can be used for:

- Backstage sign-in through Asgardeo.
- Syncing Asgardeo users and groups into the Backstage catalog.

The WSO2 API ingestion does not require Asgardeo.
