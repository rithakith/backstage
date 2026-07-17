# WSO2 Backstage Plugin Overview

## What is it?

The WSO2 Backstage plugin suite connects Backstage with WSO2 API Manager.

It brings WSO2 API Manager data into Backstage so developers can discover, inspect, and work with APIs from the same internal developer portal they already use for service catalog, ownership, documentation, and developer workflows.

## Why use this plugin?

Organizations using Backstage as their internal developer portal often cannot work with WSO2 API Manager from inside Backstage. Developers have to switch between:

- Backstage, for service catalog, documentation, ownership, and developer tooling.
- WSO2 API Manager Publisher and Developer portals, for API management tasks.

This split workflow makes API development harder. Developers cannot discover APIs, inspect API documentation, view WSO2 metadata, check gateway details, or work with selected API runtime actions from one place.

The WSO2 Backstage plugin suite reduces that context switching by bringing WSO2 API Manager discovery capabilities directly into Backstage.

## Things to know

- The plugin does not replace WSO2 API Manager. It brings selected WSO2 information and actions into Backstage.

- The suite consists of multiple packages (including frontend, backend, and catalog backend modules) that must be installed together to function; they cannot be used independently.
- The Asgardeo catalog sync and authentication backend modules are optional and should only be added if the organization uses Asgardeo as their Identity Provider (IdP). It is used for user/group catalog sync and Backstage sign-in.

## Features

### APIs
- **Discoverability**: Discover WSO2 APIs (HTTP/REST, SOAP, GraphQL, WebSocket, and AsyncAPIs) in the Backstage catalog.
- **Metadata & Documentation**: View API metadata (including lifecycle, context, version, and provider) and view/download API documentation.
- **Interactive Consoles**: View API definitions using built-in interactive tools (Swagger/OpenAPI for HTTP, GraphQL console for GraphQL, WebSocket console for WebSocket, and WSDL definitions for SOAP APIs).
- **In-Portal Invocation**: Support API invocation from within Backstage for WSO2 gateway-deployed subscriptionless APIs that have API Key enabled.

### API Products
- **Discoverability & Documentation**: Discover API Products in the catalog and view their documentation.
- **Resource Listing**: View API Product resources and operations.
- **In-Portal Invocation**: Support API invocation for subscriptionless APIs bundled inside the API product that have API key enabled.

### MCP (Model Context Protocol) Servers
- **Tool Listing**: Display tools and metadata associated with WSO2 MCP servers.

### Services (WSO2 Service Catalog)
- **Service Definitions**: View and download definitions for services registered in the WSO2 Service Catalog.(should we mention the download here?)

### API Platform Gateway Configuration
- **Gateway Discoverability**: View WSO2 API Platform configured self-hosted gateways.
- **Invocation Console**: Access invocation consoles to test APIs deployed on the gateways.

### Identity & Access (Optional)
- **User/Group Sync**: Sync Asgardeo users and groups into the Backstage catalog.
- **Single Sign-On (SSO)**: Enable Backstage sign-in through Asgardeo.

## Project Roadmap

### Now


### Next


### Someday/Maybe

- Add more WSO2 API Manager management actions inside Backstage.
- Add richer subscription management workflows.
- Add deeper permission-based controls for sensitive actions.
- Add analytics or usage dashboards for APIs.
- Add richer gateway health and status views.
- Add more guided onboarding and setup validation.
- Add more self-service troubleshooting views for platform teams.

### Done

- Initial WSO2 API Manager frontend plugin.
- Initial WSO2 API Manager backend plugin.
- WSO2 APIM catalog backend module.
- API, API Product, MCP server, service, and gateway-discovered entity mapping.
- API definition and document rendering.
- Runtime backend routes for selected WSO2 operations.
- Optional Asgardeo catalog and auth modules.

## Supported

The current plugin suite supports:

| Area | Support |
| --- | --- |
| Backstage catalog | WSO2 API Manager entities are ingested into the catalog. |
| WSO2 APIs | Supported as Backstage `API` entities. |
| WSO2 API Products | Supported as Backstage `API` entities with product resources. |
| WSO2 MCP servers | Supported as Backstage `API` entities with tool metadata. |
| WSO2 Service Catalog services | Supported as Backstage `API` entities with service metadata. |
| Self-hosted gateways | Supported through `wso2PlatformGateway` configuration. |
| HTTP/REST APIs | Supported with Swagger/OpenAPI-style viewing where definitions are available. |
| GraphQL APIs | Supported with GraphQL console behavior. |
| WebSocket APIs | Supported with WebSocket console behavior. |
| SOAP APIs | Supported with WSDL-oriented behavior and WSDL download where available. |
| Async APIs | Supported for definition/source-oriented viewing where available. |
| Asgardeo catalog sync | Optional. |
| Asgardeo sign-in | Optional. |

## Tech stack

### Frontend Plugin (`@local/backstage-plugin-wso2-api-manager`)
- **Languages**: TypeScript, HTML/CSS (via React)
- **Frameworks & UI Libraries**: React, Material UI
- **Tooling & Components**: Swagger UI (for HTTP APIs), GraphQL Console, WebSocket Console, Backstage Frontend Plugin API

### Backend Plugin (`@local/backstage-plugin-wso2-api-manager-backend`)
- **Languages**: TypeScript (Node.js)
- **Frameworks**: Express (via Backstage backend router), Backstage Backend Plugin API
- **APIs**: WSO2 API Manager DevPortal/Publisher REST APIs (for key generation, document downloading, etc.)

### Catalog Backend Module (`@local/backstage-plugin-catalog-backend-module-wso2-apim`)
- **Languages**: TypeScript (Node.js)
- **Frameworks**: Backstage Catalog Backend Module API
- **APIs**: WSO2 API Manager Publisher APIs, WSO2 Service Catalog APIs, WSO2 gateway discovery endpoints (for entity ingestion)

### Asgardeo Catalog Backend Module (`@local/backstage-plugin-catalog-backend-module-asgardeo`)
- **Languages**: TypeScript (Node.js)
- **Frameworks**: Backstage Catalog Backend Module API
- **APIs**: Asgardeo SCIM APIs (for user/group synchronization)

### Asgardeo Auth Backend Module (`@local/backstage-plugin-auth-backend-module-asgardeo-provider`)
- **Languages**: TypeScript (Node.js)
- **Frameworks**: Backstage Auth Provider API
- **APIs**: Asgardeo OIDC APIs (for Single Sign-On / Authentication)

## Done

The current implementation includes these completed areas:

- WSO2 API Manager frontend plugin package.
- WSO2 API Manager backend plugin package.
- WSO2 APIM catalog backend module package.
- Asgardeo catalog backend module package.
- Asgardeo auth backend module package.

## Releases

The inspected local package versions are:

| Package | Version |
| --- | --- |
| `@local/backstage-plugin-wso2-api-manager` | `0.0.4` |
| `@local/backstage-plugin-wso2-api-manager-backend` | `0.0.3` |
| `@local/backstage-plugin-catalog-backend-module-wso2-apim` | `0.0.2` |
| `@local/backstage-plugin-catalog-backend-module-asgardeo` | `0.0.2` |

The Asgardeo auth backend module version should be checked in its package metadata before publishing release notes.

## Limitations

- The plugin does not replace the WSO2 API Manager Publisher or Developer portals.
- Catalog data is refreshed on a schedule; it is not always immediate.
- Discovered gateway APIs generally have limited invocation behavior.

