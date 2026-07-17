# Suite Overview

The local WSO2 plugin suite connects Backstage to WSO2 API Manager and, optionally, Asgardeo.

The suite has two main responsibilities:

- Ingest WSO2-managed APIs, API products, MCP servers, services, and gateway-discovered APIs into the Backstage catalog.
- Render WSO2-specific catalog cards and a WSO2 API Manager page in the Backstage frontend.

## Plugin Responsibilities

| Plugin | Responsibility |
| --- | --- |
| `@local/backstage-plugin-wso2-api-manager` | Frontend plugin. Provides the WSO2 API Manager page, entity cards, API definition rendering, document rendering, API product resource rendering, MCP tool rendering, and Try it out support. |
| `@local/backstage-plugin-wso2-api-manager-backend` | Backend plugin. Provides the backend route mounted under discovery ID `wso2-api-manager`. It proxies selected Publisher, DevPortal, Service Catalog, and gateway discovery operations. |
| `@local/backstage-plugin-catalog-backend-module-wso2-apim` | Catalog backend module. Periodically discovers WSO2 APIs, API products, MCP servers, services, and self-hosted gateway APIs, maps them into Backstage entities, and applies a full catalog mutation. |
| `@local/backstage-plugin-catalog-backend-module-asgardeo` | Optional catalog backend module. Periodically reads users and groups from the Asgardeo SCIM 2.0 API and maps them into Backstage `User` and `Group` entities. |
| `@local/backstage-plugin-auth-backend-module-asgardeo-provider` | Optional auth backend module. Registers the `asgardeo` auth provider so users can sign in through Asgardeo using Backstage auth. |

## End-to-End Flow

1. The WSO2 APIM catalog backend module reads WSO2 configuration from `wso2ApiManager` and gateway configuration from `wso2PlatformGateway`.
2. The module fetches API Manager data through WSO2 Publisher APIs, Service Catalog APIs, MCP server APIs, and configured gateway discovery URLs.
3. The module maps WSO2 objects into Backstage catalog entities and stores WSO2-specific facts as annotations.
4. The frontend plugin reads those annotations and entity definitions from the catalog entity currently being viewed.
5. For runtime actions, the frontend calls the WSO2 API Manager backend through `Wso2ApiManagerClient`.
6. The backend plugin authenticates the Backstage request, optionally forwards a WSO2 user access token through the `X-WSO2-Access-Token` header, and falls back to a service account token for several WSO2 requests when user-token access fails.

## Main Entity Types Created by the Catalog Module

| WSO2 source object | Backstage kind | Backstage `spec.type` |
| --- | --- | --- |
| WSO2 API | `API` | Lowercase WSO2 API type, for example `http`, `graphql`, `soap`, `ws`, or `openapi` depending on source data. |
| WSO2 API Product | `API` | `api_product` |
| WSO2 MCP server | `API` | `mcp` |
| WSO2 Service Catalog service | `API` | `service` |
| Self-hosted gateway discovered API | `API` | Lowercase discovered type, defaulting to `openapi` when absent. |
| Asgardeo SCIM user | `User` | Not applicable. |
| Asgardeo SCIM group | `Group` | Not applicable. |

## Important Integration Points

| Integration point | Used by |
| --- | --- |
| `wso2ApiManager.baseUrl` | Backend plugin and WSO2 APIM catalog module. |
| `wso2ApiManager.publisherBasePath` | Publisher API calls for APIs, products, MCP servers, settings, revisions, documents, and WSDL. |
| `wso2ApiManager.developerBasePath` | DevPortal API calls such as API key generation. |
| `wso2ApiManager.serviceCatalogBasePath` | Service Catalog API calls. |
| `wso2ApiManager.auth` | Service account token acquisition for WSO2 API access. |
| `wso2PlatformGateway` | Self-hosted gateway display, health/discovery data, and direct gateway API ingestion. |
| `auth.providers.wso2apim` | Frontend OAuth token source for WSO2 user identity when calling runtime APIs. |
| `auth.providers.asgardeo.<environment>` | Backstage sign-in configuration for the Asgardeo auth backend module. |
| `auth.providers.oidc.<environment>` | Used as the Asgardeo catalog module fallback for client credentials and organization derivation when catalog-provider-level settings are not configured. |

## Known Source-Code Details

- The WSO2 API Manager backend frontend API type includes `getHealth`, and the frontend client implements `getHealth('/health')`, but the current backend router does not define a `/health` route in the source inspected.
- The Asgardeo catalog module supports `catalog.providers.asgardeo.clientId`, `clientSecret`, and `baseUrl`. When credentials are absent there, it falls back to the OIDC provider for the active `auth.environment`.
- The WSO2 API Manager backend `/refresh` route logs and returns a message. It does not directly trigger the catalog provider from the router.
