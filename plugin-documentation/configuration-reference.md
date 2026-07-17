# Configuration Reference

This page summarizes the configuration used by the local WSO2-related plugins.

## `wso2ApiManager`

Used by:

- WSO2 API Manager backend plugin.
- WSO2 APIM catalog backend module.

Example shape:

```yaml
wso2ApiManager:
  baseUrl: https://example.wso2.com
  publisherBasePath: /api/am/publisher/v4
  developerBasePath: /api/am/devportal/v3
  serviceCatalogBasePath: /api/am/service-catalog/v1
  tls:
    rejectUnauthorized: true
  auth:
    clientId: ${WSO2_CLIENT_ID}
    clientSecret: ${WSO2_CLIENT_SECRET}
    tokenUrl: https://example.wso2.com/oauth2/token
    additionalScopes:
      - apim:api_view
```

Fields:

| Field | Required by source | Notes |
| --- | --- | --- |
| `baseUrl` | Yes | Base WSO2 API Manager URL. |
| `publisherBasePath` | Yes | Used for Publisher API calls. |
| `developerBasePath` | Backend plugin: yes | Used for DevPortal API calls. |
| `serviceCatalogBasePath` | No | Defaults to `/api/am/service-catalog/v1` where fallback exists. |
| `tls.rejectUnauthorized` | No | Defaults to `true`. |
| `auth.clientId` | Yes | OAuth client ID. |
| `auth.clientSecret` | Yes | OAuth client secret. |
| `auth.tokenUrl` | Backend plugin: read as optional but required during token acquisition. Catalog module: defaults to `{baseUrl}/oauth2/token`. |
| `auth.additionalScopes` | No | Used by WSO2 APIM catalog module to add scopes. |

## `wso2PlatformGateway`

Used by:

- WSO2 API Manager backend plugin.
- WSO2 APIM catalog backend module.
- WSO2 frontend indirectly through annotations created from this configuration.

Example shape:

```yaml
wso2PlatformGateway:
  - name: production-gateway
    urls:
      - https://gateway.example.com
    discoveryUrl: https://gateway.example.com/discovery
    discoveryUsername: ${WSO2_GATEWAY_DISCOVERY_USERNAME}
    discoveryPassword: ${WSO2_GATEWAY_DISCOVERY_PASSWORD}
    environmentType: PRODUCTION
    description: Production self-hosted gateway
    organizationId: example-org
```

Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | Yes | Gateway name/environment name. |
| `urls` | Yes | Gateway base URLs. |
| `discoveryUrl` | No | Enables direct gateway API discovery. |
| `discoveryUsername` | Backend plugin expects string in one path; catalog module treats it as optional. |
| `discoveryPassword` | Backend plugin expects string in one path; catalog module treats it as optional. |
| `environmentType` | No | Defaults differ by source path. |
| `description` | No | Display description. |
| `organizationId` | No | Added to discovered entities when available. |

## `catalog.providers.wso2Apim`

Used by:

- WSO2 APIM catalog backend module.

Example shape:

```yaml
catalog:
  providers:
    wso2Apim:
      namespace: wso2
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

Fields:

| Field | Required by source | Notes |
| --- | --- | --- |
| `namespace` | No | Defaults to `default`. |
| `schedule` | Yes | The module reads this path directly during initialization. |

The root `app-config.yaml` in this repository also includes `username` and `password` under this provider, but the inspected WSO2 APIM catalog module source does not read those fields.

## `catalog.providers.asgardeo`

Used by:

- Asgardeo catalog backend module.

Example shape based on current source:

```yaml
catalog:
  providers:
    asgardeo:
      organization: backstageplugin
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

Fields:

| Field | Required by source | Notes |
| --- | --- | --- |
| `organization` | No | If missing, extracted from the OIDC metadata URL for the active `auth.environment`; fallback is `backstageplugin`. |
| `schedule` | No | Default schedule is used when missing. |
| `baseUrl` | No | Overrides the default `https://api.asgardeo.io/t/{organization}` base URL. |
| `clientId` | No | Preferred client ID source for catalog sync. Falls back to OIDC auth provider credentials when absent. |
| `clientSecret` | No | Preferred client secret source for catalog sync. Falls back to OIDC auth provider credentials when absent. |
| `requestTimeoutMs` | No | Request timeout in milliseconds. Defaults to `15000`. |
| `retries` | No | Retry count for retryable external requests. Defaults to `2`. |

