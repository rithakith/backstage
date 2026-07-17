# Backend Plugin Internals

The backend package is `@local/backstage-plugin-wso2-api-manager-backend`.

## Plugin Registration

The backend plugin is registered in `src/plugin.ts` with:

```text
pluginId: wso2-api-manager
```

The plugin depends on:

| Dependency | Used for |
| --- | --- |
| `httpAuth` | Verifying Backstage user credentials on routes. |
| `httpRouter` | Mounting the Express router. |
| `logger` | Route and client logging. |
| `rootConfig` | Reading WSO2 config. |
| `userInfo` | Injected into router options, but not used by the inspected router. |

The plugin mounts the router returned by `createRouter`.

## Router Initialization

The router is created in `src/service/router.ts`.

Initialization performs:

1. Reads WSO2 API Manager config through `readWso2ApiManagerConfig`.
2. Creates `Wso2ApiManagerClient`.
3. Installs JSON body parsing with a `10mb` limit.
4. Registers WSO2-specific routes.

The router logs:

```text
WSO2 API Manager backend router initialized
```

## Authentication Helper

Every route in the inspected router calls `ensureAuthenticated`.

The helper:

1. Requires Backstage user credentials using `httpAuth.credentials(req, { allow: ['user'] })`.
2. Returns only the `X-WSO2-Access-Token` header when present.
3. Deliberately does not return the normal Backstage `Authorization` header.

This distinction matters because the Backstage identity token is not a WSO2 access token.

## WSO2 Client Responsibilities

`src/service/wso2Client.ts` handles:

- Reading WSO2 backend config.
- Joining WSO2 base URLs and API base paths.
- Service-account token acquisition with client credentials.
- Token caching until five minutes before expiry.
- WSO2 Publisher requests.
- WSO2 DevPortal requests.
- WSO2 Service Catalog requests.
- WSDL and document streaming requests.
- Optional TLS certificate validation disablement.
- Self-hosted gateway discovery calls.
- Error extraction from WSO2 responses.

## Backend API Families

| Client method family | Base path | Used for |
| --- | --- | --- |
| DevPortal | `baseUrl + developerBasePath` | API key generation. |
| Publisher | `baseUrl + publisherBasePath` | Revisions, documents, WSDL, settings. |
| Service Catalog | `baseUrl + serviceCatalogBasePath` | Services, usage, definitions. |
| Gateway discovery | Configured discovery URLs | Discovering APIs from self-hosted gateways. |

## Service Account Token Flow

When the backend needs a service-account token, it calls the configured token endpoint with:

```text
grant_type=client_credentials
```

The request uses HTTP Basic auth with:

```text
clientId:clientSecret
```

The inspected backend runtime client uses this scope string:

```text
apim:api_generate_key apim:api_create apim:api_manage apim:api_view apim:api_publish apim:subscribe apim:api_key apim:mcp_server_view apim:publisher_settings apim:app_manage
```

The token is cached until five minutes before expiry.

## User Token Fallback Behavior

For several Publisher and Service Catalog requests, a frontend-supplied WSO2 user token is attempted first. If WSO2 returns `401`, the client retries with the service-account token.

This fallback is implemented for:

- Publisher requests using `fetchWithFallback` and `requestPublisher`.
- DevPortal requests using `requestDevportal`.
- Service Catalog requests using `requestServiceCatalog`.
- Service definition requests through explicit retry logic.

Review note: the route for `POST /apis/:apiId/generate-key` retrieves the WSO2 token from `ensureAuthenticated`, but the inspected route does not pass that token into `client.generateApiKey`. As implemented, API key generation uses the service-account path.

## Gateway Normalization

The router normalizes gateway types so values such as empty string, `wso2/synapse`, `synapse`, `regular`, and `wso2` all display as:

```text
wso2
```

Other gateway type values are lowercased and returned as-is.

## Current Implementation Gaps

| Gap | Source observation |
| --- | --- |
| `GET /health` route missing | Frontend client has `getHealth`, and backend auth policy allows `/health` unauthenticated, but the inspected router does not define the route. |
| `developerBasePath` config schema mismatch | Runtime config reader requires `wso2ApiManager.developerBasePath`, but backend `config.d.ts` does not declare it. |
| `/refresh` does not trigger provider run | Route logs and returns a message, but comments state a real trigger would need an event bus or shared service. |
| API key generation ignores returned user token | `ensureAuthenticated` returns a token, but route calls `client.generateApiKey(apiId, { keyName })` without passing it. |
