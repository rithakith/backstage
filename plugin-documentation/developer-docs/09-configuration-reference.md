# Configuration Reference

This page describes configuration that affects implementation behavior. For user-facing setup examples, refer to the user docs.

## `wso2ApiManager`

The runtime backend plugin and catalog module both read `wso2ApiManager`.

| Field | Runtime backend | Catalog module | Notes |
| --- | --- | --- | --- |
| `baseUrl` | Required | Required | Base WSO2 API Manager URL. |
| `publisherBasePath` | Required | Required | Publisher API base path. |
| `developerBasePath` | Required by source | Not used by inspected catalog module | Used by runtime backend for DevPortal API calls. Review schema mismatch below. |
| `serviceCatalogBasePath` | Optional | Optional | Defaults to `/api/am/service-catalog/v1`. |
| `auth.clientId` | Required | Required | Secret according to backend config schema. |
| `auth.clientSecret` | Required | Required | Secret according to backend config schema. |
| `auth.tokenUrl` | Required at runtime token acquisition | Optional | Catalog module defaults to `{baseUrl}/oauth2/token`; runtime backend throws if missing. |
| `auth.additionalScopes` | Not used by inspected runtime backend | Optional | Catalog module appends these to its base scopes. |
| `tls.rejectUnauthorized` | Optional | Optional | Defaults to `true`. |
| `catalogSyncTimeoutSeconds` | Read by frontend | Not used by inspected backend module | Marked frontend-visible in backend config schema. |

## Schema Mismatch to Review

`plugins/wso2-api-manager-backend/src/service/wso2Client.ts` requires:

```text
wso2ApiManager.developerBasePath
```

The inspected `plugins/wso2-api-manager-backend/config.d.ts` does not declare `developerBasePath`.

Recommended fix: add `developerBasePath` to the config schema if the runtime backend should continue requiring it.

## `wso2PlatformGateway`

`wso2PlatformGateway` config is used by:

- Runtime backend `GET /gateways`.
- Catalog provider self-hosted gateway discovery.
- Catalog entity endpoint annotation reconstruction.

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Gateway/environment name. |
| `urls` | Yes | Base URLs used for display and endpoint construction. |
| `discoveryUrl` | No | URL used to discover APIs directly from the gateway. |
| `discoveryUsername` | Required by runtime backend reader | Optional by catalog provider check | Used with `discoveryPassword` to build Basic auth. |
| `discoveryPassword` | Required by runtime backend reader | Optional by catalog provider check | Secret. |
| `environmentType` | No | Runtime backend defaults to `PRODUCTION`; catalog provider defaults to `wso2`. |
| `description` | No | Used for display in `GET /gateways`. |
| `organizationId` | No | Added to gateway-discovered entities when present. |

Review note: the runtime backend config reader uses `gw.getString('discoveryUsername')` and `gw.getString('discoveryPassword')`, which makes these fields required for every configured gateway. The catalog provider treats them as optional. Align the two behaviors if credentials should be optional.

## `catalog.providers.wso2Apim`

The WSO2 catalog module reads:

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `namespace` | No | `default` | Namespace for WSO2 Publisher, product, MCP, and service entities. |
| `schedule` | Yes | None in inspected source | Required by `config.getConfig('catalog.providers.wso2Apim.schedule')`. |

The module creates a scheduled task from `catalog.providers.wso2Apim.schedule`.

## `catalog.providers.asgardeo`

The Asgardeo catalog module reads:

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `organization` | Yes | None | Used when fetching SCIM users and groups. |
| `schedule` | No | 30 min frequency, 5 min timeout, 5 sec initial delay | Used by Asgardeo provider scheduler. |

## Asgardeo Auth Provider Config

The auth backend module registers provider id:

```text
asgardeo
```

The exact auth config shape is inherited from Backstage OIDC auth provider behavior. This source module does not define a custom config schema beyond registering the provider factory and sign-in resolver factories.

## TLS Behavior

When `wso2ApiManager.tls.rejectUnauthorized` is `false`, WSO2 clients create an Undici dispatcher that disables TLS certificate validation.

Use this only for controlled development or environments with an explicit certificate strategy. Production environments should prefer trusted certificates and the default `true` value.
