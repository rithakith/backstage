# Overview

This guide is for developers who maintain, extend, test, or integrate with the local WSO2 Backstage plugin suite.

For installation, first-time setup, and normal usage, refer to the user documentation in `plugin-documentation/README.md`. Developer docs should not duplicate the full user getting-started guide. They should explain how the implementation works and where to change it safely.

## Plugin Packages Covered

| Package | Role | Main responsibility |
| --- | --- | --- |
| `@local/backstage-plugin-wso2-api-manager` | Frontend plugin | Renders WSO2 API Manager UI pages and entity cards. |
| `@local/backstage-plugin-wso2-api-manager-backend` | Backend plugin | Provides authenticated backend routes used by the frontend plugin. |
| `@local/backstage-plugin-catalog-backend-module-wso2-apim` | Catalog backend module | Ingests WSO2 APIs, API products, MCP servers, services, and discovered gateway APIs into the Backstage catalog. |
| `@local/backstage-plugin-catalog-backend-module-asgardeo` | Catalog backend module | Ingests Asgardeo users and groups through SCIM 2.0. |
| `@local/backstage-plugin-auth-backend-module-asgardeo-provider` | Auth backend module | Registers Asgardeo as an OIDC auth provider for Backstage sign-in. |

## What Belongs in Developer Docs

Developer documentation should cover:

- Package boundaries and ownership.
- Runtime data flow between frontend, backend, WSO2, Asgardeo, and the Backstage catalog.
- Backend routes and frontend API client methods.
- Catalog provider behavior and entity mapping.
- Token flow, auth assumptions, and current security-sensitive behavior.
- Config schema and source-level config requirements.
- Error handling, logging, testing, extension, and maintenance notes.

## What Should Stay in User Docs

User documentation should cover:

- What the plugin does.
- How users access the plugin in Backstage.
- How users view APIs, services, gateways, docs, WSDLs, and generated keys.
- Required user-facing configuration examples.
- Troubleshooting written from an operator or user point of view.

## Current Review Notes

- The frontend client exposes `getHealth('/health')`, and the backend plugin registers an unauthenticated auth policy for `/health`, but the inspected backend router does not define `GET /health`.
- The backend config reader requires `wso2ApiManager.developerBasePath`, but `plugins/wso2-api-manager-backend/config.d.ts` does not currently declare that field.
- `POST /apis/:apiId/generate-key` authenticates the Backstage user, but the inspected backend route does not pass the returned WSO2 user token into `client.generateApiKey`. The operation therefore uses the service-account path in the inspected source.
