# Package Structure

This page documents the source layout of the local plugin packages. Generated `dist`, `coverage`, and package-local `node_modules` folders are not part of the source structure.

## `plugins/wso2-api-manager`

Frontend plugin package: `@local/backstage-plugin-wso2-api-manager`.

Important source files:

| Path | Purpose |
| --- | --- |
| `src/plugin.ts` | Classic Backstage frontend plugin registration. |
| `src/routes.ts` | Route refs for the main page and optional TechDocs external route. |
| `src/alpha/plugin.tsx` | New frontend-system alpha plugin with page and entity card blueprints. |
| `src/api/index.ts` | API refs for WSO2 backend client and WSO2 auth. |
| `src/api/Wso2ApiManagerClient.ts` | Frontend client for the backend plugin routes. |
| `src/api/types.ts` | Frontend data types and client interface. |
| `src/components/Wso2ApiManagerPage` | Main WSO2 API Manager page. |
| `src/components/EntityWso2ApiDefinitionCard` | API definition, revisions, gateway URL, auth, and console views. |
| `src/components/EntityWso2ApiDocumentsCard` | Document table, preview, and document download behavior. |
| `src/components/EntityWso2ApiOverviewCard` | Summary card for WSO2 API entities. |
| `src/components/EntityWso2AboutCard` | Entity metadata and owner/gateway information. |
| `src/components/EntityWso2McpToolsCard` | MCP tools rendered from annotations. |
| `src/components/EntityWso2ApiProductResourcesCard` | API product resources rendered from annotations. |
| `src/utils.ts` | Entity predicates for WSO2 API and MCP entities. |

## `plugins/wso2-api-manager-backend`

Backend plugin package: `@local/backstage-plugin-wso2-api-manager-backend`.

Important source files:

| Path | Purpose |
| --- | --- |
| `src/plugin.ts` | Backend plugin registration and service dependencies. |
| `src/service/router.ts` | Express routes consumed by the frontend plugin. |
| `src/service/wso2Client.ts` | WSO2 Publisher, DevPortal, Service Catalog, token, TLS, and gateway client behavior. |
| `src/service/types.ts` | Backend service types. |
| `config.d.ts` | Config schema exposed by the backend plugin package. |

Review note: `src/service/wso2Client.ts` reads `wso2ApiManager.developerBasePath`, but `config.d.ts` does not currently declare `developerBasePath`.

## `plugins/catalog-backend-module-wso2-apim`

Catalog backend module package: `@local/backstage-plugin-catalog-backend-module-wso2-apim`.

Important source files:

| Path | Purpose |
| --- | --- |
| `src/module.ts` | Registers the module under the Backstage catalog plugin. |
| `src/providers/Wso2ApiEntityProvider.ts` | Scheduled entity provider and full mutation behavior. |
| `src/lib/Wso2Client.ts` | Client credentials token flow and resilient WSO2 GET requests. |
| `src/lib/Wso2DiscoveryService.ts` | Orchestrates all WSO2 discovery domains. |
| `src/lib/domains/api` | API list/detail/definition/docs fetchers and API entity mapper. |
| `src/lib/domains/product` | API product fetchers and API product entity mapper. |
| `src/lib/domains/mcp` | MCP server fetchers and MCP entity mapper. |
| `src/lib/domains/service` | Service Catalog fetcher and service entity mapper. |
| `src/lib/domains/gateway` | Self-hosted gateway discovery and gateway-discovered entity mapper. |
| `src/lib/domains/settings` | Global settings fetch and environment data used for endpoint reconstruction. |

## `plugins/catalog-backend-module-asgardeo`

Catalog backend module package: `@local/backstage-plugin-catalog-backend-module-asgardeo`.

Important source files:

| Path | Purpose |
| --- | --- |
| `src/module.ts` | Registers the module under the Backstage catalog plugin. |
| `src/providers/AsgardeoEntityProvider.ts` | Scheduled SCIM entity provider. |
| `src/lib/AsgardeoClient.ts` | Asgardeo SCIM client. |
| `src/lib/scim/mapperUtils.ts` | User and group entity mapping. |
| `src/lib/scim/scimApiUtils.ts` | SCIM API helper behavior. |

## `plugins/auth-backend-module-asgardeo-provider`

Auth backend module package: `@local/backstage-plugin-auth-backend-module-asgardeo-provider`.

Important source files:

| Path | Purpose |
| --- | --- |
| `src/module.ts` | Registers Asgardeo as an auth provider under Backstage auth. |
| `src/resolvers.ts` | Exposes supported sign-in resolver factories. |