## `auth.providers.asgardeo.<environment>`

Used by:

- Asgardeo auth backend module.

Example shape:

```yaml
auth:
  environment: production
  providers:
    asgardeo:
      production:
        clientId: ${ASGARDEO_CLIENT_ID}
        clientSecret: ${ASGARDEO_CLIENT_SECRET}
        metadataUrl: https://api.asgardeo.io/t/${ASGARDEO_ORGANIZATION}/oauth2/token/.well-known/openid-configuration
        additionalScopes: 'openid profile email'
        prompt: login
        signIn:
          resolvers:
            - resolver: emailMatchingUserEntityProfileEmail
```

Fields:

| Field | Required by source | Notes |
| --- | --- | --- |
| `clientId` | Yes | OAuth client ID from the Asgardeo application. |
| `clientSecret` | Yes | OAuth client secret from the Asgardeo application. |
| `metadataUrl` | Yes | OIDC discovery metadata URL for the Asgardeo organization. |
| `additionalScopes` | No | Extra OAuth scopes requested during sign-in. |
| `prompt` | No | Optional OAuth prompt value. |
| `signIn.resolvers` | No | Supports `emailLocalPartMatchingUserEntityName` and `emailMatchingUserEntityProfileEmail`. |

## `auth.providers.wso2apim`

Used by:

- Frontend WSO2 auth API integration.

Example shape:

```yaml
auth:
  providers:
    wso2apim:
      development:
        clientId: ${WSO2_APIM_CLIENT_ID}
        clientSecret: ${WSO2_APIM_CLIENT_SECRET}
        metadataUrl: https://example.wso2.com/oauth2/token/.well-known/openid-configuration
        additionalScopes: 'apim:subscribe apim:api_view apim:api_generate_key apim:api_key'
        prompt: login
```

The frontend auth hook requests these scopes at runtime:

```text
openid profile email apim:api_view apim:api_generate_key apim:api_manage apim:subscribe apim:app_manage apim:api_key
```

The resulting token is passed to the WSO2 API Manager backend as:

```text
X-WSO2-Access-Token
```

## Important Annotation Reference

The frontend behavior depends heavily on annotations created by the WSO2 APIM catalog module.

| Annotation | Created for | Used by |
| --- | --- | --- |
| `wso2.com/api-id` | APIs, products, MCP servers, gateway-discovered APIs | API ID resolution, entity predicate, backend calls. |
| `wso2-gateway.com/api-id` | Gateway-discovered APIs | Fallback API ID resolution. |
| `wso2.com/api-raw-json` | APIs, products, MCP servers, gateway-discovered APIs | Metadata, type, policies, auth, tabs. |
| `wso2.com/api-documents` | APIs, MCP servers, gateway-discovered APIs | Documents card. |
| `wso2.com/gateway-endpoints` | APIs, products | Gateway URLs for standard WSO2 entities. |
| `wso2.com/platform-gateway-endpoints` | APIs, products | Gateway URLs for platform gateway configured entities. |
| `wso2-gateway.com/api-endpoints` | Gateway-discovered APIs | Gateway URLs for self-hosted gateway entities. |
| `wso2.com/api-discovery-type` | Gateway-discovered APIs | Discovery type branching. |
| `wso2.com/is-discovered` | APIs, products, gateway-discovered APIs | Badge and Try it out conditions. |
| `wso2.com/product-resources` | API products | Product resource card. |
| `wso2.com/mcp-tools` | MCP servers | MCP tools card. |
| `wso2.com/is-mcp-server` | MCP servers | MCP entity predicate. |
| `wso2.com/is-service` | Service Catalog services | Service identification. |
| `asgardeo.io/user-id` | Asgardeo users | User identity annotation. |
| `asgardeo.io/group-id` | Asgardeo groups | Group identity annotation. |
